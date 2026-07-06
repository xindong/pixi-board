use crate::error::{AppError, AppResult};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};

pub fn ensure_project_directories(root: &Path) -> AppResult<()> {
    fs::create_dir_all(root.join("assets/originals"))?;
    fs::create_dir_all(root.join("assets/previews"))?;
    fs::create_dir_all(root.join("assets/derived"))?;
    Ok(())
}

pub fn board_path(root: &Path) -> PathBuf {
    root.join("board.json")
}

pub fn assets_path(root: &Path) -> PathBuf {
    root.join("assets.json")
}

pub fn existing_project_file(root: &Path, relative_path: &str) -> AppResult<PathBuf> {
    let path = project_file(root, relative_path)?;
    let canonical_path = path.canonicalize()?;
    ensure_inside_project(root, &canonical_path)?;
    Ok(canonical_path)
}

pub fn remove_project_file(root: &Path, relative_path: &str) -> AppResult<()> {
    let path = project_file(root, relative_path)?;
    if let Err(error) = path.symlink_metadata() {
        if error.kind() == std::io::ErrorKind::NotFound {
            return Ok(());
        }
        return Err(error.into());
    }

    let canonical_path = path.canonicalize()?;
    ensure_inside_project(root, &canonical_path)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

pub fn writable_project_file(root: &Path, relative_path: &str) -> AppResult<PathBuf> {
    let path = project_file(root, relative_path)?;
    let parent = path
        .parent()
        .ok_or_else(|| AppError::Path(format!("missing parent for {}", path.display())))?;
    fs::create_dir_all(parent)?;
    let canonical_parent = parent.canonicalize()?;
    ensure_inside_project(root, &canonical_parent)?;
    Ok(path)
}

pub fn write_bytes(path: &Path, bytes: &[u8]) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::Path(format!("missing parent for {}", path.display())))?;
    fs::create_dir_all(parent)?;

    let mut temp_file = tempfile::NamedTempFile::new_in(parent)?;
    temp_file.write_all(bytes)?;
    temp_file.flush()?;
    temp_file.as_file().sync_all()?;
    temp_file
        .persist(path)
        .map_err(|error| AppError::Io(error.error))?;

    Ok(())
}

fn project_file(root: &Path, relative_path: &str) -> AppResult<PathBuf> {
    let relative = Path::new(relative_path);
    if relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )
        })
    {
        return Err(AppError::Path(format!(
            "path escapes project: {relative_path}"
        )));
    }

    Ok(root.join(relative))
}

fn ensure_inside_project(root: &Path, path: &Path) -> AppResult<()> {
    let canonical_root = root.canonicalize()?;
    if path.starts_with(&canonical_root) {
        return Ok(());
    }

    Err(AppError::Path(format!(
        "path outside project: {}",
        path.display()
    )))
}
