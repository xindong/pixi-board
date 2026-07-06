mod asset_store;
mod error;
mod mcp_bridge;
mod models;
mod project_files;
mod project_store;

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use error::{AppError, AppResult};
use mcp_bridge::{BridgeResponse, McpBridge};
use models::{
    Asset, AssetDerivativeBytesInput, AssetImportItemOutcome, AssetImportProgressEvent,
    AssetMetadataUpdate, BoardNode, BoardSnapshot, BoardViewport, ProjectInfo,
};
use project_files::{writable_project_file, write_bytes};
use project_store::ProjectStore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tauri::State;

const LAST_PROJECT_FILE: &str = ".last-canvas";
const KNOWN_PROJECTS_FILE: &str = ".known-canvas-projects.json";
const MCP_PLUGIN_CONFIG_FILE: &str = ".pixi-board/mcp/plugins.json";
const MCP_PLUGIN_ROOT_DIR: &str = ".pixi-board/plugins";
const ASSET_IMPORT_PROGRESS_EVENT: &str = "asset-import-progress";

static ASSET_IMPORT_CATALOG_LOCK: Mutex<()> = Mutex::new(());

#[derive(Default)]
struct AppState {
    project_root: Option<PathBuf>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BoardPluginManagerConfig {
    config_path: String,
    plugin_root: String,
    plugin_order: Vec<String>,
    plugins: Vec<BoardPluginManagerPlugin>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BoardPluginManagerPlugin {
    id: String,
    name: String,
    version: Option<String>,
    path: String,
    kind: String,
    environment_variables: Vec<BoardPluginEnvironmentVariable>,
    env: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BoardPluginEnvironmentVariable {
    name: String,
    description: Option<String>,
    required: bool,
    secret: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct BoardPluginConfig {
    plugin_root: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    plugin_order: Vec<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    env_by_plugin: BTreeMap<String, BTreeMap<String, String>>,
}

#[tauri::command]
async fn create_or_open_project(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
    path: String,
) -> AppResult<ProjectInfo> {
    if path.trim().is_empty() {
        return Err(AppError::Path("project path is required".into()));
    }
    let app_root = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;
    let requested_root = PathBuf::from(path);

    let store = run_io(move || {
        if !is_canvas_project(&requested_root) {
            assert_empty_project_folder(&requested_root)?;
        }
        let store = ProjectStore::open(requested_root)?;
        remember_project(&app_root, store.root())?;
        Ok(store)
    })
    .await?;
    let info = store.info();
    {
        let mut guard = lock_state(&state)?;
        guard.project_root = Some(store.root().to_path_buf());
    }

    Ok(info)
}

#[tauri::command]
async fn open_initial_project(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
) -> AppResult<Option<ProjectInfo>> {
    let app_root = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;

    let store = run_io(move || {
        fs::create_dir_all(&app_root)?;
        let Some(root) = initial_project_root(&app_root)? else {
            return Ok(None);
        };
        let store = ProjectStore::open(root)?;
        remember_project(&app_root, store.root())?;
        Ok(Some(store))
    })
    .await?;
    let Some(store) = store else {
        let mut guard = lock_state(&state)?;
        guard.project_root = None;
        return Ok(None);
    };
    let info = store.info();
    {
        let mut guard = lock_state(&state)?;
        guard.project_root = Some(store.root().to_path_buf());
    }

    Ok(Some(info))
}

#[tauri::command]
async fn list_canvas_projects(app: tauri::AppHandle) -> AppResult<Vec<ProjectInfo>> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;

    run_io(move || {
        fs::create_dir_all(&root)?;
        list_canvas_project_infos(&root)
    })
    .await
}

#[tauri::command]
async fn load_plugin_manager_config(app: tauri::AppHandle) -> AppResult<BoardPluginManagerConfig> {
    let config_path = board_plugin_config_path(&app)?;
    let default_plugin_root = board_plugin_root_path(&app)?;
    run_io(move || {
        let config = read_or_create_board_plugin_config(&config_path, &default_plugin_root)?;
        fs::create_dir_all(&config.plugin_root)?;
        let plugins = list_plugin_manager_plugins(&config.plugin_root, &config.plugin_order, &config.env_by_plugin)?;
        Ok(BoardPluginManagerConfig {
            config_path: config_path.to_string_lossy().to_string(),
            plugin_root: config.plugin_root,
            plugin_order: config.plugin_order,
            plugins,
        })
    })
    .await
}

#[tauri::command]
async fn save_plugin_env(
    app: tauri::AppHandle,
    plugin_name: String,
    env: BTreeMap<String, String>,
) -> AppResult<BoardPluginManagerConfig> {
    let config_path = board_plugin_config_path(&app)?;
    let default_plugin_root = board_plugin_root_path(&app)?;
    run_io(move || {
        let mut config = read_or_create_board_plugin_config(&config_path, &default_plugin_root)?;
        let trimmed_env = env
            .into_iter()
            .filter_map(|(key, value)| {
                let trimmed_key = key.trim().to_string();
                let trimmed_value = value.trim().to_string();
                if trimmed_key.is_empty() || trimmed_value.is_empty() {
                    None
                } else {
                    Some((trimmed_key, trimmed_value))
                }
            })
            .collect::<BTreeMap<_, _>>();
        if trimmed_env.is_empty() {
            config.env_by_plugin.remove(&plugin_name);
        } else {
            config.env_by_plugin.insert(plugin_name, trimmed_env);
        }
        fs::create_dir_all(&config.plugin_root)?;
        let plugins = list_plugin_manager_plugins(&config.plugin_root, &config.plugin_order, &config.env_by_plugin)?;
        write_board_plugin_config(&config_path, &config)?;
        Ok(BoardPluginManagerConfig {
            config_path: config_path.to_string_lossy().to_string(),
            plugin_root: config.plugin_root,
            plugin_order: config.plugin_order,
            plugins,
        })
    })
    .await
}

#[tauri::command]
async fn refresh_plugins_and_restart_mcp(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
    bridge: State<'_, Mutex<McpBridge>>,
    plugin_order: Vec<String>,
) -> AppResult<BoardPluginManagerConfig> {
    let config_path = board_plugin_config_path(&app)?;
    let default_plugin_root = board_plugin_root_path(&app)?;
    let config = run_io(move || {
        let mut config = read_or_create_board_plugin_config(&config_path, &default_plugin_root)?;
        fs::create_dir_all(&config.plugin_root)?;
        let plugins = list_plugin_manager_plugins(&config.plugin_root, &plugin_order, &config.env_by_plugin)?;
        let known_ids: std::collections::BTreeSet<String> =
            plugins.iter().map(|plugin| plugin.id.clone()).collect();
        config.plugin_order = plugin_order
            .into_iter()
            .filter(|id| known_ids.contains(id))
            .collect();
        write_board_plugin_config(&config_path, &config)?;
        let plugins = list_plugin_manager_plugins(&config.plugin_root, &config.plugin_order, &config.env_by_plugin)?;
        Ok(BoardPluginManagerConfig {
            config_path: config_path.to_string_lossy().to_string(),
            plugin_root: config.plugin_root,
            plugin_order: config.plugin_order,
            plugins,
        })
    })
    .await?;

    let next_bridge = McpBridge::start(app.clone())?;
    {
        let mut bridge_guard = lock_mcp_bridge(&bridge)?;
        bridge_guard.stop();
        *bridge_guard = next_bridge;
    }

    let current_project_root = {
        let guard = lock_state(&state)?;
        guard.project_root.clone()
    };
    if let Some(project_root) = current_project_root {
        let bridge_guard = lock_mcp_bridge(&bridge)?;
        bridge_guard.publish_for_project(&project_root)?;
    }

    Ok(config)
}

#[tauri::command]
async fn rename_current_project(
    app: tauri::AppHandle,
    state: State<'_, Mutex<AppState>>,
    name: String,
) -> AppResult<ProjectInfo> {
    let current_root = current_project_root(&state)?;
    let app_root = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;
    let folder_name = sanitize_project_name(&name)?;
    let parent = current_root
        .parent()
        .ok_or_else(|| AppError::Path("project has no parent".into()))?
        .to_path_buf();
    let next_root = parent.join(folder_name);

    let store = run_io(move || {
        let previous_root = current_root.canonicalize()?;
        if next_root != current_root {
            if next_root.exists() {
                return Err(AppError::Path("canvas already exists".into()));
            }
            fs::rename(&current_root, &next_root)?;
        }
        let store = ProjectStore::open(next_root)?;
        replace_known_project(&app_root, &previous_root, store.root())?;
        write_last_project(&app_root, store.root())?;
        Ok(store)
    })
    .await?;
    let info = store.info();
    {
        let mut guard = lock_state(&state)?;
        guard.project_root = Some(store.root().to_path_buf());
    }
    Ok(info)
}

#[tauri::command]
async fn load_board_snapshot(project_root: String) -> AppResult<BoardSnapshot> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).load_snapshot()).await
}

