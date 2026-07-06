import type { Asset, BoardNode } from "@pixi-board/board-domain";
import {
  getAssetVisualKey as describeAssetVisualKey,
  getRenderableAssetVariant,
} from "@pixi-board/board-domain";
import {
  applyLoadingVisualToView,
  applyTextureToView,
  transitionTextureToView,
  updateGeneratingView,
  updateNodeView,
  type NodeView,
} from "./nodeView";
import { BoardTextureCache } from "./textureCache";

type NodeViewTextureBinderOptions = {
  isCurrentLoad: (view: NodeView, loadVersion: number) => boolean;
  isNodeRuntimeActive: (nodeId: string) => boolean;
  textureCache: BoardTextureCache;
};

export class NodeViewTextureBinder {
  private readonly isCurrentLoad: NodeViewTextureBinderOptions["isCurrentLoad"];
  private readonly isNodeRuntimeActive: NodeViewTextureBinderOptions["isNodeRuntimeActive"];
  private readonly textureCache: BoardTextureCache;

  constructor(options: NodeViewTextureBinderOptions) {
    this.isCurrentLoad = options.isCurrentLoad;
    this.isNodeRuntimeActive = options.isNodeRuntimeActive;
    this.textureCache = options.textureCache;
  }

  async bind(view: NodeView, asset: Asset | undefined): Promise<void> {
    const loadVersion = ++view.loadVersion;

    try {
      const nodeType = view.node.type;
      if (nodeType === "generating") {
        this.releaseViewTexture(view);
        updateGeneratingView(view);
        view.assetVisualKey = describeNodeVisualKey(view.node, asset);
        return;
      }

      if (!asset) {
        this.applyLoading(view, asset);
        return;
      }

      if (nodeType === "importing") {
        this.applyLoading(view, asset);
        return;
      }

      if (isMediaPreviewPending(asset, nodeType)) {
        this.applyLoading(view, asset);
        return;
      }

      const lease = await this.textureCache.acquire(asset, nodeType);

      if (!this.isCurrentLoad(view, loadVersion)) {
        this.textureCache.release(lease.key);
        return;
      }

      const previousTextureKey = view.textureKey;
      const nextVisualKey = describeNodeVisualKey(view.node, asset);
      view.assetVisualKey = nextVisualKey;
      if (previousTextureKey === lease.key) {
        this.textureCache.release(lease.key);
        updateNodeView(view);
        return;
      }

      const commitTextureLease = () => {
        view.textureKey = lease.key;
        if (previousTextureKey) {
          this.textureCache.release(previousTextureKey);
        }
      };

      if (!this.isNodeRuntimeActive(view.node.id)) {
        if (!view.sprite) {
          this.textureCache.release(lease.key);
        } else if (view.sprite.alpha > 0) {
          transitionTextureToView(view, lease.texture, 180, {
            onCancel: () => this.textureCache.release(lease.key),
            onComplete: commitTextureLease,
          });
        } else {
          applyTextureToView(view, lease.texture);
          commitTextureLease();
        }
      } else {
        this.textureCache.release(lease.key);
      }
      updateNodeView(view);
    } catch (error) {
      console.warn("Texture lease failed", error);
      const nodeType = view.node.type;
      if (asset && isMediaRenderer(nodeType, asset.kind)) {
        this.applyLoading(view, asset);
      }
    }
  }

  releaseViewTexture(view: NodeView): void {
    if (!view.textureKey) return;
    this.textureCache.release(view.textureKey);
    view.textureKey = undefined;
  }

  private applyLoading(view: NodeView, asset: Asset | undefined): void {
    this.releaseViewTexture(view);
    applyLoadingVisualToView(view);
    view.assetVisualKey = describeNodeVisualKey(view.node, asset);
  }
}

export function describeNodeVisualKey(node: BoardNode, asset: Asset | undefined): string {
  return [
    node.type,
    isTextLikeNodeType(node.type) ? `${Math.round(node.width)}x${Math.round(node.height)}` : "",
    JSON.stringify(node.options ?? {}),
    describeAssetVisualKey(asset),
  ].join(":");
}

function isTextLikeNodeType(nodeType: string): boolean {
  return nodeType === "text" || nodeType === "markdown" || nodeType === "html";
}

function isMediaPreviewPending(asset: Asset, nodeType: string): boolean {
  return isPreviewBackedNodeType(nodeType, asset.kind) && getRenderableAssetVariant(asset) === null;
}

function isPreviewBackedNodeType(nodeType: string, assetKind: string): boolean {
  return (
    nodeType === assetKind &&
    (assetKind === "image" ||
      assetKind === "video" ||
      assetKind === "model" ||
      assetKind === "text" ||
      assetKind === "markdown" ||
      assetKind === "html")
  );
}

function isMediaRenderer(nodeType: string, assetKind: string): boolean {
  return isPreviewBackedNodeType(nodeType, assetKind) || assetKind === "audio";
}
