import type {
  Asset,
  AssetMetadataUpdate,
  AssetVariant,
  BoardNode,
  BoardSnapshot,
  BoardViewportSnapshot,
} from "@pixi-board/board-domain";
import type {
  AssetImportItemOutcome,
  BoardRepository,
  SaveDerivativeInput,
  SaveDerivativesInput,
} from "./boardRepository";

export class BrowserBoardRepository implements BoardRepository {
  private snapshot: BoardSnapshot = {
    nodes: [],
    assets: [],
  };

  async loadSnapshot(): Promise<BoardSnapshot> {
    return structuredClone(this.snapshot);
  }

  async saveBoardState(nodes: readonly BoardNode[], viewport: BoardViewportSnapshot): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      nodes: [...structuredClone(nodes)],
      viewport: structuredClone(viewport),
    };
  }

  async importAssets(_paths: string[]): Promise<Asset[]> {
    throw new Error("Asset import is only available in the Tauri desktop runtime");
  }

  async importAssetBatch(_paths: string[]): Promise<AssetImportItemOutcome[]> {
    throw new Error("Asset import is only available in the Tauri desktop runtime");
  }

  async upsertAssets(assets: Asset[]): Promise<Asset[]> {
    for (const asset of assets) {
      const index = this.snapshot.assets.findIndex((entry) => entry.id === asset.id);
      if (index >= 0) {
        this.snapshot.assets[index] = structuredClone(asset);
      } else {
        this.snapshot.assets.push(structuredClone(asset));
      }
    }
    return structuredClone(assets);
  }

  async deleteAssets(assetIds: string[]): Promise<void> {
    const deleted = new Set(assetIds);
    this.snapshot.assets = this.snapshot.assets.filter((asset) => !deleted.has(asset.id));
  }

  async resolveAssetUrl(assetId: string, _variant: AssetVariant): Promise<string> {
    throw new Error(`Asset URLs are unavailable in browser mode for ${assetId}`);
  }

  async updateAssetMetadata(assetId: string, metadata: AssetMetadataUpdate): Promise<Asset> {
    const asset = this.snapshot.assets.find((entry) => entry.id === assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} is unavailable in browser mode`);
    }

    if (metadata.width !== undefined) {
      asset.width = metadata.width;
    }
    if (metadata.height !== undefined) {
      asset.height = metadata.height;
    }
    if (metadata.duration !== undefined) {
      asset.duration = metadata.duration;
    }
    if (metadata.format !== undefined) {
      asset.format = metadata.format;
    }
    if (metadata.metadata !== undefined) {
      asset.metadata = structuredClone(metadata.metadata);
    }
    asset.updatedAt = Date.now();

    return structuredClone(asset);
  }

  async saveDerivative(_input: SaveDerivativeInput): Promise<Asset> {
    throw new Error("Asset derivatives are only available in the Tauri desktop runtime");
  }

  async saveDerivatives(_input: SaveDerivativesInput): Promise<Asset> {
    throw new Error("Asset derivatives are only available in the Tauri desktop runtime");
  }

  async exportAsset(assetId: string): Promise<string> {
    throw new Error(`Download is only available in the Tauri desktop runtime for ${assetId}`);
  }

  async revealProject(): Promise<void> {
    throw new Error("Finder integration is only available in the Tauri desktop runtime");
  }

  async revealAsset(assetId: string): Promise<void> {
    throw new Error(`Finder integration is only available in the Tauri desktop runtime for ${assetId}`);
  }
}
