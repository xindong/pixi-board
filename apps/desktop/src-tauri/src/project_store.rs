use crate::asset_store::AssetStore;
use crate::error::{AppError, AppResult};
use crate::models::{
    current_schema_version, Asset, AssetDerivativeBytesInput, AssetImportItemOutcome,
    AssetMetadataUpdate, BoardNode, BoardNodesFile, BoardSnapshot, BoardViewport, ProjectInfo,
};
use crate::project_files::{assets_path, board_path, ensure_project_directories, write_bytes};
use std::fs;
use std::path::{Path, PathBuf};

pub struct ProjectStore {
    root: PathBuf,
}

impl ProjectStore {
    pub fn open(root: PathBuf) -> AppResult<Self> {
        initialize_project(&root)?;
        let canonical_root = root.canonicalize()?;
        Ok(Self {
            root: canonical_root,
        })
    }

    pub fn from_root(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn info(&self) -> ProjectInfo {
        ProjectInfo {
            name: self
                .root
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("canvas")
                .to_string(),
            root_path: self.root.to_string_lossy().to_string(),
            board_path: board_path(&self.root).to_string_lossy().to_string(),
            assets_path: assets_path(&self.root).to_string_lossy().to_string(),
        }
    }

    pub fn load_snapshot(&self) -> AppResult<BoardSnapshot> {
        let board = read_board(&self.root)?;
        Ok(BoardSnapshot {
            nodes: board.nodes,
            assets: AssetStore::new(self.root.clone()).read_assets()?,
            viewport: board.viewport,
        })
    }

    pub fn save_board_state(
        &self,
        nodes: Vec<BoardNode>,
        viewport: Option<BoardViewport>,
    ) -> AppResult<()> {
        write_json(
            &board_path(&self.root),
            &BoardNodesFile {
                schema_version: current_schema_version(),
                updated_at: now_millis(),
                viewport,
                nodes,
            },
        )
    }

    pub fn import_asset_files(&self, paths: Vec<String>) -> AppResult<Vec<Asset>> {
        AssetStore::new(self.root.clone()).import_asset_files(paths)
    }

    pub fn import_asset_file_batch(
        &self,
        paths: Vec<String>,
    ) -> AppResult<Vec<AssetImportItemOutcome>> {
        AssetStore::new(self.root.clone()).import_asset_file_batch(paths)
    }

    pub fn upsert_assets(&self, assets: Vec<Asset>) -> AppResult<Vec<Asset>> {
        AssetStore::new(self.root.clone()).upsert_assets(assets)
    }

    pub fn delete_assets(&self, asset_ids: Vec<String>) -> AppResult<()> {
        AssetStore::new(self.root.clone()).delete_assets(asset_ids)
    }

    pub fn save_asset_derivative(
        &self,
        asset_id: String,
        variant: &str,
        extension: String,
        data_url: String,
        metadata: Option<AssetMetadataUpdate>,
    ) -> AppResult<Asset> {
        AssetStore::new(self.root.clone())
            .save_derivative(asset_id, variant, extension, data_url, metadata)
    }

    pub fn save_asset_derivatives(
        &self,
        asset_id: String,
        derivatives: Vec<AssetDerivativeBytesInput>,
        metadata: Option<AssetMetadataUpdate>,
    ) -> AppResult<Asset> {
        AssetStore::new(self.root.clone()).save_derivatives(asset_id, derivatives, metadata)
    }

    pub fn update_asset_metadata(
        &self,
        asset_id: String,
        metadata: AssetMetadataUpdate,
    ) -> AppResult<Asset> {
        AssetStore::new(self.root.clone()).update_metadata(asset_id, metadata)
    }

    pub fn resolve_asset_path(&self, asset_id: String, variant: &str) -> AppResult<String> {
        AssetStore::new(self.root.clone()).resolve_asset_path(asset_id, variant)
    }

    pub fn export_asset(&self, asset_id: String, download_dir: PathBuf) -> AppResult<String> {
        let source = PathBuf::from(self.resolve_asset_path(asset_id, "original")?);
        let file_name = source
            .file_name()
            .ok_or_else(|| AppError::Path("asset has no file name".into()))?;
        fs::create_dir_all(&download_dir)?;
        let dest = unique_destination(&download_dir, Path::new(file_name));
        fs::copy(&source, &dest)?;
        Ok(dest.to_string_lossy().to_string())
    }
}

fn unique_destination(dir: &Path, file_name: &Path) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = file_name
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    let ext = file_name.extension().and_then(|value| value.to_str());

