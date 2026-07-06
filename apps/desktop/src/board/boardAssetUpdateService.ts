import type { Asset } from "@pixi-board/board-domain";
import type { BoardEditor } from "./boardEditor";
import type { BoardRepository } from "../storage/boardRepository";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardUpdateAssetInput } from "./boardWriteTypes";
import type { BoardViewport } from "./boardViewport";

const CONTENT_METADATA_KEYS = ["html", "markdown", "text", "content"] as const;

type BoardAssetUpdateServiceOptions = {
  editor: BoardEditor;
  repository: BoardRepository;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

export class BoardAssetUpdateService {
  private readonly editor: BoardEditor;
  private readonly repository: BoardRepository;
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;

  constructor(options: BoardAssetUpdateServiceOptions) {
    this.editor = options.editor;
    this.repository = options.repository;
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  async updateAssets(updates: BoardUpdateAssetInput[]): Promise<Asset[]> {
    const updatedAssets: Asset[] = [];
    for (const update of updates) {
      assertNoContentMetadata(update.metadata);
      const { id, ...metadata } = update;
      const updated = await this.repository.updateAssetMetadata(id, metadata);
      updatedAssets.push(updated);
    }

    this.editor.upsertAssets(updatedAssets);
    this.refreshNodesForAssets(updatedAssets);
    return updatedAssets;
  }

  private refreshNodesForAssets(assets: Asset[]): void {
    const updatedAssetIds = new Set(assets.map((asset) => asset.id));
    for (const node of this.store.getNodes()) {
      if (updatedAssetIds.has(node.assetId)) {
        this.scene.refreshNodeAsset(this.store, node.id, this.viewport);
      }
    }
  }
}

function assertNoContentMetadata(metadata: Record<string, unknown> | undefined): void {
  if (!metadata) return;
  for (const key of CONTENT_METADATA_KEYS) {
    if (metadata[key] !== undefined) {
      throw new Error(`Asset metadata.${key} is not supported; edit the source file instead`);
    }
  }
}
