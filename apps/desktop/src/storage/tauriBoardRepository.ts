import type {
  Asset,
  AssetMetadataUpdate,
  AssetVariant,
  BoardNode,
  BoardSnapshot,
  BoardViewportSnapshot,
} from "@pixi-board/board-domain";
import {
  deleteAssets,
  exportAsset,
  importAssetFileBatch,
  importAssetFiles,
  listenAssetImportProgress,
  loadBoardSnapshot,
  resolveAssetUrl,
  revealAssetInFinder,
  revealProjectInFinder,
  saveAssetDerivative,
  saveAssetDerivatives,
  saveBoardState,
  startAssetImportBatch as startTauriAssetImportBatch,
  updateAssetMetadata,
  upsertAssets,
} from "../tauriBridge";
import { createId } from "../utils";
import type {
  AssetImportStreamCallbacks,
  BoardRepository,
  AssetImportItemOutcome,
  SaveDerivativeInput,
  SaveDerivativesInput,
} from "./boardRepository";

type TauriBoardRepositoryOptions = {
  projectRoot: string;
};

export class TauriBoardRepository implements BoardRepository {
  private readonly projectRoot: string;

  constructor(options: TauriBoardRepositoryOptions) {
    this.projectRoot = options.projectRoot;
  }

  loadSnapshot(): Promise<BoardSnapshot> {
    return loadBoardSnapshot(this.projectRoot);
  }

  saveBoardState(nodes: readonly BoardNode[], viewport: BoardViewportSnapshot): Promise<void> {
    return saveBoardState(this.projectRoot, nodes, viewport);
  }

  importAssets(paths: string[]): Promise<Asset[]> {
    return importAssetFiles(this.projectRoot, paths);
  }

  importAssetBatch(paths: string[]): Promise<AssetImportItemOutcome[]> {
    return importAssetFileBatch(this.projectRoot, paths);
  }

  async startAssetImportBatch(
    paths: string[],
    callbacks: AssetImportStreamCallbacks,
    signal?: AbortSignal,
  ): Promise<{ batchId: string; importedCount: number; failedCount: number }> {
    const batchId = createId("import_batch");
    if (paths.length === 0 || signal?.aborted) {
      return { batchId, importedCount: 0, failedCount: 0 };
    }

    let unlisten: (() => void) | undefined;
    let settled = false;
    let importedCount = 0;
    let failedCount = 0;

    return new Promise((resolve, reject) => {
      let handleAbort = () => {};
      const finish = (result: { importedCount: number; failedCount: number }) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", handleAbort);
        unlisten?.();
        resolve({ batchId, ...result });
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", handleAbort);
        unlisten?.();
        reject(error);
      };
      handleAbort = () => finish({ importedCount, failedCount });

      signal?.addEventListener("abort", handleAbort, { once: true });

      listenAssetImportProgress((event) => {
        if (settled || signal?.aborted || event.batchId !== batchId) return;

        if (event.status === "imported") {
          importedCount++;
          callbacks.onImported?.(event);
        } else if (event.status === "failed") {
          failedCount++;
          callbacks.onFailed?.(event);
        } else {
          importedCount = event.importedCount;
          failedCount = event.failedCount;
          callbacks.onComplete?.(event);
          finish({ importedCount, failedCount });
        }
      })
        .then((listener) => {
          if (settled) {
            listener();
            return;
          }
          unlisten = listener;
          return startTauriAssetImportBatch(this.projectRoot, batchId, paths);
        })
        .then(() => {
          if (paths.length === 0) {
            finish({ importedCount: 0, failedCount: 0 });
          }
        })
        .catch(fail);
    });
  }

  upsertAssets(assets: Asset[]): Promise<Asset[]> {
    return upsertAssets(this.projectRoot, assets);
  }

  deleteAssets(assetIds: string[]): Promise<void> {
    return deleteAssets(this.projectRoot, assetIds);
  }

  resolveAssetUrl(assetId: string, variant: AssetVariant): Promise<string> {
    return resolveAssetUrl(this.projectRoot, assetId, variant);
  }

  updateAssetMetadata(assetId: string, metadata: AssetMetadataUpdate): Promise<Asset> {
    return updateAssetMetadata(this.projectRoot, assetId, metadata);
  }

  saveDerivative(input: SaveDerivativeInput): Promise<Asset> {
    return saveAssetDerivative(
      this.projectRoot,
      input.assetId,
      input.variant,
      input.extension,
      input.dataUrl,
      input.metadata,
    );
  }

  saveDerivatives(input: SaveDerivativesInput): Promise<Asset> {
    return saveAssetDerivatives(this.projectRoot, input.assetId, input.derivatives, input.metadata);
  }

  exportAsset(assetId: string): Promise<string> {
    return exportAsset(this.projectRoot, assetId);
  }

  revealProject(): Promise<void> {
    return revealProjectInFinder(this.projectRoot);
  }

  revealAsset(assetId: string): Promise<void> {
    return revealAssetInFinder(this.projectRoot, assetId);
  }
}
