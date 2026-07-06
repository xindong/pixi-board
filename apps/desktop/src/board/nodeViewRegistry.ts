import { Container } from "../pixi";
import type { FederatedPointerEvent } from "../pixi";
import type { BoardNode } from "@pixi-board/board-domain";
import { BoardStore } from "./boardStore";
import {
  animateGeneratingView,
  createNodeView,
  destroyNodeView,
  updateGeneratingView,
  updateNodeView,
  type NodeView,
} from "./nodeView";
import { BoardTextureCache } from "./textureCache";
import { NodeViewDisposalQueue } from "./nodeViewDisposalQueue";
import { describeNodeVisualKey, NodeViewTextureBinder } from "./nodeViewTextureBinder";

const OFFSCREEN_VIEW_DISPOSE_DELAY_MS = 1_500;
const TEXTURE_UNLOAD_DELAY_MS = 1_500;
const VIEWPORT_PADDING = 900;
const GENERATING_PHASE_SPEED = 0.006;

type NodeViewRegistryOptions = {
  layer: Container;
  onNodePointerDown: (event: FederatedPointerEvent, nodeId: string) => void;
  onNodeRuntimeDispose: (nodeId: string) => void;
  isNodeRuntimeActive: (nodeId: string) => boolean;
  resolveAssetUrl: ConstructorParameters<typeof BoardTextureCache>[0]["resolveAssetUrl"];
};

export class NodeViewRegistry {
  private readonly layer: Container;
  private readonly textureCache: BoardTextureCache;
  private readonly textureBinder: NodeViewTextureBinder;
  private readonly disposalQueue: NodeViewDisposalQueue;
  private readonly nodeViews = new Map<string, NodeView>();
  private readonly onNodeRuntimeDispose: NodeViewRegistryOptions["onNodeRuntimeDispose"];
  private readonly isNodeRuntimeActive: NodeViewRegistryOptions["isNodeRuntimeActive"];
  private onNodePointerDown: NodeViewRegistryOptions["onNodePointerDown"];
  private visibleGeneratingIds = new Set<string>();
  private generatingPhase = 0;

  constructor(options: NodeViewRegistryOptions) {
    this.layer = options.layer;
    this.onNodePointerDown = options.onNodePointerDown;
    this.onNodeRuntimeDispose = options.onNodeRuntimeDispose;
    this.isNodeRuntimeActive = options.isNodeRuntimeActive;
    this.textureCache = new BoardTextureCache({
      resolveAssetUrl: options.resolveAssetUrl,
      unloadDelayMs: TEXTURE_UNLOAD_DELAY_MS,
    });
    this.disposalQueue = new NodeViewDisposalQueue({
      delayMs: OFFSCREEN_VIEW_DISPOSE_DELAY_MS,
      dispose: (nodeId) => this.disposeNodeView(nodeId),
    });
    this.textureBinder = new NodeViewTextureBinder({
      isCurrentLoad: (view, loadVersion) => this.isCurrentLoad(view, loadVersion),
      isNodeRuntimeActive: (nodeId) => this.isNodeRuntimeActive(nodeId),
      textureCache: this.textureCache,
    });
  }

  setNodePointerDownHandler(handler: NodeViewRegistryOptions["onNodePointerDown"]): void {
    this.onNodePointerDown = handler;
  }

  getView(nodeId: string): NodeView | undefined {
    return this.nodeViews.get(nodeId);
  }

  syncData(store: BoardStore, visibleIds: string[]): Set<string> {
    for (const id of [...this.nodeViews.keys()]) {
      if (!store.getNode(id)) {
        this.disposeNodeView(id);
      }
    }

    return this.syncViewport(store, visibleIds);
  }

