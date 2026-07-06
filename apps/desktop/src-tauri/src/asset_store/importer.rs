use crate::error::{AppError, AppResult};
use crate::models::{Asset, AssetImportItemOutcome, AssetKind};
use crate::project_files::{writable_project_file, write_bytes};
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::Read;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

const IMPORT_CONCURRENCY: usize = 4;
static IMPORT_THREAD_POOL: OnceLock<Result<rayon::ThreadPool, String>> = OnceLock::new();

struct ImportRequest {
    index: usize,
    path: String,
}

pub(crate) struct PreparedImport {
    index: usize,
    path: String,
    source: PreparedImportSource,
    kind: AssetKind,
    extension: String,
    hash: String,
    mime_type: String,
    file_name: String,
    size: u64,
    source_url: Option<String>,
}

enum PreparedImportSource {
    Local(PathBuf),
    Remote(Vec<u8>),
}

pub fn import_asset_files(root: &Path, paths: Vec<String>) -> AppResult<Vec<Asset>> {
    let outcomes = import_asset_file_batch(root, paths)?;
    let mut imported = Vec::with_capacity(outcomes.len());

    for outcome in outcomes {
        match outcome.asset {
            Some(asset) => imported.push(asset),
            None => {
                return Err(AppError::Path(outcome.error.unwrap_or_else(|| {
                    format!("failed to import asset {}", outcome.path)
                })));
            }
        }
    }

    Ok(imported)
}

pub fn import_asset_file_batch(
    root: &Path,
    paths: Vec<String>,
) -> AppResult<Vec<AssetImportItemOutcome>> {
    let mut assets = super::catalog::read_assets(root)?;
    let prepared = prepare_imports(paths)?;
    let mut outcomes = Vec::with_capacity(prepared.len());

    for result in prepared {
        match result {
            Ok(prepared_import) => {
                if let Some(existing) = assets
                    .iter()
                    .find(|asset| asset.hash.as_deref() == Some(prepared_import.hash.as_str()))
                    .cloned()
                {
                    outcomes.push(success_outcome(
                        prepared_import.index,
                        prepared_import.path,
                        existing,
                    ));
                    continue;
                }

                let index = prepared_import.index;
                let path = prepared_import.path.clone();
                match materialize_prepared_import(root, prepared_import) {
                    Ok(asset) => {
                        assets.push(asset.clone());
                        outcomes.push(success_outcome(index, path, asset));
                    }
                    Err(error) => outcomes.push(error_outcome(index, path, error.to_string())),
                }
            }
            Err(outcome) => outcomes.push(outcome),
        }
    }

    super::catalog::write_assets(root, &assets)?;
    Ok(outcomes)
}

pub(crate) fn prepare_asset_import(
    index: usize,
    path: String,
) -> Result<PreparedImport, AssetImportItemOutcome> {
    prepare_import_outcome(ImportRequest { index, path })
}

pub(crate) fn import_prepared_asset(
    root: &Path,
    prepared_import: PreparedImport,
) -> AssetImportItemOutcome {
    let mut assets = match super::catalog::read_assets(root) {
        Ok(assets) => assets,
        Err(error) => {
            return error_outcome(prepared_import.index, prepared_import.path, error.to_string());
        }
    };

    if let Some(existing) = assets
        .iter()
        .find(|asset| asset.hash.as_deref() == Some(prepared_import.hash.as_str()))
        .cloned()
    {
        return success_outcome(prepared_import.index, prepared_import.path, existing);
    }

    let index = prepared_import.index;
    let path = prepared_import.path.clone();
    let asset = match materialize_prepared_import(root, prepared_import) {
        Ok(asset) => asset,
        Err(error) => return error_outcome(index, path, error.to_string()),
    };
    assets.push(asset.clone());

    match super::catalog::write_assets(root, &assets) {
        Ok(()) => success_outcome(index, path, asset),
        Err(error) => error_outcome(index, path, error.to_string()),
    }
}

fn prepare_imports(
    paths: Vec<String>,
) -> AppResult<Vec<Result<PreparedImport, AssetImportItemOutcome>>> {
    let requests = paths
        .into_iter()
        .enumerate()
        .map(|(index, path)| ImportRequest { index, path })
        .collect::<Vec<_>>();

    Ok(import_thread_pool()?.install(|| {
        requests
            .into_par_iter()
            .map(prepare_import_outcome)
            .collect()
    }))
}

fn import_thread_pool() -> AppResult<&'static rayon::ThreadPool> {
    match IMPORT_THREAD_POOL.get_or_init(|| {
        rayon::ThreadPoolBuilder::new()
            .num_threads(IMPORT_CONCURRENCY)
            .thread_name(|index| format!("asset-import-{index}"))
            .build()
            .map_err(|error| error.to_string())
    }) {
        Ok(pool) => Ok(pool),
        Err(error) => Err(AppError::Task(error.clone())),
    }
}

