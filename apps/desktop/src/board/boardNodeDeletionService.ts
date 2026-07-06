import type { BoardNode } from "@pixi-board/board-domain";
import type { BoardRepository } from "../storage/boardRepository";
import type { AppStatus } from "../status";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardPersistenceController } from "./boardPersistenceController";
import type { BoardStore } from "./boardStore";
import { persistBoardWrite } from "./boardWritePersistence";

type BoardNodeDeletionServiceOptions = {
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null, options?: { scheduleSave?: boolean }) => void;
  onStatus: (status: AppStatus) => void;
  persistence: BoardPersistenceController;
  repository: BoardRepository;
  setBusy: (busy: boolean, status?: AppStatus) => void;
  store: BoardStore;
};

export class BoardNodeDeletionService {
  private readonly editor: BoardEditor;
  private readonly onMutation: BoardNodeDeletionServiceOptions["onMutation"];
  private readonly onStatus: BoardNodeDeletionServiceOptions["onStatus"];
  private readonly persistence: BoardPersistenceController;
  private readonly repository: BoardRepository;
  private readonly setBusy: BoardNodeDeletionServiceOptions["setBusy"];
  private readonly store: BoardStore;

  constructor(options: BoardNodeDeletionServiceOptions) {
    this.editor = options.editor;
    this.onMutation = options.onMutation;
    this.onStatus = options.onStatus;
    this.persistence = options.persistence;
    this.repository = options.repository;
    this.setBusy = options.setBusy;
    this.store = options.store;
  }

  deleteSelectedNodes(): boolean {
    const selectedNodes = this.store.getSelectedNodes().map((node) => structuredClone(node));
    if (selectedNodes.length === 0) return false;

    void this.deleteNodesAndUnusedAssets(selectedNodes);
    return true;
  }

  private async deleteNodesAndUnusedAssets(nodes: BoardNode[]): Promise<void> {
    this.setBusy(true, "saving");
    try {
      const nodeIds = nodes.map((node) => node.id);
      const assetIds = this.unusedAssetIdsAfterDeleting(nodes);
      const mutation = this.editor.removeNodesByIdTransient(nodeIds, "Delete nodes");
      if (!mutation) return;

      if (assetIds.length > 0) {
        this.editor.removeAssets(assetIds);
      }
      this.onMutation(mutation, { scheduleSave: false });

      await persistBoardWrite(this.persistence, { quiet: true });
      await this.repository.deleteAssets(assetIds);
      this.onStatus("saved");
    } catch (error) {
      console.error(error);
      this.onStatus("saveFailed");
    } finally {
      this.setBusy(false);
    }
  }

  private unusedAssetIdsAfterDeleting(nodes: BoardNode[]): string[] {
    const deletedNodeIds = new Set(nodes.map((node) => node.id));
    const remainingAssetIds = new Set(
      this.store
        .getNodes()
        .filter((node) => !deletedNodeIds.has(node.id))
        .map((node) => node.assetId),
    );
    const deletedAssetIds = new Set(nodes.map((node) => node.assetId));
    return [...deletedAssetIds].filter((assetId) => !remainingAssetIds.has(assetId));
  }
}
