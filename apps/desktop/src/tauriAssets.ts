import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Asset,
  AssetDerivativeVariant,
  AssetMetadataUpdate,
  AssetVariant,
} from "@pixi-board/board-domain";
import type {
  AssetImportItemOutcome,
  AssetImportProgressEvent,
  SaveDerivativeBytesInput,
} from "./storage/boardRepository";

const ASSET_IMPORT_PROGRESS_EVENT = "asset-import-progress";

export async function importAssetFiles(projectRoot: string, paths: string[]): Promise<Asset[]> {
  if (paths.length === 0) return [];
  return invoke<Asset[]>("import_asset_files", { projectRoot, paths });
}

export async function importAssetFileBatch(
  projectRoot: string,
  paths: string[],
): Promise<AssetImportItemOutcome[]> {
  if (paths.length === 0) return [];
  return invoke<AssetImportItemOutcome[]>("import_asset_file_batch", { projectRoot, paths });
}

export async function startAssetImportBatch(
  projectRoot: string,
  batchId: string,
  paths: string[],
): Promise<string> {
  return invoke<string>("start_asset_import_batch", { projectRoot, batchId, paths });
}

export function listenAssetImportProgress(
  handler: (event: AssetImportProgressEvent) => void,
): Promise<() => void> {
  return listen<AssetImportProgressEvent>(ASSET_IMPORT_PROGRESS_EVENT, (event) =>
    handler(event.payload),
  );
}

export async function upsertAssets(projectRoot: string, assets: Asset[]): Promise<Asset[]> {
  if (assets.length === 0) return [];
  return invoke<Asset[]>("upsert_assets", { projectRoot, assets });
}

export async function deleteAssets(projectRoot: string, assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return;
  await invoke("delete_assets", { projectRoot, assetIds });
}

export async function saveAssetDerivative(
  projectRoot: string,
  assetId: string,
  variant: AssetDerivativeVariant,
  extension: "webp" | "png" | "jpg" | "jpeg" | "json",
  dataUrl: string,
  metadata?: AssetMetadataUpdate,
): Promise<Asset> {
  return invoke<Asset>("save_asset_derivative", {
    projectRoot,
    assetId,
    variant,
    extension,
    dataUrl,
    metadata: metadata ?? null,
  });
}

export async function saveAssetDerivatives(
  projectRoot: string,
  assetId: string,
  derivatives: SaveDerivativeBytesInput[],
  metadata?: AssetMetadataUpdate,
): Promise<Asset> {
  return invoke<Asset>("save_asset_derivatives", {
    projectRoot,
    assetId,
    derivatives,
    metadata: metadata ?? null,
  });
}

export async function updateAssetMetadata(
  projectRoot: string,
  assetId: string,
  metadata: AssetMetadataUpdate,
): Promise<Asset> {
  return invoke<Asset>("update_asset_metadata", {
    projectRoot,
    assetId,
    metadata,
  });
}

export async function resolveAssetUrl(
  projectRoot: string,
  assetId: string,
  variant: AssetVariant,
): Promise<string> {
  const absolutePath = await invoke<string>("resolve_asset_url", { projectRoot, assetId, variant });
  return convertFileSrc(absolutePath);
}

export async function exportAsset(projectRoot: string, assetId: string): Promise<string> {
  return invoke<string>("export_asset", { projectRoot, assetId });
}

export async function revealAssetInFinder(projectRoot: string, assetId: string): Promise<void> {
  await invoke("reveal_asset_in_finder", { projectRoot, assetId });
}