    let mut counter = 1;
    loop {
        let name = match ext {
            Some(ext) => format!("{stem} ({counter}).{ext}"),
            None => format!("{stem} ({counter})"),
        };
        let candidate = dir.join(name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

fn initialize_project(root: &Path) -> AppResult<()> {
    ensure_project_directories(root)?;

    if !board_path(root).exists() {
        write_json(
            &board_path(root),
            &BoardNodesFile {
                schema_version: current_schema_version(),
                updated_at: now_millis(),
                viewport: None,
                nodes: Vec::new(),
            },
        )?;
    }
    if !assets_path(root).exists() {
        AssetStore::new(root.to_path_buf()).write_assets(&[])?;
    }

    Ok(())
}

fn read_board(root: &Path) -> AppResult<BoardNodesFile> {
    let text = fs::read_to_string(board_path(root))?;
    Ok(serde_json::from_str(&text)?)
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let text = format!("{}\n", serde_json::to_string_pretty(value)?);
    write_bytes(path, text.as_bytes())
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        AssetDerivativeBytesInput, AssetDerivativeVariant, AssetKind, PROJECT_SCHEMA_VERSION,
    };
    use tempfile::tempdir;

    #[test]
    fn open_initializes_schema_versioned_files() {
        let temp = tempdir().unwrap();
        let root = temp.path().join("project");

        let store = ProjectStore::open(root.clone()).unwrap();
        let snapshot = store.load_snapshot().unwrap();

        assert!(snapshot.nodes.is_empty());
        assert!(snapshot.assets.is_empty());

        let board_text = fs::read_to_string(board_path(store.root())).unwrap();
        assert!(board_text.contains("\"schemaVersion\": 4"));

        let assets_text = fs::read_to_string(assets_path(store.root())).unwrap();
        assert!(assets_text.contains("\"schemaVersion\": 4"));
        assert_eq!(PROJECT_SCHEMA_VERSION, 4);
    }

    #[test]
    fn import_asset_files_deduplicates_by_hash() {
        let temp = tempdir().unwrap();
        let source_a = temp.path().join("a.png");
        let source_b = temp.path().join("b.png");
        fs::write(&source_a, b"same-image-bytes").unwrap();
        fs::write(&source_b, b"same-image-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![
                source_a.to_string_lossy().to_string(),
                source_b.to_string_lossy().to_string(),
            ])
            .unwrap();

        assert_eq!(imported.len(), 2);
        assert_eq!(imported[0].id, imported[1].id);

        let snapshot = store.load_snapshot().unwrap();
        assert_eq!(snapshot.assets.len(), 1);
        assert!(store
            .root()
            .join(snapshot.assets[0].local_path.as_ref().unwrap())
            .exists());
    }

    #[test]
    fn import_asset_file_batch_preserves_order_and_deduplicates_by_hash() {
        let temp = tempdir().unwrap();
        let source_a = temp.path().join("a.png");
        let source_b = temp.path().join("b.png");
        let source_c = temp.path().join("c.jpg");
        fs::write(&source_a, b"same-image-bytes").unwrap();
        fs::write(&source_b, b"same-image-bytes").unwrap();
        fs::write(&source_c, b"different-image-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let outcomes = store
            .import_asset_file_batch(vec![
                source_c.to_string_lossy().to_string(),
                source_a.to_string_lossy().to_string(),
                source_b.to_string_lossy().to_string(),
            ])
            .unwrap();

        assert_eq!(outcomes.len(), 3);
        assert_eq!(outcomes[0].index, 0);
        assert_eq!(outcomes[1].index, 1);
        assert_eq!(outcomes[2].index, 2);
        assert!(outcomes.iter().all(|outcome| outcome.ok));
        assert_ne!(
            outcomes[0].asset.as_ref().unwrap().id,
            outcomes[1].asset.as_ref().unwrap().id
        );
        assert_eq!(
            outcomes[1].asset.as_ref().unwrap().id,
            outcomes[2].asset.as_ref().unwrap().id
        );

        let snapshot = store.load_snapshot().unwrap();
        assert_eq!(snapshot.assets.len(), 2);
    }

    #[test]
    fn import_asset_file_batch_keeps_successful_items_when_one_fails() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("a.png");
        let unsupported = temp.path().join("notes.pdf");
        fs::write(&source, b"image-bytes").unwrap();
        fs::write(&unsupported, b"text").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let outcomes = store
            .import_asset_file_batch(vec![
                source.to_string_lossy().to_string(),
                unsupported.to_string_lossy().to_string(),
            ])
            .unwrap();

        assert_eq!(outcomes.len(), 2);
        assert!(outcomes[0].ok);
        assert!(outcomes[0].asset.is_some());
        assert!(!outcomes[1].ok);
        assert!(outcomes[1]
            .error
            .as_deref()
            .unwrap_or_default()
            .contains("Unsupported media format"));

        let snapshot = store.load_snapshot().unwrap();
        assert_eq!(snapshot.assets.len(), 1);
    }

    #[test]
    fn import_text_markdown_and_html_files_as_source_backed_assets() {
        let temp = tempdir().unwrap();
        let text = temp.path().join("notes.txt");
        let markdown = temp.path().join("brief.md");
        let html = temp.path().join("card.html");
        fs::write(&text, "plain text").unwrap();
        fs::write(&markdown, "# Title\n\nBody").unwrap();
        fs::write(&html, "<h1>Hello</h1>").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![
                text.to_string_lossy().to_string(),
                markdown.to_string_lossy().to_string(),
                html.to_string_lossy().to_string(),
            ])
            .unwrap();

        assert_eq!(imported[0].kind, AssetKind::Text);
        assert!(imported[0].metadata.is_none());
        assert_eq!(imported[1].kind, AssetKind::Markdown);
        assert!(imported[1].metadata.is_none());
        assert_eq!(imported[2].kind, AssetKind::Html);
        assert!(imported[2].metadata.is_none());
    }