#[tauri::command]
async fn save_board_state(
    project_root: String,
    nodes: Vec<BoardNode>,
    viewport: Option<BoardViewport>,
) -> AppResult<()> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).save_board_state(nodes, viewport)).await
}

#[tauri::command]
async fn upsert_assets(project_root: String, assets: Vec<Asset>) -> AppResult<Vec<Asset>> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).upsert_assets(assets)).await
}

#[tauri::command]
async fn delete_assets(project_root: String, asset_ids: Vec<String>) -> AppResult<()> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).delete_assets(asset_ids)).await
}

#[tauri::command]
async fn import_asset_files(project_root: String, paths: Vec<String>) -> AppResult<Vec<Asset>> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).import_asset_files(paths)).await
}

#[tauri::command]
async fn import_asset_file_batch(
    project_root: String,
    paths: Vec<String>,
) -> AppResult<Vec<AssetImportItemOutcome>> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).import_asset_file_batch(paths)).await
}

#[tauri::command]
async fn start_asset_import_batch(
    app: tauri::AppHandle,
    project_root: String,
    batch_id: String,
    paths: Vec<String>,
) -> AppResult<String> {
    let root = project_root_from_param(project_root)?;
    let returned_batch_id = batch_id.clone();

    tauri::async_runtime::spawn(async move {
        let total = paths.len();
        let mut handles = Vec::with_capacity(total);

        for (index, path) in paths.into_iter().enumerate() {
            let app_handle = app.clone();
            let item_batch_id = batch_id.clone();
            let root_path = root.clone();
            handles.push(tauri::async_runtime::spawn(async move {
                let event_path = path.clone();
                let outcome = run_io(move || {
                    let prepared = match asset_store::importer::prepare_asset_import(index, path) {
                        Ok(prepared) => prepared,
                        Err(outcome) => return Ok(outcome),
                    };
                    let _catalog_guard = ASSET_IMPORT_CATALOG_LOCK
                        .lock()
                        .map_err(|_| AppError::Path("asset import catalog lock poisoned".into()))?;
                    Ok(asset_store::importer::import_prepared_asset(&root_path, prepared))
                })
                .await
                .unwrap_or_else(|error| AssetImportItemOutcome {
                    ok: false,
                    index,
                    path: event_path.clone(),
                    asset: None,
                    error: Some(error.to_string()),
                });

                let imported = outcome.ok;
                emit_asset_import_progress(
                    &app_handle,
                    AssetImportProgressEvent {
                        batch_id: item_batch_id,
                        index: Some(outcome.index),
                        path: Some(outcome.path),
                        status: if imported { "imported" } else { "failed" }.into(),
                        asset: outcome.asset,
                        error: outcome.error,
                        imported_count: None,
                        failed_count: None,
                    },
                );
                imported
            }));
        }

        let mut imported_count = 0;
        let mut failed_count = 0;
        for handle in handles {
            match handle.await {
                Ok(true) => imported_count += 1,
                Ok(false) | Err(_) => failed_count += 1,
            }
        }

        emit_asset_import_progress(
            &app,
            AssetImportProgressEvent {
                batch_id,
                index: None,
                path: None,
                status: "complete".into(),
                asset: None,
                error: None,
                imported_count: Some(imported_count),
                failed_count: Some(failed_count),
            },
        );
    });

    Ok(returned_batch_id)
}

