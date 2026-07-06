import type {
  Asset,
  AssetDerivativeVariant,
  AssetMetadataUpdate,
  AssetVariant,
  BoardNode,
  BoardSnapshot,
  BoardViewportSnapshot,
} from "@pixi-board/board-domain";

export type SaveDerivativeInput = {
  assetId: string;
  variant: AssetDerivativeVariant;
  extension: "webp" | "png" | "jpg" | "jpeg" | "json";
  dataUrl: string;
  metadata?: AssetMetadataUpdate;
};

export type AssetImportItemOutcome =
  | {
      ok: true;
      index: number;
      path: string;
      asset: Asset;
      error?: undefined;
    }
  | {
      ok: false;
      index: number;
      path: string;
      asset?: undefined;
      error: string;
    };

export type AssetImportProgressEvent =
  | {
      batchId: string;
      index: number;
      path: string;
      status: "imported";
      asset: Asset;
      error?: undefined;
      importedCount?: undefined;
      failedCount?: undefined;
    }
  | {
      batchId: string;
      index: number;
      path: string;
      status: "failed";
      asset?: undefined;
      error: string;
      importedCount?: undefined;
      failedCount?: undefined;
    }
  | {
      batchId: string;
      index?: undefined;
      path?: undefined;
      status: "complete";
      asset?: undefined;
      error?: undefined;
      importedCount: number;
      failedCount: number;
    };

export type AssetImportStreamCallbacks = {
  onImported?: (event: Extract<AssetImportProgressEvent, { status: "imported" }>) => void;
  onFailed?: (event: Extract<AssetImportProgressEvent, { status: "failed" }>) => void;
  onComplete?: (event: Extract<AssetImportProgressEvent, { status: "complete" }>) => void;
};

export type SaveDerivativeBytesInput = {
  variant: AssetDerivativeVariant;
  extension: "webp" | "png" | "jpg" | "jpeg" | "json";
  bytes: number[];
};

export type SaveDerivativesInput = {
  assetId: string;
  derivatives: SaveDerivativeBytesInput[];
  metadata?: AssetMetadataUpdate;
};

export interface BoardRepository {
  loadSnapshot(): Promise<BoardSnapshot>;
  saveBoardState(nodes: readonly BoardNode[], viewport: BoardViewportSnapshot): Promise<void>;
  startAssetImportBatch?(
    paths: string[],
    callbacks: AssetImportStreamCallbacks,
    signal?: AbortSignal,
  ): Promise<{ batchId: string; importedCount: number; failedCount: number }>;
  importAssetBatch(paths: string[]): Promise<AssetImportItemOutcome[]>;
  importAssets(paths: string[]): Promise<Asset[]>;
  upsertAssets(assets: Asset[]): Promise<Asset[]>;
  deleteAssets(assetIds: string[]): Promise<void>;
  resolveAssetUrl(assetId: string, variant: AssetVariant): Promise<string>;
  updateAssetMetadata(assetId: string, metadata: AssetMetadataUpdate): Promise<Asset>;
  saveDerivative(input: SaveDerivativeInput): Promise<Asset>;
  saveDerivatives(input: SaveDerivativesInput): Promise<Asset>;
  /** Copies the asset's original file into the system download directory; returns the saved path. */
  exportAsset(assetId: string): Promise<string>;
  revealProject(): Promise<void>;
  revealAsset(assetId: string): Promise<void>;
}
