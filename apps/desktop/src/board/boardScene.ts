import { Application, Container, Rectangle } from "../pixi";
import type { FederatedPointerEvent, Ticker } from "../pixi";
import type { SpatialItem } from "@pixi-board/board-domain";
import { BoardStore } from "./boardStore";
import { BoardViewport } from "./boardViewport";
import { NodeViewRegistry } from "./nodeViewRegistry";
import { MediaRuntimeRegistry } from "./mediaRuntimeRegistry";
import type { AssetVariant, BoardNode } from "@pixi-board/board-domain";
import type { BoardScenePatch } from "./boardScenePatch";
import { BoardSceneLabelPort } from "./boardSceneLabelPort";
import { BoardSceneSelectionPort } from "./boardSceneSelectionPort";
import { BoardSpatialIndex } from "./boardSpatialIndex";
import { BoardSceneViewportSync } from "./boardSceneViewportSync";
import { SelectionOverlayLayer } from "./selectionOverlayLayer";
import { BoardSceneLabels } from "./boardSceneLabels";

export type { ResizeHandleCorner } from "./selectionOverlayLayer";
export type { ScreenRect, SelectionScreenInfo } from "./boardSceneSelectionPort";

const BOARD_BACKGROUND_COLOR = "#f6f8fb";

type BoardSceneOptions = {
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>;
  onNodePointerDown: (event: FederatedPointerEvent, nodeId: string) => void;
};

export class BoardScene {
  private readonly app = new Application();
  private readonly worldLayer = new Container({ isRenderGroup: true });
  private readonly overlayLayer = new Container();
  private readonly labelViews = new BoardSceneLabels();
  private readonly labelsPort = new BoardSceneLabelPort({
    labelLayer: this.labelViews.layer,
    overlayLayer: this.overlayLayer,
  });
  private readonly selectionOverlay = new SelectionOverlayLayer();
  private readonly selectionPort = new BoardSceneSelectionPort({
    getWorldTransform: () => ({
      scale: this.worldLayer.scale.x,
      offsetX: this.worldLayer.position.x,
      offsetY: this.worldLayer.position.y,
    }),
    overlay: this.selectionOverlay,
    refreshLabels: (store, scale) => this.labelViews.refreshAll(store, scale),
  });
  private readonly spatialIndex = new BoardSpatialIndex();
  private readonly mediaRuntime: MediaRuntimeRegistry;
  private readonly nodeViews: NodeViewRegistry;
  private readonly viewportSync: BoardSceneViewportSync;
  private onNodePointerDown: BoardSceneOptions["onNodePointerDown"];

  constructor(options: BoardSceneOptions) {
    this.onNodePointerDown = options.onNodePointerDown;
    this.nodeViews = new NodeViewRegistry({
      layer: this.worldLayer,
      onNodePointerDown: (event, nodeId) => this.onNodePointerDown(event, nodeId),
      onNodeRuntimeDispose: this.destroyNodeRuntime,
      isNodeRuntimeActive: this.isNodeRuntimeActive,
      resolveAssetUrl: options.resolveAssetUrl,
    });
    this.mediaRuntime = new MediaRuntimeRegistry({
      getView: (nodeId) => this.nodeViews.getView(nodeId),
      resolveAssetUrl: options.resolveAssetUrl,
    });
    this.viewportSync = new BoardSceneViewportSync({
      nodeViews: this.nodeViews,
      screen: () => this.screen,
      spatialIndex: this.spatialIndex,
    });
  }

  setNodePointerDownHandler(
    onNodePointerDown: BoardSceneOptions["onNodePointerDown"],
  ): void {
    this.onNodePointerDown = onNodePointerDown;
    this.nodeViews.setNodePointerDownHandler((event, nodeId) => this.onNodePointerDown(event, nodeId));
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  get screen(): { width: number; height: number } {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
  }

  get stage() {
    return this.app.stage;
  }

  get media(): MediaRuntimeRegistry {
    return this.mediaRuntime;
  }

  get labels(): BoardSceneLabelPort {
    return this.labelsPort;
  }

  get selection(): BoardSceneSelectionPort {
    return this.selectionPort;
  }

  captureVisibleAreaDataUrl(): Promise<string> {
    return this.app.renderer.extract.base64({
      target: this.app.stage,
      frame: new Rectangle(0, 0, this.app.screen.width, this.app.screen.height),
      format: "png",
      resolution: 1,
    });
  }

  async init(root: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: root,
      background: BOARD_BACKGROUND_COLOR,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
      powerPreference: "high-performance",
      textureGCActive: true,
    });