#[tauri::command]
async fn save_asset_derivative(
    project_root: String,
    asset_id: String,
    variant: String,
    extension: String,
    data_url: String,
    metadata: Option<models::AssetMetadataUpdate>,
) -> AppResult<Asset> {
    let root = project_root_from_param(project_root)?;
    run_io(move || {
        ProjectStore::from_root(root)
            .save_asset_derivative(asset_id, &variant, extension, data_url, metadata)
    })
    .await
}

#[tauri::command]
async fn save_asset_derivatives(
    project_root: String,
    asset_id: String,
    derivatives: Vec<AssetDerivativeBytesInput>,
    metadata: Option<models::AssetMetadataUpdate>,
) -> AppResult<Asset> {
    let root = project_root_from_param(project_root)?;
    run_io(move || {
        ProjectStore::from_root(root).save_asset_derivatives(asset_id, derivatives, metadata)
    })
    .await
}

#[tauri::command]
async fn update_asset_metadata(
    project_root: String,
    asset_id: String,
    metadata: AssetMetadataUpdate,
) -> AppResult<Asset> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).update_asset_metadata(asset_id, metadata)).await
}

#[tauri::command]
async fn resolve_asset_url(
    project_root: String,
    asset_id: String,
    variant: String,
) -> AppResult<String> {
    let root = project_root_from_param(project_root)?;
    run_io(move || ProjectStore::from_root(root).resolve_asset_path(asset_id, &variant)).await
}