fn prepare_import_outcome(
    request: ImportRequest,
) -> Result<PreparedImport, AssetImportItemOutcome> {
    prepare_import_outcome_with(request, prepare_import)
}

fn prepare_import_outcome_with<F>(
    request: ImportRequest,
    prepare: F,
) -> Result<PreparedImport, AssetImportItemOutcome>
where
    F: FnOnce(ImportRequest) -> AppResult<PreparedImport>,
{
    let index = request.index;
    let path = request.path.clone();

    match catch_unwind(AssertUnwindSafe(|| prepare(request))) {
        Ok(Ok(prepared_import)) => Ok(prepared_import),
        Ok(Err(error)) => Err(error_outcome(index, path, error.to_string())),
        Err(_) => Err(error_outcome(
            index,
            path,
            "asset import worker panicked".into(),
        )),
    }
}

fn prepare_import(request: ImportRequest) -> AppResult<PreparedImport> {
    if is_remote_url(&request.path) {
        prepare_remote_import(request)
    } else {
        prepare_local_import(request)
    }
}

fn prepare_local_import(request: ImportRequest) -> AppResult<PreparedImport> {
    let source = PathBuf::from(&request.path).canonicalize()?;
    if !source.is_file() {
        return Err(AppError::Path(format!(
            "asset source is not a file: {}",
            request.path
        )));
    }

    let extension = extension(&source).unwrap_or_else(|| "bin".to_string());
    let kind = classify_extension(&extension)?;
    let hash = hash_file(&source)?;
    let metadata = fs::metadata(&source)?;
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("media")
        .to_string();
    let mime_type = mime_guess::from_path(&source)
        .first_or_octet_stream()
        .essence_str()
        .to_string();
    validate_text_asset_file(&kind, &source)?;

    Ok(PreparedImport {
        index: request.index,
        path: request.path,
        source: PreparedImportSource::Local(source),
        kind,
        extension,
        hash,
        mime_type,
        file_name,
        size: metadata.len(),
        source_url: None,
    })
}

fn prepare_remote_import(request: ImportRequest) -> AppResult<PreparedImport> {
    let response =
        reqwest::blocking::get(&request.path).map_err(|error| AppError::Path(error.to_string()))?;
    if !response.status().is_success() {
        return Err(AppError::Path(format!(
            "failed to download asset {}: HTTP {}",
            request.path,
            response.status()
        )));
    }

    let mime_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.split(';').next().unwrap_or(value).to_string());
    let file_name = remote_file_name(&request.path, mime_type.as_deref());
    let extension = extension_from_file_name(&file_name).unwrap_or_else(|| {
        mime_type
            .as_deref()
            .and_then(extension_from_mime_type)
            .unwrap_or("bin")
            .to_string()
    });
    let bytes = response
        .bytes()
        .map_err(|error| AppError::Path(error.to_string()))?;
    let hash = hash_bytes(&bytes);
    let kind = classify_extension(&extension)?;
    validate_text_asset_bytes(&kind, &bytes)?;

    Ok(PreparedImport {
        index: request.index,
        path: request.path.clone(),
        source: PreparedImportSource::Remote(bytes.to_vec()),
        kind,
        extension,
        hash,
        mime_type: mime_type.unwrap_or_else(|| {
            mime_guess::from_path(&file_name)
                .first_or_octet_stream()
                .essence_str()
                .to_string()
        }),
        file_name,
        size: bytes.len() as u64,
        source_url: Some(request.path),
    })
}

fn materialize_prepared_import(root: &Path, prepared: PreparedImport) -> AppResult<Asset> {
    let id = format!(
        "asset_{}_{}",
        &prepared.hash[..16],
        uuid::Uuid::new_v4().simple()
    );
    let relative_local = format!("assets/originals/{id}.{}", prepared.extension);
    let destination = writable_project_file(root, &relative_local)?;

    match &prepared.source {
        PreparedImportSource::Local(source) => {
            fs::copy(source, &destination)?;
        }
        PreparedImportSource::Remote(bytes) => {
            write_bytes(&destination, bytes)?;
        }
    }

    Ok(create_asset(
        id,
        prepared.kind,
        relative_local,
        prepared.mime_type,
        prepared.file_name,
        prepared.size,
        prepared.hash,
        prepared.source_url,
        prepared.extension,
    ))
}

fn success_outcome(index: usize, path: String, asset: Asset) -> AssetImportItemOutcome {
    AssetImportItemOutcome {
        ok: true,
        index,
        path,
        asset: Some(asset),
        error: None,
    }
}

fn error_outcome(index: usize, path: String, error: String) -> AssetImportItemOutcome {
    AssetImportItemOutcome {
        ok: false,
        index,
        path,
        asset: None,
        error: Some(error),
    }
}

