use crate::error::{AppError, AppResult};
use crate::models::{
    Asset, AssetDerivative, AssetDerivativeBytesInput, AssetDerivativeVariant, AssetMetadataUpdate,
    AssetKind,
};
use crate::project_files::{existing_project_file, writable_project_file, write_bytes};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::path::Path;

pub fn save_derivative(
    root: &Path,
    asset_id: String,
    variant: &str,
    extension: String,
    data_url: String,
    metadata: Option<AssetMetadataUpdate>,
) -> AppResult<Asset> {
    let mut assets = super::catalog::read_assets(root)?;
    let asset = assets
        .iter_mut()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| AppError::AssetNotFound(asset_id.clone()))?;

    let derivative_variant = parse_derivative_variant(variant)?;
    let sanitized_extension = sanitize_extension(&extension)?;
    let bytes = decode_data_url(&data_url)?;
    let relative_path =
        derivative_relative_path(&asset.id, &derivative_variant, &sanitized_extension);

    let destination = writable_project_file(root, &relative_path)?;
    write_bytes(&destination, &bytes)?;

    let timestamp = super::now_millis();
    let derivative_created_at = asset
        .derivatives
        .get(&derivative_variant)
        .map(|derivative| derivative.created_at)
        .unwrap_or(timestamp);
    asset.derivatives.insert(
        derivative_variant,
        AssetDerivative {
            local_path: relative_path,
            extension: sanitized_extension,
            created_at: derivative_created_at,
            updated_at: timestamp,
        },
    );

    if let Some(next_metadata) = metadata {
        apply_metadata_update(asset, next_metadata);
    }
    asset.updated_at = timestamp;
    let updated = asset.clone();
    super::catalog::write_assets(root, &assets)?;
    Ok(updated)
}

pub fn save_derivatives(
    root: &Path,
    asset_id: String,
    derivatives: Vec<AssetDerivativeBytesInput>,
    metadata: Option<AssetMetadataUpdate>,
) -> AppResult<Asset> {
    let mut assets = super::catalog::read_assets(root)?;
    let asset = assets
        .iter_mut()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| AppError::AssetNotFound(asset_id.clone()))?;

    if derivatives.is_empty() && metadata.is_none() {
        return Ok(asset.clone());
    }

    let timestamp = super::now_millis();
    for derivative in derivatives {
        let sanitized_extension = sanitize_extension(&derivative.extension)?;
        let relative_path =
            derivative_relative_path(&asset.id, &derivative.variant, &sanitized_extension);
        let destination = writable_project_file(root, &relative_path)?;
        write_bytes(&destination, &derivative.bytes)?;

        let derivative_created_at = asset
            .derivatives
            .get(&derivative.variant)
            .map(|derivative| derivative.created_at)
            .unwrap_or(timestamp);
        asset.derivatives.insert(
            derivative.variant,
            AssetDerivative {
                local_path: relative_path,
                extension: sanitized_extension,
                created_at: derivative_created_at,
                updated_at: timestamp,
            },
        );
    }

    if let Some(next_metadata) = metadata {
        apply_metadata_update(asset, next_metadata);
    }
    asset.updated_at = timestamp;
    let updated = asset.clone();
    super::catalog::write_assets(root, &assets)?;
    Ok(updated)
}

pub fn update_metadata(
    root: &Path,
    asset_id: String,
    metadata: AssetMetadataUpdate,
) -> AppResult<Asset> {
    let mut assets = super::catalog::read_assets(root)?;
    let asset = assets
        .iter_mut()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| AppError::AssetNotFound(asset_id.clone()))?;

    apply_metadata_update(asset, metadata);
    asset.updated_at = super::now_millis();
    let updated = asset.clone();
    super::catalog::write_assets(root, &assets)?;
    Ok(updated)
}