    this.app.canvas.className = "board-canvas";
    root.appendChild(this.app.canvas);

    this.app.stage.eventMode = "static";
    this.worldLayer.sortableChildren = true;
    this.overlayLayer.eventMode = "passive";
    this.overlayLayer.addChild(
      this.labelViews.layer.container,
      this.selectionOverlay.container,
    );
    this.app.stage.addChild(this.worldLayer, this.overlayLayer);
    this.app.ticker.add(this.tickGeneratingAnimations, this);
    this.handleResize();
  }

  destroy(): void {
    this.app.ticker.remove(this.tickGeneratingAnimations, this);
    this.nodeViews.destroy();
    this.mediaRuntime.destroy();
    this.labelViews.destroy();
    this.app.destroy(true);
  }

  private tickGeneratingAnimations(ticker: Ticker): void {
    this.nodeViews.tickGeneratingAnimations(ticker.deltaMS);
    this.labelViews.layer.tickGenerating(Date.now());
  }

  private readonly destroyNodeRuntime = (nodeId: string): void => {
    this.mediaRuntime.destroyNodeRuntime(nodeId);
  };

  private readonly isNodeRuntimeActive = (nodeId: string): boolean => {
    return this.mediaRuntime.isActive(nodeId);
  };

  applyViewport(viewport: BoardViewport): void {
    for (const layer of [this.worldLayer, this.overlayLayer]) {
      layer.position.set(viewport.offset.x, viewport.offset.y);
      layer.scale.set(viewport.scale);
    }
  }

  // Data changed: drop views for removed nodes, then re-cull and redraw.
  // Visible/selected views have their data refreshed by ensureNodeView.
  syncData(store: BoardStore, viewport: BoardViewport): void {
    const retainedIds = this.viewportSync.syncData(store, viewport);
    this.labelViews.syncVisible(store, retainedIds, viewport.scale);
    this.selectionPort.refresh(store, viewport.scale);
  }

  // Resource changed: discard media runtimes and texture-backed views before
  // creating the visible node views again.
  reloadResources(store: BoardStore, viewport: BoardViewport): void {
    this.mediaRuntime.destroy();
    this.nodeViews.destroy();
    this.syncData(store, viewport);
  }

  // Viewport changed: node world coordinates are unchanged, so only the
  // visible set and the scale-dependent selection overlay need updating.
  syncViewport(store: BoardStore, viewport: BoardViewport): void {
    const retainedIds = this.viewportSync.syncViewport(store, viewport);
    this.labelViews.syncVisible(store, retainedIds, viewport.scale);
    this.selectionPort.refresh(store, viewport.scale);
  }

  refreshNodeAsset(store: BoardStore, nodeId: string, viewport: BoardViewport): void {
    this.spatialIndex.updateNode(store, nodeId);
    this.nodeViews.refreshNode(store, nodeId);
    this.labelViews.refreshAll(store, viewport.scale);
    this.selectionPort.refresh(store, viewport.scale);
  }

  applyScenePatch(store: BoardStore, viewport: BoardViewport, patch: BoardScenePatch): void {
    for (const id of patch.removedNodeIds ?? []) {
      this.spatialIndex.removeNode(id);
    }
    for (const id of patch.addedNodeIds ?? []) {
      this.spatialIndex.updateNode(store, id);
    }
    for (const id of patch.updatedNodeIds ?? []) {
      this.spatialIndex.updateNode(store, id);
    }
    for (const id of patch.assetChangedNodeIds ?? []) {
      this.nodeViews.refreshNode(store, id);
    }
    this.syncData(store, viewport);
  }

  updateNodeTransform(node: BoardNode): void {
    this.nodeViews.updateNodeTransform(node);
  }

  rebuildSpatialIndex(nodes: readonly BoardNode[]): void {
    this.spatialIndex.rebuild(nodes);
  }

  query(bounds: SpatialItem): string[] {
    return this.spatialIndex.query(bounds);
  }

  handleResize(): void {
    this.app.stage.hitArea = this.app.screen;
  }
}