fn create_asset(
    id: String,
    kind: AssetKind,
    relative_local: String,
    mime_type: String,
    file_name: String,
    size: u64,
    hash: String,
    source_url: Option<String>,
    extension: String,
) -> Asset {
    let now = super::now_millis();
    let format = if kind == AssetKind::Model {
        Some(extension)
    } else {
        None
    };

    Asset {
        id,
        kind,
        local_path: Some(relative_local),
        derivatives: BTreeMap::new(),
        metadata: None,
        mime_type: Some(mime_type),
        file_name: Some(file_name),
        size: Some(size),
        hash: Some(hash),
        source_url,
        oss_file_id: None,
        web_link: None,
        width: None,
        height: None,
        duration: None,
        format,
        created_at: now,
        updated_at: now,
    }
}

fn classify_extension(ext: &str) -> AppResult<AssetKind> {
    match ext {
        "png" | "jpg" | "jpeg" | "webp" | "gif" => Ok(AssetKind::Image),
        "mp4" | "webm" | "mov" => Ok(AssetKind::Video),
        "mp3" | "wav" | "m4a" => Ok(AssetKind::Audio),
        "glb" | "gltf" | "obj" | "fbx" | "stl" | "ply" | "dae" | "3mf" | "3ds"
        | "vrml" | "wrl" | "zip" => Ok(AssetKind::Model),
        "txt" => Ok(AssetKind::Text),
        "md" | "markdown" => Ok(AssetKind::Markdown),
        "html" | "htm" => Ok(AssetKind::Html),
        other => Err(AppError::UnsupportedFormat(other.to_string())),
    }
}

fn validate_text_asset_file(kind: &AssetKind, source: &Path) -> AppResult<()> {
    if !is_text_asset_kind(kind) {
        return Ok(());
    }

    fs::read_to_string(source)?;
    Ok(())
}

fn validate_text_asset_bytes(
    kind: &AssetKind,
    bytes: &[u8],
) -> AppResult<()> {
    if !is_text_asset_kind(kind) {
        return Ok(());
    }

    std::str::from_utf8(bytes)
        .map_err(|error| AppError::Path(format!("text asset is not valid UTF-8: {error}")))?;
    Ok(())
}

fn is_text_asset_kind(kind: &AssetKind) -> bool {
    matches!(kind, AssetKind::Text | AssetKind::Markdown | AssetKind::Html)
}

fn is_remote_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn extension_from_file_name(file_name: &str) -> Option<String> {
    Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn extension_from_mime_type(mime_type: &str) -> Option<&'static str> {
    match mime_type {
        "image/png" => Some("png"),
        "image/jpeg" => Some("jpg"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        "video/mp4" => Some("mp4"),
        "video/webm" => Some("webm"),
        "audio/mpeg" => Some("mp3"),
        "audio/wav" | "audio/x-wav" => Some("wav"),
        "model/gltf-binary" => Some("glb"),
        "model/gltf+json" => Some("gltf"),
        "model/vnd.collada+xml" => Some("dae"),
        "model/vrml" | "x-world/x-vrml" => Some("wrl"),
        "application/zip" => Some("zip"),
        "text/plain" => Some("txt"),
        "text/markdown" => Some("md"),
        "text/html" => Some("html"),
        _ => None,
    }
}

fn remote_file_name(url: &str, mime_type: Option<&str>) -> String {
    let path_part = url
        .split('?')
        .next()
        .unwrap_or(url)
        .rsplit('/')
        .next()
        .unwrap_or("media")
        .trim();
    let fallback_extension = mime_type
        .and_then(extension_from_mime_type)
        .unwrap_or("bin");
    let candidate = if path_part.is_empty() {
        format!("media.{fallback_extension}")
    } else {
        path_part.to_string()
    };
    if extension_from_file_name(&candidate).is_some() {
        candidate
    } else {
        format!("{candidate}.{fallback_extension}")
    }
}

fn hash_file(path: &Path) -> AppResult<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepare_import_outcome_converts_panic_to_item_failure() {
        let outcome = prepare_import_outcome_with(
            ImportRequest {
                index: 7,
                path: "/tmp/panic.png".into(),
            },
            |_| -> AppResult<PreparedImport> {
                panic!("forced import panic");
            },
        );

        match outcome {
            Ok(_) => panic!("panic should be converted to an import item failure"),
            Err(error) => {
                assert!(!error.ok);
                assert_eq!(error.index, 7);
                assert_eq!(error.path, "/tmp/panic.png");
                assert_eq!(
                    error.error.as_deref(),
                    Some("asset import worker panicked")
                );
            }
        }
    }

    #[test]
    fn classify_extension_accepts_model_preview_formats() {
        for extension in [
            "glb", "gltf", "obj", "fbx", "stl", "ply", "dae", "3mf", "3ds", "vrml",
            "wrl", "zip",
        ] {
            assert_eq!(classify_extension(extension).unwrap(), AssetKind::Model);
        }
    }
}