#[tauri::command]
async fn export_asset(
    app: tauri::AppHandle,
    project_root: String,
    asset_id: String,
) -> AppResult<String> {
    let root = project_root_from_param(project_root)?;
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;
    run_io(move || ProjectStore::from_root(root).export_asset(asset_id, download_dir)).await
}

#[tauri::command]
async fn reveal_project_in_finder(project_root: String) -> AppResult<()> {
    let root = project_root_from_param(project_root)?;
    run_io(move || reveal_path(&root, false)).await
}

#[tauri::command]
async fn reveal_plugin_folder(app: tauri::AppHandle) -> AppResult<()> {
    let plugin_root = board_plugin_root_path(&app)?;
    run_io(move || {
        fs::create_dir_all(&plugin_root)?;
        reveal_path(&plugin_root, false)
    })
    .await
}

#[tauri::command]
async fn reveal_asset_in_finder(project_root: String, asset_id: String) -> AppResult<()> {
    let root = project_root_from_param(project_root)?;
    run_io(move || {
        let asset_path =
            PathBuf::from(ProjectStore::from_root(root).resolve_asset_path(asset_id, "original")?);
        reveal_path(&asset_path, true)
    })
    .await
}

#[tauri::command]
async fn save_board_screenshot(project_root: String, data_url: String) -> AppResult<String> {
    let root = project_root_from_param(project_root)?;
    run_io(move || {
        let bytes = decode_png_data_url(&data_url)?;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|err| AppError::Path(err.to_string()))?
            .as_millis();
        let relative_path = format!("media_tmp/screenshot-{timestamp}.png");
        let destination = writable_project_file(&root, &relative_path)?;
        write_bytes(&destination, &bytes)?;
        Ok(destination.to_string_lossy().to_string())
    })
    .await
}

#[tauri::command]
async fn publish_mcp_bridge(bridge: State<'_, Mutex<McpBridge>>, project_root: String) -> AppResult<()> {
    let root = project_root_from_param(project_root)?;
    let bridge_guard = lock_mcp_bridge(&bridge)?;
    bridge_guard.publish_for_project(&root)
}

