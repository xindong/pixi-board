import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";
import { NodeViewRegistry } from "./nodeViewRegistry";
import { BoardSpatialIndex } from "./boardSpatialIndex";

type BoardSceneViewportSyncOptions = {
  nodeViews: NodeViewRegistry;
  screen: () => { width: number; height: number };
  spatialIndex: BoardSpatialIndex;
};

export class BoardSceneViewportSync {
  private readonly nodeViews: NodeViewRegistry;
  private readonly screen: BoardSceneViewportSyncOptions["screen"];
  private readonly spatialIndex: BoardSpatialIndex;

  constructor(options: BoardSceneViewportSyncOptions) {
    this.nodeViews = options.nodeViews;
    this.screen = options.screen;
    this.spatialIndex = options.spatialIndex;
  }

  syncData(store: BoardStore, viewport: BoardViewport): Set<string> {
    const visibleIds = this.visibleNodeIds(viewport);
    return this.nodeViews.syncData(store, visibleIds);
  }

  syncViewport(store: BoardStore, viewport: BoardViewport): Set<string> {
    const visibleIds = this.visibleNodeIds(viewport);
    return this.nodeViews.syncViewport(store, visibleIds);
  }

  private visibleNodeIds(viewport: BoardViewport): string[] {
    const visibleBounds = viewport.visibleWorldBounds(
      this.screen(),
      NodeViewRegistry.visibleWorldPadding(),
    );
    return this.spatialIndex.query(visibleBounds);
  }
}