    #[test]
    fn save_asset_derivative_updates_catalog_and_resolves_preview() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("clip.mp4");
        fs::write(&source, b"video-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![source.to_string_lossy().to_string()])
            .unwrap();
        let asset = imported.first().unwrap();

        let updated = store
            .save_asset_derivative(
                asset.id.clone(),
                "preview",
                "png".into(),
                "data:image/png;base64,aGVsbG8=".into(),
                Some(AssetMetadataUpdate {
                    width: Some(1920.0),
                    height: Some(1080.0),
                    duration: Some(12.5),
                    format: None,
                    metadata: None,
                }),
            )
            .unwrap();

        let preview_derivative = updated
            .derivatives
            .get(&AssetDerivativeVariant::Preview)
            .unwrap();
        assert_eq!(preview_derivative.extension, "png");
        assert_eq!(updated.width, Some(1920.0));
        assert_eq!(updated.height, Some(1080.0));
        assert_eq!(updated.duration, Some(12.5));

        let preview_path = store
            .resolve_asset_path(updated.id.clone(), "preview")
            .unwrap();
        assert!(Path::new(&preview_path).exists());

        let snapshot = store.load_snapshot().unwrap();
        assert_eq!(
            snapshot.assets[0]
                .derivatives
                .get(&AssetDerivativeVariant::Preview)
                .unwrap()
                .local_path,
            preview_derivative.local_path
        );
    }

