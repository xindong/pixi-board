import type { Asset, BoardNode, BoardSnapshot } from "@pixi-board/board-domain";
import type { NodeBounds } from "./boardStore";
import { boundsMapsMatch, pointMapsMatch } from "./boardChangeGuards";
import { BoardClipboardService } from "./boardClipboardService";
import {
  createCommitInsertedNodesCommand,
  createDeleteNodesCommand,
  createInsertNodesCommand,
  createMoveNodesCommand,
  createRenameNodeCommand,
  createResizeNodesCommand,
  createUpdateNodesCommand,
} from "./boardCommands";
import { type BoardNodeUpdateInput, type Point } from "@pixi-board/board-domain";
import { BoardHistory, type BoardMutation } from "./boardHistory";
import { BoardStore, type NodeAssetReplacement } from "./boardStore";
import { BoardTransientMutationService } from "./boardTransientMutationService";

export class BoardEditor {
  private readonly store: BoardStore;
  private readonly clipboard: BoardClipboardService;
  private readonly transientMutations: BoardTransientMutationService;
  private readonly history = new BoardHistory();

  constructor(store: BoardStore) {
    this.store = store;
    this.clipboard = new BoardClipboardService(store);
    this.transientMutations = new BoardTransientMutationService(store);
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  get canRedo(): boolean {
    return this.history.canRedo;
  }

  loadSnapshot(snapshot: BoardSnapshot): void {
    this.history.clear();
    this.store.loadSnapshot(snapshot);
  }

  upsertAssets(assets: Asset[]): void {
    this.store.upsertAssets(assets);
  }

  removeAssets(assetIds: string[]): void {
    this.store.removeAssets(assetIds);
  }

  getSelectedIds(): string[] {
    return this.store.getSelectedIds();
  }

  insertNodes(
    nodes: BoardNode[],
    options?: {
      label?: string;
      selectInserted?: boolean;
    },
  ): BoardMutation | null {
    if (nodes.length === 0) return null;

    const previousSelectionIds = this.store.getSelectedIds();
    const nextSelectionIds = options?.selectInserted
      ? nodes.map((node) => node.id)
      : previousSelectionIds;

    return this.history.execute(
      this.store,
      createInsertNodesCommand(
        nodes,
        previousSelectionIds,
        nextSelectionIds,
        options?.label ?? "Insert nodes",
      ),
    );
  }

  insertNodesTransient(
    nodes: BoardNode[],
    options?: {
      selectInserted?: boolean;
    },
  ): BoardMutation | null {
    return this.transientMutations.insertNodes(nodes, options);
  }

  commitInsertedNodes(
    nodes: BoardNode[],
    previousSelectionIds: string[],
    options?: {
      label?: string;
      selectInserted?: boolean;
    },
  ): BoardMutation | null {
    if (nodes.length === 0) return null;
    const nextSelectionIds = options?.selectInserted
      ? nodes.map((node) => node.id)
      : this.store.getSelectedIds();

    return this.history.commitApplied(
      createCommitInsertedNodesCommand(
        nodes,
        previousSelectionIds,
        nextSelectionIds,
        options?.label ?? "Insert nodes",
      ),
    );
  }

  copySelectionToClipboard(): boolean {
    return this.clipboard.copySelection();
  }

  pasteFromClipboard(): BoardMutation | null {
    const nextNodes = this.clipboard.createPasteNodes();
    if (nextNodes.length === 0) return null;

    return this.insertNodes(nextNodes, {
      label: "Paste",
      selectInserted: true,
    });
  }

  duplicateSelection(): BoardMutation | null {
    const nextNodes = this.clipboard.createDuplicateNodes();
    if (nextNodes.length === 0) return null;

    return this.insertNodes(nextNodes, {
      label: "Duplicate nodes",
      selectInserted: true,
    });
  }

  cutSelection(): BoardMutation | null {
    if (!this.copySelectionToClipboard()) return null;
    return this.deleteSelected("Cut");
  }

  deleteSelected(label = "Delete nodes"): BoardMutation | null {
    const selectedNodes = this.store.getSelectedNodes();
    if (selectedNodes.length === 0) return null;

    const previousSelectionIds = this.store.getSelectedIds();
    return this.history.execute(
      this.store,
      createDeleteNodesCommand(selectedNodes, previousSelectionIds, label),
    );
  }

  commitNodeMove(beforePositions: Map<string, Point>): BoardMutation | null {
    const afterPositions = this.store.snapshotNodePositions(beforePositions.keys());
    if (pointMapsMatch(beforePositions, afterPositions)) {
      return null;
    }

    return this.history.commitApplied(
      createMoveNodesCommand(beforePositions, afterPositions, "Move nodes"),
    );
  }

  commitNodeResize(before: Map<string, NodeBounds>): BoardMutation | null {
    const after = this.store.snapshotNodeBounds(before.keys());
    if (boundsMapsMatch(before, after)) {
      return null;
    }

    return this.history.commitApplied(
      createResizeNodesCommand(before, after, "Resize nodes"),
    );
  }

  renameNode(nodeId: string, name: string): BoardMutation | null {
    const node = this.store.getNode(nodeId);
    if (!node || node.name === name) return null;

    return this.history.execute(
      this.store,
      createRenameNodeCommand(nodeId, node.name, name),
    );
  }

  updateNodes(updates: BoardNodeUpdateInput[]): BoardMutation | null {
    const existing = updates
      .map((update) => this.store.getNode(update.id))
      .filter((node): node is BoardNode => Boolean(node))
      .map((node) => structuredClone(node));
    if (existing.length === 0) return null;

    return this.history.execute(
      this.store,
      createUpdateNodesCommand(existing, updates),
    );
  }

  replaceNodeAssetTransient(nodeId: string, replacement: NodeAssetReplacement): BoardMutation | null {
    return this.transientMutations.replaceNodeAsset(nodeId, replacement);
  }

  replaceNodeAssetsTransient(
    replacements: Array<{ nodeId: string; replacement: NodeAssetReplacement }>,
  ): BoardMutation | null {
    return this.transientMutations.replaceNodeAssets(replacements);
  }

  removeNodesByIdTransient(nodeIds: string[], label = "Remove nodes"): BoardMutation | null {
    return this.transientMutations.removeNodesById(nodeIds, label);
  }

  undo(): BoardMutation | null {
    return this.history.undo(this.store);
  }

  redo(): BoardMutation | null {
    return this.history.redo(this.store);
  }

  selectOnly(ids: string[]): void {
    this.store.selectOnly(ids);
  }

  toggleSelection(id: string): void {
    this.store.toggleSelection(id);
  }
}
