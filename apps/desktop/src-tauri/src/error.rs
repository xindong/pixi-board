use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("No project is open")]
    NoProject,
    #[error("Unsupported media format: {0}")]
    UnsupportedFormat(String),
    #[error("Asset not found: {0}")]
    AssetNotFound(String),
    #[error("Invalid asset variant: {0}")]
    InvalidVariant(String),
    #[error("Invalid data URL")]
    InvalidDataUrl,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Path error: {0}")]
    Path(String),
    #[error("Base64 error: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("Task error: {0}")]
    Task(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;