    #[test]
    fn save_asset_derivatives_updates_catalog_once_from_binary_payloads() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("clip.mp4");
        fs::write(&source, b"video-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![source.to_string_lossy().to_string()])
            .unwrap();
        let asset = imported.first().unwrap();

        let updated = store
            .save_asset_derivatives(
                asset.id.clone(),
                vec![AssetDerivativeBytesInput {
                    variant: AssetDerivativeVariant::Preview,
                    extension: "webp".into(),
                    bytes: vec![1, 2, 3],
                }],
                Some(AssetMetadataUpdate {
                    width: Some(1920.0),
                    height: Some(1080.0),
                    duration: Some(12.5),
                    format: None,
                    metadata: None,
                }),
            )
            .unwrap();

        let preview_derivative = updated
            .derivatives
            .get(&AssetDerivativeVariant::Preview)
            .unwrap();
        assert_eq!(preview_derivative.extension, "webp");
        assert_eq!(updated.width, Some(1920.0));
        assert_eq!(updated.height, Some(1080.0));
        assert_eq!(updated.duration, Some(12.5));

        let preview_path = store
            .resolve_asset_path(updated.id.clone(), "preview")
            .unwrap();
        assert_eq!(fs::read(preview_path).unwrap(), vec![1, 2, 3]);
    }

    #[test]
    fn delete_assets_removes_catalog_entries_and_files() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("clip.mp4");
        fs::write(&source, b"video-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![source.to_string_lossy().to_string()])
            .unwrap();
        let asset = imported.first().unwrap();
        let original_path = store
            .root()
            .join(asset.local_path.as_ref().unwrap());

        let updated = store
            .save_asset_derivatives(
                asset.id.clone(),
                vec![AssetDerivativeBytesInput {
                    variant: AssetDerivativeVariant::Preview,
                    extension: "webp".into(),
                    bytes: vec![1, 2, 3],
                }],
                None,
            )
            .unwrap();
        let preview_path = store.root().join(
            &updated
                .derivatives
                .get(&AssetDerivativeVariant::Preview)
                .unwrap()
                .local_path,
        );

        assert!(original_path.exists());
        assert!(preview_path.exists());

        store.delete_assets(vec![asset.id.clone()]).unwrap();

        let snapshot = store.load_snapshot().unwrap();
        assert!(snapshot.assets.is_empty());
        assert!(!original_path.exists());
        assert!(!preview_path.exists());
    }

    #[test]
    fn resolve_video_thumbnail_does_not_fallback_to_original() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("clip.mp4");
        fs::write(&source, b"video-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![source.to_string_lossy().to_string()])
            .unwrap();
        let asset = imported.first().unwrap();

        let error = store
            .resolve_asset_path(asset.id.clone(), "preview")
            .expect_err("missing video preview should not resolve to original");

        assert!(error.to_string().contains("missing for video"));
    }

    #[test]
    fn update_asset_metadata_updates_catalog_without_rewriting_derivatives() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("track.mp3");
        fs::write(&source, b"audio-bytes").unwrap();

        let store = ProjectStore::open(temp.path().join("project")).unwrap();
        let imported = store
            .import_asset_files(vec![source.to_string_lossy().to_string()])
            .unwrap();
        let asset = imported.first().unwrap();

        let updated = store
            .update_asset_metadata(
                asset.id.clone(),
                AssetMetadataUpdate {
                    width: Some(640.0),
                    height: Some(420.0),
                    duration: None,
                    format: None,
                    metadata: None,
                },
            )
            .unwrap();

        assert_eq!(updated.width, Some(640.0));
        assert_eq!(updated.height, Some(420.0));
        assert!(updated.derivatives.is_empty());

        let snapshot = store.load_snapshot().unwrap();
        assert_eq!(snapshot.assets[0].width, Some(640.0));
        assert_eq!(snapshot.assets[0].height, Some(420.0));
    }
}