#[tauri::command]
async fn complete_mcp_write_command(
    bridge: State<'_, Mutex<McpBridge>>,
    request_id: String,
    response: BridgeResponse,
) -> AppResult<()> {
    let bridge_guard = lock_mcp_bridge(&bridge)?;
    bridge_guard.complete(request_id, response)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(AppState::default()))
        .setup(|app| {
            let bridge = McpBridge::start(app.handle().clone())?;
            app.manage(Mutex::new(bridge));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_or_open_project,
            open_initial_project,
            list_canvas_projects,
            load_plugin_manager_config,
            save_plugin_env,
            refresh_plugins_and_restart_mcp,
            rename_current_project,
            load_board_snapshot,
            save_board_state,
            import_asset_files,
            import_asset_file_batch,
            start_asset_import_batch,
            upsert_assets,
            delete_assets,
            save_asset_derivative,
            save_asset_derivatives,
            update_asset_metadata,
            resolve_asset_url,
            export_asset,
            reveal_project_in_finder,
            reveal_plugin_folder,
            reveal_asset_in_finder,
            save_board_screenshot,
            publish_mcp_bridge,
            complete_mcp_write_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn board_plugin_config_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let home = app
        .path()
        .home_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;
    Ok(home.join(MCP_PLUGIN_CONFIG_FILE))
}

fn board_plugin_root_path(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let home = app
        .path()
        .home_dir()
        .map_err(|err| AppError::Path(err.to_string()))?;
    Ok(home.join(MCP_PLUGIN_ROOT_DIR))
}

fn read_or_create_board_plugin_config(
    config_path: &Path,
    default_plugin_root: &Path,
) -> AppResult<BoardPluginConfig> {
    match fs::read_to_string(config_path) {
        Ok(text) => {
            let value: Value = serde_json::from_str(&text)?;
            if value.get("pluginRoot").is_some() {
                return Ok(serde_json::from_value(value)?);
            }
            let config = migrate_legacy_board_plugin_config(value, default_plugin_root);
            write_board_plugin_config(config_path, &config)?;
            Ok(config)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let config = default_board_plugin_config(default_plugin_root);
            write_board_plugin_config(config_path, &config)?;
            Ok(config)
        }
        Err(error) => Err(error.into()),
    }
}

fn default_board_plugin_config(default_plugin_root: &Path) -> BoardPluginConfig {
    BoardPluginConfig {
        plugin_root: default_plugin_root.to_string_lossy().to_string(),
        plugin_order: Vec::new(),
        env_by_plugin: BTreeMap::new(),
    }
}

fn migrate_legacy_board_plugin_config(
    value: Value,
    default_plugin_root: &Path,
) -> BoardPluginConfig {
    let mut config = default_board_plugin_config(default_plugin_root);
    if let Some(plugins) = value.get("plugins").and_then(Value::as_array) {
        for entry in plugins {
            let Some(package) = entry.get("package").and_then(Value::as_str) else {
                continue;
            };
            let Some(env) = entry.get("env").and_then(Value::as_object) else {
                continue;
            };
            let plugin_env = config
                .env_by_plugin
                .entry(package_name_from_spec(package))
                .or_default();
            for (name, value) in env {
                if let Some(value) = value.as_str() {
                    plugin_env.insert(name.clone(), value.to_string());
                }
            }
        }
    }
    config
}

fn package_name_from_spec(package_spec: &str) -> String {
    if package_spec.starts_with('@') {
        let mut parts = package_spec.splitn(3, '/');
        let scope = parts.next().unwrap_or_default();
        let name_and_version = parts.next().unwrap_or_default();
        let name = name_and_version
            .find('@')
            .map(|index| &name_and_version[..index])
            .unwrap_or(name_and_version);
        return format!("{scope}/{name}");
    }
    package_spec
        .find('@')
        .map(|index| package_spec[..index].to_string())
        .unwrap_or_else(|| package_spec.to_string())
}

fn write_board_plugin_config(config_path: &Path, config: &BoardPluginConfig) -> AppResult<()> {
    let parent = config_path
        .parent()
        .ok_or_else(|| AppError::Path(format!("missing parent for {}", config_path.display())))?;
    fs::create_dir_all(parent)?;
    fs::write(config_path, format!("{}\n", serde_json::to_string_pretty(config)?))?;
    Ok(())
}

fn list_plugin_manager_plugins(
    plugin_root: &str,
    plugin_order: &[String],
    env_by_plugin: &BTreeMap<String, BTreeMap<String, String>>,
) -> AppResult<Vec<BoardPluginManagerPlugin>> {
    let root = PathBuf::from(plugin_root);
    fs::create_dir_all(&root)?;
    let mut plugins = Vec::new();
    for entry in fs::read_dir(&root)? {
        let entry = entry?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }
        let path = entry.path();
        let metadata = entry.metadata()?;
        if metadata.is_file() && file_name.to_lowercase().ends_with(".zip") {
            plugins.push(read_plugin_zip_summary(file_name, path, env_by_plugin)?);
        }
    }

    let order = plugin_order
        .iter()
        .enumerate()
        .map(|(index, id)| (id.as_str(), index))
        .collect::<BTreeMap<_, _>>();
    plugins.sort_by(|left, right| {
        match (order.get(left.id.as_str()), order.get(right.id.as_str())) {
            (Some(left_order), Some(right_order)) => left_order.cmp(right_order),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => left.id.cmp(&right.id),
        }
    });
    Ok(plugins)
}