pub fn resolve_asset_path(root: &Path, asset_id: String, variant: &str) -> AppResult<String> {
    let assets = super::catalog::read_assets(root)?;
    let asset = assets
        .iter()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| AppError::AssetNotFound(asset_id.clone()))?;

    let relative_path = resolve_relative_asset_path(asset, variant)?;

    Ok(existing_project_file(root, relative_path)?
        .to_string_lossy()
        .to_string())
}

fn resolve_relative_asset_path<'a>(asset: &'a Asset, variant: &str) -> AppResult<&'a str> {
    match variant {
        "original" => asset
            .local_path
            .as_deref()
            .ok_or_else(|| AppError::InvalidVariant("original missing for metadata asset".into())),
        "preview" => resolve_optional_derivative_path(asset, AssetDerivativeVariant::Preview),
        "waveform" => resolve_required_derivative_path(asset, AssetDerivativeVariant::Waveform),
        other => Err(AppError::InvalidVariant(other.to_string())),
    }
}

fn resolve_required_derivative_path<'a>(
    asset: &'a Asset,
    variant: AssetDerivativeVariant,
) -> AppResult<&'a str> {
    asset
        .derivatives
        .get(&variant)
        .map(|derivative| derivative.local_path.as_str())
        .ok_or_else(|| AppError::InvalidVariant(format!("{variant:?} missing")))
}

fn resolve_optional_derivative_path<'a>(
    asset: &'a Asset,
    variant: AssetDerivativeVariant,
) -> AppResult<&'a str> {
    if let Some(derivative) = asset.derivatives.get(&variant) {
        return Ok(derivative.local_path.as_str());
    }

    if asset.kind == AssetKind::Video {
        return Err(AppError::InvalidVariant(format!(
            "{variant:?} missing for video"
        )));
    }

    asset
        .local_path
        .as_deref()
        .ok_or_else(|| AppError::InvalidVariant(format!("{variant:?} missing")))
}

fn parse_derivative_variant(variant: &str) -> AppResult<AssetDerivativeVariant> {
    match variant {
        "preview" => Ok(AssetDerivativeVariant::Preview),
        "derived" => Ok(AssetDerivativeVariant::Derived),
        "waveform" => Ok(AssetDerivativeVariant::Waveform),
        other => Err(AppError::InvalidVariant(other.to_string())),
    }
}

fn derivative_relative_path(
    asset_id: &str,
    variant: &AssetDerivativeVariant,
    extension: &str,
) -> String {
    match variant {
        AssetDerivativeVariant::Preview => {
            format!("assets/previews/{asset_id}-preview.{extension}")
        }
        AssetDerivativeVariant::Derived => {
            format!("assets/derived/{asset_id}.{extension}")
        }
        AssetDerivativeVariant::Waveform => {
            format!("assets/waveforms/{asset_id}-waveform.{extension}")
        }
    }
}

fn sanitize_extension(extension: &str) -> AppResult<String> {
    let normalized = extension
        .trim()
        .trim_start_matches('.')
        .to_ascii_lowercase();
    match normalized.as_str() {
        "png" | "jpg" | "jpeg" | "webp" | "json" => Ok(normalized),
        other => Err(AppError::UnsupportedFormat(other.to_string())),
    }
}

fn decode_data_url(data_url: &str) -> AppResult<Vec<u8>> {
    let (_, payload) = data_url.split_once(',').ok_or(AppError::InvalidDataUrl)?;
    Ok(BASE64_STANDARD.decode(payload)?)
}

fn apply_metadata_update(asset: &mut Asset, metadata: AssetMetadataUpdate) {
    if metadata.width.is_some() {
        asset.width = metadata.width;
    }
    if metadata.height.is_some() {
        asset.height = metadata.height;
    }
    if metadata.duration.is_some() {
        asset.duration = metadata.duration;
    }
    if metadata.format.is_some() {
        asset.format = metadata.format;
    }
    if metadata.metadata.is_some() {
        asset.metadata = metadata.metadata;
    }
}
