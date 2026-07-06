import type { Point } from "@pixi-board/board-domain";
import type { Asset, BoardNode, BoardSnapshot } from "@pixi-board/board-domain";
import type { BoardNodeUpdateInput } from "@pixi-board/board-domain";

export type NodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NodeAssetReplacement = {
  asset: Asset;
  width?: number;
  height?: number;
  name?: string;
  locked?: boolean;
};

export class BoardStore {
  private nodes: BoardNode[] = [];
  private readonly assets = new Map<string, Asset>();
  private readonly nodeLookup = new Map<string, BoardNode>();
  private selected = new Set<string>();

  get selectedIds(): ReadonlySet<string> {
    return this.selected;
  }

  loadSnapshot(snapshot: BoardSnapshot): void {
    this.nodes = snapshot.nodes;
    this.selected = new Set();
    this.syncNodeLookup();
    this.assets.clear();
    for (const asset of snapshot.assets) {
      this.assets.set(asset.id, asset);
    }
  }

  getNodes(): readonly BoardNode[] {
    return this.nodes;
  }

  getSelectedIds(): string[] {
    return [...this.selected];
  }

  getSelectedNodes(): BoardNode[] {
    return [...this.selected]
      .map((id) => this.nodeLookup.get(id))
      .filter((node): node is BoardNode => Boolean(node));
  }

  getNode(id: string): BoardNode | undefined {
    return this.nodeLookup.get(id);
  }

  getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  getAssets(): ReadonlyMap<string, Asset> {
    return this.assets;
  }

  upsertAssets(nextAssets: Asset[]): void {
    for (const asset of nextAssets) {
      this.assets.set(asset.id, asset);
    }
  }

  removeAssets(assetIds: string[]): void {
    for (const assetId of assetIds) {
      this.assets.delete(assetId);
    }
  }

  appendNodes(nextNodes: BoardNode[]): void {
    this.nodes.push(...nextNodes);
    for (const node of nextNodes) {
      this.nodeLookup.set(node.id, node);
    }
  }

  removeNodes(nodeIds: string[]): void {
    if (nodeIds.length === 0) return;

    const removed = new Set(nodeIds);
    this.nodes = this.nodes.filter((node) => !removed.has(node.id));
    for (const id of removed) {
      this.nodeLookup.delete(id);
      this.selected.delete(id);
    }
  }

  replaceNodes(nextNodes: BoardNode[]): void {
    for (const nextNode of nextNodes) {
      const index = this.nodes.findIndex((node) => node.id === nextNode.id);
      if (index < 0) continue;
      const cloned = structuredClone(nextNode);
      this.nodes[index] = cloned;
      this.nodeLookup.set(cloned.id, cloned);
    }
  }

  replaceNodeAsset(nodeId: string, replacement: NodeAssetReplacement): void {
    const node = this.nodeLookup.get(nodeId);
    if (!node) return;

    this.assets.set(replacement.asset.id, replacement.asset);

    const nextWidth = replacement.width ?? node.width;
    const nextHeight = replacement.height ?? node.height;
    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;

    node.assetId = replacement.asset.id;
    node.type = replacement.asset.kind;
    node.x = centerX - nextWidth / 2;
    node.y = centerY - nextHeight / 2;
    node.width = nextWidth;
    node.height = nextHeight;
    if (replacement.name !== undefined) {
      node.name = replacement.name;
    }
    if (replacement.locked !== undefined) {
      node.locked = replacement.locked;
    }
  }

  replaceNodeAssets(replacements: Array<{ nodeId: string; replacement: NodeAssetReplacement }>): void {
    for (const { nodeId, replacement } of replacements) {
      this.replaceNodeAsset(nodeId, replacement);
    }
  }

  updateNodes(updates: BoardNodeUpdateInput[]): void {
    for (const update of updates) {
      const node = this.nodeLookup.get(update.id);
      if (!node) continue;
      if (update.name !== undefined) node.name = update.name;
      if (update.x !== undefined) node.x = update.x;
      if (update.y !== undefined) node.y = update.y;
      if (update.width !== undefined) node.width = update.width;
      if (update.height !== undefined) node.height = update.height;
      if (update.rotation !== undefined) node.rotation = update.rotation;
      if (update.zIndex !== undefined) node.zIndex = update.zIndex;
      if (update.locked !== undefined) node.locked = update.locked;
      if (update.options !== undefined) node.options = update.options;
    }
  }

  setNodePositions(positions: Map<string, Point>): void {
    for (const [id, point] of positions.entries()) {
      const node = this.nodeLookup.get(id);
      if (!node) continue;
      node.x = point.x;
      node.y = point.y;
    }
  }

  setNodeBounds(bounds: Map<string, NodeBounds>): void {
    for (const [id, next] of bounds.entries()) {
      const node = this.nodeLookup.get(id);
      if (!node) continue;
      node.x = next.x;
      node.y = next.y;
      node.width = next.width;
      node.height = next.height;
    }
  }

  setNodeName(id: string, name: string | undefined): void {
    const node = this.nodeLookup.get(id);
    if (!node) return;
    node.name = name;
  }

  snapshotNodeBounds(ids: Iterable<string>): Map<string, NodeBounds> {
    const bounds = new Map<string, NodeBounds>();
    for (const id of ids) {
      const node = this.nodeLookup.get(id);
      if (!node) continue;
      bounds.set(id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
    }
    return bounds;
  }

  snapshotNodePositions(ids: Iterable<string>): Map<string, Point> {
    const positions = new Map<string, Point>();
    for (const id of ids) {
      const node = this.nodeLookup.get(id);
      if (!node) continue;
      positions.set(id, { x: node.x, y: node.y });
    }
    return positions;
  }

  selectOnly(ids: string[]): void {
    this.selected = new Set(ids.filter((id) => this.nodeLookup.has(id)));
  }

  toggleSelection(id: string): void {
    if (this.selected.has(id)) {
      this.selected.delete(id);
      return;
    }

    if (this.nodeLookup.has(id)) {
      this.selected.add(id);
    }
  }

  nextZIndex(): number {
    return this.nodes.reduce((max, node) => Math.max(max, node.zIndex), 0) + 1;
  }

  private syncNodeLookup(): void {
    this.nodeLookup.clear();
    for (const node of this.nodes) {
      this.nodeLookup.set(node.id, node);
    }
  }
}