fn read_plugin_zip_summary(
    id: String,
    path: PathBuf,
    env_by_plugin: &BTreeMap<String, BTreeMap<String, String>>,
) -> AppResult<BoardPluginManagerPlugin> {
    let mut name = id.clone();
    let mut version = None;
    let mut environment_variables = Vec::new();
    if let Some(package_json) = read_plugin_zip_package_json(&path)? {
        if let Some(package_name) = package_json.get("name").and_then(Value::as_str) {
            name = package_name.to_string();
        }
        version = package_json
            .get("version")
            .and_then(Value::as_str)
            .map(str::to_string);
        environment_variables = read_plugin_environment_variables(&package_json);
    }
    let env = env_by_plugin.get(&name).cloned().unwrap_or_default();
    Ok(BoardPluginManagerPlugin {
        id,
        name,
        version,
        path: path.to_string_lossy().to_string(),
        kind: "zip".into(),
        environment_variables,
        env,
    })
}

fn read_plugin_zip_package_json(path: &Path) -> AppResult<Option<Value>> {
    let output = Command::new("unzip")
        .arg("-p")
        .arg(path)
        .arg("*/package.json")
        .output()?;
    if !output.status.success() || output.stdout.is_empty() {
        return Ok(None);
    }
    Ok(Some(serde_json::from_slice(&output.stdout)?))
}

