use crate::error::AppResult;
use crate::models::{current_schema_version, Asset, AssetCatalogFile};
use crate::project_files::{assets_path, write_bytes};
use serde_json::{Map, Value};
use std::fs;
use std::path::Path;

pub fn read_assets(root: &Path) -> AppResult<Vec<Asset>> {
    let text = fs::read_to_string(assets_path(root))?;
    let value = normalize_asset_catalog_json(serde_json::from_str(&text)?);
    let assets: AssetCatalogFile = serde_json::from_value(value)?;
    Ok(assets.assets)
}

pub fn write_assets(root: &Path, assets: &[Asset]) -> AppResult<()> {
    write_json(
        &assets_path(root),
        &AssetCatalogFile {
            schema_version: current_schema_version(),
            updated_at: super::now_millis(),
            assets: assets.to_vec(),
        },
    )
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let text = format!("{}\n", serde_json::to_string_pretty(value)?);
    write_bytes(path, text.as_bytes())
}

fn normalize_asset_catalog_json(value: Value) -> Value {
    match value {
        Value::Array(assets) => catalog_value(assets),
        Value::Object(mut catalog) => {
            if let Some(Value::Array(assets)) = catalog.remove("assets") {
                catalog.insert("assets".into(), Value::Array(assets.into_iter().map(normalize_asset_json).collect()));
            }
            Value::Object(catalog)
        }
        other => other,
    }
}

fn catalog_value(assets: Vec<Value>) -> Value {
    let mut catalog = Map::new();
    catalog.insert("schemaVersion".into(), Value::from(current_schema_version()));
    catalog.insert("updatedAt".into(), Value::from(super::now_millis()));
    catalog.insert("assets".into(), Value::Array(assets.into_iter().map(normalize_asset_json).collect()));
    Value::Object(catalog)
}

fn normalize_asset_json(value: Value) -> Value {
    let Value::Object(mut asset) = value else {
        return value;
    };

    let preview_path = asset.get("previewPath").and_then(Value::as_str).map(str::to_string);
    let poster_path = asset.get("posterPath").and_then(Value::as_str).map(str::to_string);
    let created_at = asset.get("createdAt").and_then(Value::as_i64).unwrap_or_default();
    let updated_at = asset.get("updatedAt").and_then(Value::as_i64).unwrap_or(created_at);

    let mut derivatives = match asset.remove("derivatives") {
        Some(Value::Object(derivatives)) => derivatives,
        _ => Map::new(),
    };

    let legacy_poster = derivatives.remove("poster");
    if !derivatives.contains_key("preview") {
        if let Some(path) = preview_path.or(poster_path) {
            derivatives.insert(
                "preview".into(),
                derivative_value(path, created_at, updated_at),
            );
        } else if let Some(poster) = legacy_poster {
            derivatives.insert("preview".into(), poster);
        }
    }

    asset.insert("derivatives".into(), Value::Object(derivatives));
    Value::Object(asset)
}

fn derivative_value(local_path: String, created_at: i64, updated_at: i64) -> Value {
    let mut derivative = Map::new();
    derivative.insert("localPath".into(), Value::from(local_path.clone()));
    derivative.insert("extension".into(), Value::from(extension_from_path(&local_path)));
    derivative.insert("createdAt".into(), Value::from(created_at));
    derivative.insert("updatedAt".into(), Value::from(updated_at));
    Value::Object(derivative)
}

fn extension_from_path(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("bin")
        .to_ascii_lowercase()
}
