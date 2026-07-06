mod catalog;
mod derivatives;
pub(crate) mod importer;

use crate::error::AppResult;
use crate::models::{Asset, AssetDerivativeBytesInput, AssetImportItemOutcome, AssetMetadataUpdate};
use crate::project_files::remove_project_file;
use std::collections::{BTreeSet, HashSet};
use std::path::PathBuf;

pub struct AssetStore {
    root: PathBuf,
}

impl AssetStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn read_assets(&self) -> AppResult<Vec<Asset>> {
        catalog::read_assets(&self.root)
    }

    pub fn write_assets(&self, assets: &[Asset]) -> AppResult<()> {
        catalog::write_assets(&self.root, assets)
    }

    pub fn upsert_assets(&self, next_assets: Vec<Asset>) -> AppResult<Vec<Asset>> {
        let mut assets = catalog::read_assets(&self.root)?;
        for next_asset in &next_assets {
            if let Some(existing) = assets.iter_mut().find(|asset| asset.id == next_asset.id) {
                *existing = next_asset.clone();
            } else {
                assets.push(next_asset.clone());
            }
        }
        catalog::write_assets(&self.root, &assets)?;
        Ok(next_assets)
    }

    pub fn delete_assets(&self, asset_ids: Vec<String>) -> AppResult<()> {
        if asset_ids.is_empty() {
            return Ok(());
        }

        let deleted_ids = asset_ids.into_iter().collect::<HashSet<_>>();
        let mut assets = catalog::read_assets(&self.root)?;
        let mut deleted_assets = Vec::new();
        assets.retain(|asset| {
            if deleted_ids.contains(&asset.id) {
                deleted_assets.push(asset.clone());
                false
            } else {
                true
            }
        });

        catalog::write_assets(&self.root, &assets)?;

        let mut delete_error = None;
        for asset in deleted_assets {
            for local_path in asset_file_paths(&asset) {
                if let Err(error) = remove_project_file(&self.root, &local_path) {
                    if delete_error.is_none() {
                        delete_error = Some(error);
                    }
                }
            }
        }

        if let Some(error) = delete_error {
            return Err(error);
        }
        Ok(())
    }

    pub fn import_asset_files(&self, paths: Vec<String>) -> AppResult<Vec<Asset>> {
        importer::import_asset_files(&self.root, paths)
    }

    pub fn import_asset_file_batch(
        &self,
        paths: Vec<String>,
    ) -> AppResult<Vec<AssetImportItemOutcome>> {
        importer::import_asset_file_batch(&self.root, paths)
    }

    pub fn save_derivative(
        &self,
        asset_id: String,
        variant: &str,
        extension: String,
        data_url: String,
        metadata: Option<AssetMetadataUpdate>,
    ) -> AppResult<Asset> {
        derivatives::save_derivative(&self.root, asset_id, variant, extension, data_url, metadata)
    }

    pub fn save_derivatives(
        &self,
        asset_id: String,
        derivatives: Vec<AssetDerivativeBytesInput>,
        metadata: Option<AssetMetadataUpdate>,
    ) -> AppResult<Asset> {
        derivatives::save_derivatives(&self.root, asset_id, derivatives, metadata)
    }

    pub fn update_metadata(
        &self,
        asset_id: String,
        metadata: AssetMetadataUpdate,
    ) -> AppResult<Asset> {
        derivatives::update_metadata(&self.root, asset_id, metadata)
    }

    pub fn resolve_asset_path(&self, asset_id: String, variant: &str) -> AppResult<String> {
        derivatives::resolve_asset_path(&self.root, asset_id, variant)
    }
}

pub(super) fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn asset_file_paths(asset: &Asset) -> BTreeSet<String> {
    let mut paths = BTreeSet::new();
    if let Some(local_path) = &asset.local_path {
        paths.insert(local_path.clone());
    }
    for derivative in asset.derivatives.values() {
        paths.insert(derivative.local_path.clone());
    }
    paths
}
