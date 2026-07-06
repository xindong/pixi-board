import type { BoardStore } from "./boardStore";
import { boardLodStateForScale } from "./boardLodPolicy";
import { NodeLabelLayer } from "./nodeLabelLayer";

export class BoardSceneLabels {
  readonly layer = new NodeLabelLayer();

  syncVisible(store: BoardStore, retainedIds: Set<string>, scale: number): void {
    if (boardLodStateForScale(scale).labelMode === "hidden") {
      this.layer.sync([], new Map(), new Set(), scale);
      return;
    }
    this.layer.sync(store.getNodes(), store.getAssets(), retainedIds, scale);
  }

  refreshAll(store: BoardStore, scale: number): void {
    if (boardLodStateForScale(scale).labelMode === "hidden") {
      this.layer.refresh([], new Map(), scale);
      return;
    }
    this.layer.refresh(store.getNodes(), store.getAssets(), scale);
  }

  destroy(): void {
    this.layer.destroy();
  }
}