fn read_plugin_environment_variables(package_json: &Value) -> Vec<BoardPluginEnvironmentVariable> {
    package_json
        .get("pixiBoardPlugin")
        .and_then(|value| value.get("environmentVariables"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    Some(BoardPluginEnvironmentVariable {
                        name: item.get("name")?.as_str()?.to_string(),
                        description: item
                            .get("description")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        required: item.get("required").and_then(Value::as_bool).unwrap_or(false),
                        secret: item.get("secret").and_then(Value::as_bool).unwrap_or(false),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn sanitize_project_name(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed == "."
        || trimmed == ".."
    {
        return Err(AppError::Path("invalid canvas name".into()));
    }

    Ok(trimmed.to_string())
}

fn initial_project_root(app_root: &Path) -> AppResult<Option<PathBuf>> {
    if let Some(last_project) = read_last_project(app_root)? {
        return Ok(Some(last_project));
    }

    if let Some(project) = read_known_project_roots(app_root)?.into_iter().next() {
        return Ok(Some(project));
    }

    Ok(None)
}

fn list_canvas_project_infos(app_root: &Path) -> AppResult<Vec<ProjectInfo>> {
    let mut projects = Vec::new();
    for root in read_known_project_roots(app_root)? {
        projects.push(ProjectStore::open(root)?.info());
    }
    projects.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(projects)
}

fn read_last_project(app_root: &Path) -> AppResult<Option<PathBuf>> {
    let path = last_project_path(app_root);
    if !path.exists() {
        return Ok(None);
    }

    let stored = fs::read_to_string(path)?;
    let root = PathBuf::from(stored.trim());
    if is_canvas_project(&root) {
        return Ok(Some(root));
    }

    Ok(None)
}

fn remember_project(app_root: &Path, root: &Path) -> AppResult<()> {
    let canonical = root.canonicalize()?;
    write_last_project(app_root, &canonical)?;
    let mut roots = read_known_project_roots(app_root)?;
    upsert_project_root(&mut roots, canonical);
    write_known_project_roots(app_root, &roots)
}

fn write_last_project(app_root: &Path, root: &Path) -> AppResult<()> {
    fs::create_dir_all(app_root)?;
    fs::write(
        last_project_path(app_root),
        root.to_string_lossy().as_bytes(),
    )?;
    Ok(())
}

fn last_project_path(app_root: &Path) -> PathBuf {
    app_root.join(LAST_PROJECT_FILE)
}

fn known_projects_path(app_root: &Path) -> PathBuf {
    app_root.join(KNOWN_PROJECTS_FILE)
}

fn read_known_project_roots(app_root: &Path) -> AppResult<Vec<PathBuf>> {
    let path = known_projects_path(app_root);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let parsed = match serde_json::from_str::<Value>(&fs::read_to_string(&path)?) {
        Ok(Value::Array(entries)) => entries,
        _ => Vec::new(),
    };

    let mut cleaned = Vec::new();
    for entry in parsed {
        let Some(value) = entry.as_str() else {
            continue;
        };
        let candidate = PathBuf::from(value);
        if let Ok(canonical) = candidate.canonicalize() {
            if is_canvas_project(&canonical) {
                upsert_project_root(&mut cleaned, canonical);
            }
        }
    }

    write_known_project_roots(app_root, &cleaned)?;
    Ok(cleaned)
}

fn write_known_project_roots(app_root: &Path, roots: &[PathBuf]) -> AppResult<()> {
    fs::create_dir_all(app_root)?;
    let serialized = serde_json::to_string_pretty(
        &roots
            .iter()
            .map(|root| root.to_string_lossy().to_string())
            .collect::<Vec<_>>(),
    )?;
    fs::write(known_projects_path(app_root), format!("{serialized}\n"))?;
    Ok(())
}

fn replace_known_project(app_root: &Path, previous_root: &Path, next_root: &Path) -> AppResult<()> {
    let canonical_next = next_root.canonicalize()?;
    let previous_key = normalize_project_root(previous_root);
    let mut roots = read_known_project_roots(app_root)?;
    roots.retain(|root| normalize_project_root(root) != previous_key);
    upsert_project_root(&mut roots, canonical_next);
    write_known_project_roots(app_root, &roots)
}

fn upsert_project_root(roots: &mut Vec<PathBuf>, candidate: PathBuf) {
    let key = normalize_project_root(&candidate);
    if roots
        .iter()
        .any(|root| normalize_project_root(root) == key)
    {
        return;
    }
    roots.push(candidate);
}

fn normalize_project_root(path: &Path) -> String {
    let value = path.to_string_lossy().to_string();
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}

fn is_canvas_project(path: &Path) -> bool {
    path.is_dir() && path.join("board.json").exists() && path.join("assets.json").exists()
}

fn assert_empty_project_folder(path: &Path) -> AppResult<()> {
    if !path.is_dir() {
        return Err(AppError::Path("canvas folder must already exist".into()));
    }
    let mut entries = fs::read_dir(path)?;
    if entries.next().transpose()?.is_some() {
        return Err(AppError::Path("canvas folder must be empty".into()));
    }
    Ok(())
}

fn lock_state<'a>(state: &'a State<'_, Mutex<AppState>>) -> AppResult<MutexGuard<'a, AppState>> {
    state
        .lock()
        .map_err(|_| AppError::Path("state lock poisoned".into()))
}

fn lock_mcp_bridge<'a>(
    bridge: &'a State<'_, Mutex<McpBridge>>,
) -> AppResult<MutexGuard<'a, McpBridge>> {
    bridge
        .lock()
        .map_err(|_| AppError::Path("MCP bridge lock poisoned".into()))
}

fn reveal_path(path: &Path, select_file: bool) -> AppResult<()> {
    let target = path.canonicalize()?;

    #[cfg(target_os = "macos")]
    let status = {
        if select_file {
            Command::new("open").arg("-R").arg(&target).status()
        } else {
            Command::new("open").arg(&target).status()
        }
    };

    #[cfg(target_os = "windows")]
    let status = {
        if select_file {
            Command::new("explorer")
                .arg(format!("/select,{}", target.display()))
                .status()
        } else {
            Command::new("explorer").arg(&target).status()
        }
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = {
        let folder = if select_file {
            target
                .parent()
                .ok_or_else(|| AppError::Path("asset has no parent folder".into()))?
                .to_path_buf()
        } else {
            target
        };
        Command::new("xdg-open").arg(folder).status()
    };

    let status = status?;
    if status.success() {
        Ok(())
    } else {
        Err(AppError::Path(format!(
            "failed to reveal path: {}",
            path.display()
        )))
    }
}

fn current_project_root(state: &State<'_, Mutex<AppState>>) -> AppResult<PathBuf> {
    let guard = lock_state(state)?;
    guard.project_root.clone().ok_or(AppError::NoProject)
}

fn project_root_from_param(project_root: String) -> AppResult<PathBuf> {
    let root = PathBuf::from(project_root);
    let canonical = root.canonicalize()?;
    if !is_canvas_project(&canonical) {
        return Err(AppError::Path("invalid canvas project".into()));
    }
    Ok(canonical)
}

fn emit_asset_import_progress(app: &tauri::AppHandle, event: AssetImportProgressEvent) {
    let _ = app.emit(ASSET_IMPORT_PROGRESS_EVENT, event);
}

fn decode_png_data_url(data_url: &str) -> AppResult<Vec<u8>> {
    let (header, payload) = data_url.split_once(',').ok_or(AppError::InvalidDataUrl)?;
    if !header.starts_with("data:image/png;base64") {
        return Err(AppError::InvalidDataUrl);
    }
    Ok(BASE64_STANDARD.decode(payload)?)
}

async fn run_io<T, F>(task: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> AppResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| AppError::Task(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn project_root_from_param_accepts_initialized_canvas_project() {
        let temp = tempdir().unwrap();
        let store = ProjectStore::open(temp.path().join("canvas-a")).unwrap();

        let resolved = project_root_from_param(store.root().to_string_lossy().to_string()).unwrap();

        assert_eq!(resolved, store.root());
    }

    #[test]
    fn project_root_from_param_rejects_non_canvas_directory() {
        let temp = tempdir().unwrap();
        let folder = temp.path().join("plain-folder");
        fs::create_dir_all(&folder).unwrap();

        let error = project_root_from_param(folder.to_string_lossy().to_string())
            .expect_err("plain folders must not be accepted as canvas projects");

        assert!(error.to_string().contains("invalid canvas project"));
    }

    #[test]
    fn remember_project_initializes_and_tracks_selected_folder() {
        let temp = tempdir().unwrap();
        let app_root = temp.path().join("app-root");
        let selected = temp.path().join("selected-folder");

        fs::create_dir_all(&selected).unwrap();
        let store = ProjectStore::open(selected).unwrap();
        remember_project(&app_root, store.root()).unwrap();

        let roots = read_known_project_roots(&app_root).unwrap();
        assert_eq!(roots, vec![store.root().to_path_buf()]);
        assert!(store.root().join("board.json").exists());
        assert!(store.root().join("assets.json").exists());
    }

    #[test]
    fn assert_empty_project_folder_rejects_non_empty_folder() {
        let temp = tempdir().unwrap();
        let selected = temp.path().join("selected-folder");
        fs::create_dir_all(&selected).unwrap();
        fs::write(selected.join("notes.txt"), "not a canvas").unwrap();

        let error = assert_empty_project_folder(&selected)
            .expect_err("new canvas folders must be empty");

        assert!(error.to_string().contains("must be empty"));
    }

    #[test]
    fn assert_empty_project_folder_accepts_empty_folder() {
        let temp = tempdir().unwrap();
        let selected = temp.path().join("selected-folder");
        fs::create_dir_all(&selected).unwrap();

        assert_empty_project_folder(&selected).unwrap();
    }

    #[test]
    fn list_canvas_project_infos_returns_registry_projects_only() {
        let temp = tempdir().unwrap();
        let app_root = temp.path().join("app-root");
        let registered = ProjectStore::open(temp.path().join("registered-board")).unwrap();
        let unregistered = ProjectStore::open(app_root.join("unregistered-board")).unwrap();

        remember_project(&app_root, registered.root()).unwrap();

        let projects = list_canvas_project_infos(&app_root).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].root_path, registered.root().to_string_lossy().to_string());
        assert_ne!(projects[0].root_path, unregistered.root().to_string_lossy().to_string());
    }

    #[test]
    fn initial_project_root_returns_none_without_registry() {
        let temp = tempdir().unwrap();
        let app_root = temp.path().join("app-root");

        assert_eq!(initial_project_root(&app_root).unwrap(), None);
    }

    #[test]
    fn read_known_project_roots_cleans_stale_entries() {
        let temp = tempdir().unwrap();
        let app_root = temp.path().join("app-root");
        let external = ProjectStore::open(temp.path().join("external-board")).unwrap();
        fs::create_dir_all(&app_root).unwrap();
        fs::write(
            known_projects_path(&app_root),
            format!(
                "[\n  {:?},\n  {:?},\n  {:?}\n]\n",
                external.root().to_string_lossy(),
                temp.path().join("missing-board").to_string_lossy(),
                external.root().to_string_lossy(),
            ),
        )
        .unwrap();

        let roots = read_known_project_roots(&app_root).unwrap();
        assert_eq!(roots, vec![external.root().to_path_buf()]);
    }

    #[test]
    fn replace_known_project_updates_existing_path() {
        let temp = tempdir().unwrap();
        let app_root = temp.path().join("app-root");
        let old_store = ProjectStore::open(temp.path().join("external-board")).unwrap();
        let new_root = temp.path().join("renamed-board");

        remember_project(&app_root, old_store.root()).unwrap();
        fs::rename(old_store.root(), &new_root).unwrap();
        let new_store = ProjectStore::open(new_root).unwrap();

        replace_known_project(&app_root, old_store.root(), new_store.root()).unwrap();

        let roots = read_known_project_roots(&app_root).unwrap();
        assert_eq!(roots, vec![new_store.root().to_path_buf()]);
    }
}
