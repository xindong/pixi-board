import type { Asset, BoardNode } from "@pixi-board/board-domain";
import {
  AssetPreviewPipeline,
  canPrepareAssetPreview,
} from "../assets/assetPreviewPipeline";
import type { AssetPreviewJobRunner } from "../assets/assetPreviewJobRunner";
import { isTextLikeAssetKind } from "../assets/textLikePreviewRenderer";
import type { BoardRepository } from "../storage/boardRepository";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardScene } from "./boardScene";
import { updatedNodesPatch } from "./boardScenePatch";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

type BoardPreviewServiceOptions = {
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null, options?: { scheduleSave?: boolean }) => void;
  previewRunner?: AssetPreviewJobRunner;
  repository: BoardRepository;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

type BoardPreviewRefreshResult = {
  nodes: BoardNode[];
  assets?: Asset[];
};

export class BoardPreviewService {
  private readonly editor: BoardEditor;
  private readonly onMutation: BoardPreviewServiceOptions["onMutation"];
  private readonly previews: AssetPreviewPipeline;
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;

  constructor(options: BoardPreviewServiceOptions) {
    this.editor = options.editor;
    this.onMutation = options.onMutation;
    this.previews = new AssetPreviewPipeline(options.repository, {
      runner: options.previewRunner,
    });
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  async refreshNodePreview(nodeId: string): Promise<BoardPreviewRefreshResult> {
    const node = this.requireNode(nodeId);
    const asset = this.requirePreviewableAsset(node);

    const updatedAsset = await this.previews.prepareAsset(asset, {
      force: true,
      priority: "user",
      refreshPreviewOnly: true,
      size: {
        width: node.width,
        height: node.height,
      },
    });
    this.editor.upsertAssets([updatedAsset]);
    const resizedNode = this.expandDocumentNodeToPreviewHeight(node.id, updatedAsset);
    this.scene.refreshNodeAsset(this.store, node.id, this.viewport);
    return {
      nodes: [resizedNode ?? this.store.getNode(node.id) ?? node],
      assets: [updatedAsset],
    };
  }

  async refreshCreatedNodePreviews(nodes: BoardNode[]): Promise<Asset[]> {
    const refreshedAssets: Asset[] = [];
    for (const node of nodes) {
      const asset = this.store.getAsset(node.assetId);
      if (!asset || !isTextLikeAssetKind(asset.kind)) continue;
      const result = await this.refreshNodePreview(node.id);
      if (result.assets) {
        refreshedAssets.push(...result.assets);
      }
    }
    return refreshedAssets;
  }

  private requireNode(nodeId: string): BoardNode {
    const node = this.store.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} does not exist`);
    }
    return node;
  }

  private requirePreviewableAsset(node: BoardNode): Asset {
    const asset = this.store.getAsset(node.assetId);
    if (!asset) {
      throw new Error(`Asset ${node.assetId} does not exist`);
    }
    if (!canPrepareAssetPreview(asset)) {
      throw new Error(`Node ${node.id} asset ${asset.id} does not support preview refresh`);
    }
    return asset;
  }

  private expandDocumentNodeToPreviewHeight(
    nodeId: string,
    asset: Asset,
  ): BoardNode | undefined {
    if (asset.kind !== "markdown" && asset.kind !== "text") {
      return this.store.getNode(nodeId);
    }

    const node = this.store.getNode(nodeId);
    const previewHeight =
      positiveNumber(asset.height) ?? positiveNumber(asset.metadata?.previewHeight);
    if (!node || !previewHeight || previewHeight <= node.height + 0.5) {
      return node;
    }

    this.store.updateNodes([
      {
        id: node.id,
        height: previewHeight,
      },
    ]);
    this.onMutation(
      {
        label: "Fit document preview",
        scenePatch: updatedNodesPatch([node.id]),
      },
      { scheduleSave: false },
    );
    return this.store.getNode(node.id);
  }
}

export function canRefreshNodePreview(
  node: BoardNode,
  asset: Asset | undefined,
): boolean {
  return Boolean(asset && node.assetId === asset.id && canPrepareAssetPreview(asset));
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
