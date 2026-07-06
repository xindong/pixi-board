import RBush from "rbush";
import { nodeBounds, type SpatialItem } from "@pixi-board/board-domain";
import type { BoardNode } from "@pixi-board/board-domain";
import type { BoardStore } from "./boardStore";

export class BoardSpatialIndex {
  private readonly index = new RBush<SpatialItem>();
  private readonly indexedItems = new Map<string, SpatialItem>();

  rebuild(nodes: readonly BoardNode[]): void {
    this.index.clear();
    this.indexedItems.clear();
    const items = nodes.map(nodeBounds);
    this.index.load(items);
    for (const item of items) {
      this.indexedItems.set(item.id, item);
    }
  }

  query(bounds: SpatialItem): string[] {
    return this.index.search(bounds).map((item) => item.id);
  }

  updateNode(store: BoardStore, nodeId: string): void {
    this.removeNode(nodeId);
    const node = store.getNode(nodeId);
    if (!node) return;
    const item = nodeBounds(node);
    this.index.insert(item);
    this.indexedItems.set(nodeId, item);
  }

  removeNode(nodeId: string): void {
    const item = this.indexedItems.get(nodeId);
    if (!item) return;
    this.index.remove(item, (left, right) => left.id === right.id);
    this.indexedItems.delete(nodeId);
  }
}
