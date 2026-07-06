import { Container } from "../pixi";
import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { NodeLabelView } from "./nodeLabelView";

const LABEL_HIT_PADDING = 4;

export class NodeLabelLayer {
  readonly container = new Container();
  private readonly labels = new Map<string, NodeLabelView>();
  private editingLabelNodeId: string | null = null;

  constructor() {
    this.container.eventMode = "none";
  }

  hitTest(
    screenPoint: { x: number; y: number },
    scale: number,
    offset: { x: number; y: number },
  ): string | null {
    for (const [nodeId, label] of this.labels.entries()) {
      if (label.hitTest(screenPoint, scale, offset, LABEL_HIT_PADDING)) {
        return nodeId;
      }
    }

    return null;
  }

  setEditingNodeLabel(nodeId: string | null): void {
    this.editingLabelNodeId = nodeId;
    for (const [id, label] of this.labels.entries()) {
      label.setEditing(id === nodeId);
    }
  }

  sync(
    nodes: readonly BoardNode[],
    assets: ReadonlyMap<string, Asset>,
    visibleIds: Set<string>,
    scale: number,
  ): void {
    const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
    for (const id of [...this.labels.keys()]) {
      if (!visibleIds.has(id) || !nodeLookup.has(id)) {
        this.disposeLabel(id);
      }
    }

    for (const id of visibleIds) {
      const node = nodeLookup.get(id);
      if (node) {
        this.updateLabel(node, assets.get(node.assetId), scale);
      }
    }
  }

  refresh(nodes: readonly BoardNode[], assets: ReadonlyMap<string, Asset>, scale: number): void {
    const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
    for (const id of [...this.labels.keys()]) {
      const node = nodeLookup.get(id);
      if (!node) {
        this.disposeLabel(id);
        continue;
      }
      this.updateLabel(node, assets.get(node.assetId), scale);
    }
  }

  destroy(): void {
    for (const id of [...this.labels.keys()]) {
      this.disposeLabel(id);
    }
  }

  private updateLabel(node: BoardNode, asset: Asset | undefined, scale: number): void {
    let label = this.labels.get(node.id);
    if (!label) {
      label = new NodeLabelView();
      this.labels.set(node.id, label);
      this.container.addChild(label.container);
    }

    label.update(node, asset, scale, node.id === this.editingLabelNodeId);
  }

  private disposeLabel(id: string): void {
    const label = this.labels.get(id);
    if (!label) return;

    this.labels.delete(id);
    label.destroy();
  }
}
