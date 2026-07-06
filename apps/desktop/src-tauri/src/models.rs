use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const PROJECT_SCHEMA_VERSION: u32 = 4;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub root_path: String,
    pub board_path: String,
    pub assets_path: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardSnapshot {
    pub nodes: Vec<BoardNode>,
    pub assets: Vec<Asset>,
    pub viewport: Option<BoardViewport>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardNodesFile {
    #[serde(default = "current_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewport: Option<BoardViewport>,
    pub nodes: Vec<BoardNode>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardViewport {
    pub scale: f64,
    pub offset: BoardPoint,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetCatalogFile {
    #[serde(default = "current_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub updated_at: i64,
    #[serde(default)]
    pub assets: Vec<Asset>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardNode {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub node_type: String,
    pub asset_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Value>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub z_index: i64,
    pub locked: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Image,
    Video,
    Audio,
    Model,
    Text,
    Markdown,
    Html,
    Importing,
    Generating,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "lowercase")]
pub enum AssetDerivativeVariant {
    Preview,
    Derived,
    Waveform,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetDerivative {
    pub local_path: String,
    pub extension: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub type AssetDerivatives = BTreeMap<AssetDerivativeVariant, AssetDerivative>;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub kind: AssetKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    #[serde(default, skip_serializing_if = "asset_derivatives_is_empty")]
    pub derivatives: AssetDerivatives,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub oss_file_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub web_link: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetImportItemOutcome {
    pub ok: bool,
    pub index: usize,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<Asset>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetImportProgressEvent {
    pub batch_id: String,
    pub index: Option<usize>,
    pub path: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<Asset>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub imported_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_count: Option<usize>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetMetadataUpdate {
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub duration: Option<f64>,
    pub format: Option<String>,
    pub metadata: Option<Value>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetDerivativeBytesInput {
    pub variant: AssetDerivativeVariant,
    pub extension: String,
    pub bytes: Vec<u8>,
}

pub fn current_schema_version() -> u32 {
    PROJECT_SCHEMA_VERSION
}

fn asset_derivatives_is_empty(derivatives: &AssetDerivatives) -> bool {
    derivatives.is_empty()
}