  syncViewport(store: BoardStore, visibleIds: string[]): Set<string> {
    const retainedIds = new Set([...visibleIds, ...store.selectedIds]);

    for (const id of retainedIds) {
      this.ensureNodeView(store, id);
    }

    for (const [id, view] of this.nodeViews.entries()) {
      const retained = retainedIds.has(id);
      view.container.visible = retained;
      if (retained) {
        this.disposalQueue.cancel(id);
      } else {
        this.scheduleNodeViewDisposal(id);
      }
    }

    this.syncGeneratingViews(retainedIds);

    return retainedIds;
  }

  tickGeneratingAnimations(deltaMS: number): void {
    if (this.visibleGeneratingIds.size === 0) return;
    this.generatingPhase += deltaMS * GENERATING_PHASE_SPEED;
    for (const id of this.visibleGeneratingIds) {
      const view = this.nodeViews.get(id);
      if (!view || view.node.type !== "generating" || !view.container.visible) continue;
      animateGeneratingView(view, this.generatingPhase);
    }
  }

  updateNodeTransform(node: BoardNode): void {
    const view = this.nodeViews.get(node.id);
    if (!view) return;
    view.node = node;
    updateNodeView(view);
    if (node.type === "generating") {
      updateGeneratingView(view);
    }
  }

  refreshNode(store: BoardStore, nodeId: string): void {
    this.ensureNodeView(store, nodeId);
  }

  destroy(): void {
    this.disposalQueue.clear();
    this.visibleGeneratingIds.clear();

    for (const id of [...this.nodeViews.keys()]) {
      this.disposeNodeView(id);
    }
    this.nodeViews.clear();
    this.textureCache.destroy();
  }

  static visibleWorldPadding(): number {
    return VIEWPORT_PADDING;
  }

  private ensureNodeView(store: BoardStore, id: string): void {
    const node = store.getNode(id);
    if (!node) return;

    this.disposalQueue.cancel(id);
    const currentView = this.nodeViews.get(id);
    if (currentView) {
      if (isGeneratingView(currentView) !== (node.type === "generating")) {
        this.disposeNodeView(id);
        this.ensureNodeView(store, id);
        return;
      }
      const currentAsset = store.getAsset(node.assetId);
      const nextVisualKey = describeNodeVisualKey(node, currentAsset);
      currentView.node = node;
      currentView.container.visible = true;
      updateNodeView(currentView);
      if (currentView.assetVisualKey !== nextVisualKey) {
        void this.textureBinder.bind(currentView, currentAsset);
      }
      return;
    }

    const view = createNodeView(node, this.onNodePointerDown);
    this.nodeViews.set(id, view);
    this.layer.addChild(view.container);
    void this.textureBinder.bind(view, store.getAsset(view.node.assetId));
  }

  private isCurrentLoad(view: NodeView, loadVersion: number): boolean {
    return this.nodeViews.get(view.node.id) === view && view.loadVersion === loadVersion;
  }

  private scheduleNodeViewDisposal(id: string): void {
    this.disposalQueue.schedule(id, () => this.canDisposeNodeView(id));
  }

  private disposeNodeView(id: string): void {
    this.disposalQueue.cancel(id);
    const view = this.nodeViews.get(id);
    if (!view) return;
    this.visibleGeneratingIds.delete(id);

    this.onNodeRuntimeDispose(id);

    if (view.textureKey) {
      this.textureBinder.releaseViewTexture(view);
    }

    destroyNodeView(view);
    this.nodeViews.delete(id);
  }

  private canDisposeNodeView(id: string): boolean {
    return !this.nodeViews.get(id)?.container.visible;
  }

  private syncGeneratingViews(retainedIds: Set<string>): void {
    this.visibleGeneratingIds.clear();
    for (const id of retainedIds) {
      const view = this.nodeViews.get(id);
      if (!view || view.node.type !== "generating" || !view.container.visible) continue;
      this.visibleGeneratingIds.add(id);
      updateGeneratingView(view);
      animateGeneratingView(view, this.generatingPhase);
    }
  }
}

function isGeneratingView(view: NodeView): boolean {
  return Boolean(view.generatingVisual);
}
