import type { BoardNode } from "@pixi-board/board-domain";
import type { BoardMutation } from "./boardHistory";
import { addedNodesPatch, assetChangedNodesPatch, removedNodesPatch } from "./boardScenePatch";
import { BoardStore, type NodeAssetReplacement } from "./boardStore";

export class BoardTransientMutationService {
  private readonly store: BoardStore;

  constructor(store: BoardStore) {
    this.store = store;
  }

  insertNodes(
    nodes: BoardNode[],
    options?: {
      selectInserted?: boolean;
    },
  ): BoardMutation | null {
    if (nodes.length === 0) return null;
    this.store.appendNodes(nodes);
    if (options?.selectInserted) {
      this.store.selectOnly(nodes.map((node) => node.id));
    }
    return {
      label: "Insert nodes",
      scenePatch: addedNodesPatch(
        nodes.map((node) => node.id),
        { selectionChanged: Boolean(options?.selectInserted) },
      ),
    };
  }

  replaceNodeAsset(nodeId: string, replacement: NodeAssetReplacement): BoardMutation | null {
    if (!this.store.getNode(nodeId)) return null;
    this.store.replaceNodeAsset(nodeId, replacement);
    return {
      label: "Replace node asset",
      scenePatch: assetChangedNodesPatch([nodeId]),
    };
  }

  replaceNodeAssets(
    replacements: Array<{ nodeId: string; replacement: NodeAssetReplacement }>,
  ): BoardMutation | null {
    const existing = replacements.filter(({ nodeId }) => Boolean(this.store.getNode(nodeId)));
    if (existing.length === 0) return null;
    this.store.replaceNodeAssets(existing);
    const nodeIds = existing.map(({ nodeId }) => nodeId);
    return {
      label: "Replace node assets",
      scenePatch: assetChangedNodesPatch(nodeIds),
    };
  }

  removeNodesById(nodeIds: string[], label = "Remove nodes"): BoardMutation | null {
    const existing = nodeIds.filter((nodeId) => Boolean(this.store.getNode(nodeId)));
    if (existing.length === 0) return null;
    this.store.removeNodes(existing);
    return {
      label,
      scenePatch: removedNodesPatch(existing, { selectionChanged: true }),
    };
  }
}
