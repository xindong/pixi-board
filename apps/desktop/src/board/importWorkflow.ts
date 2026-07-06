import type { Asset } from "@pixi-board/board-domain";
import { AssetImportManager, type AssetImportCompletionEvent } from "../assets/assetImportManager";
import { AssetNodeFactory } from "../assets/assetNodeFactory";
import type { AppStatus } from "../status";
import { createId } from "../utils";
import { AssetImportSessionCoordinator } from "./assetImportSessionCoordinator";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardPersistenceController } from "./boardPersistenceController";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";
import { persistBoardWrite } from "./boardWritePersistence";

type ImportWorkflowOptions = {
  assetImports: AssetImportManager;
  editor: BoardEditor;
  importSessions: AssetImportSessionCoordinator;
  nodeFactory: AssetNodeFactory;
  onMutation: (mutation: BoardMutation | null, options?: { scheduleSave?: boolean }) => void;
  onStatus: (status: AppStatus) => void;
  persistence: BoardPersistenceController;
  scene: BoardScene;
  setBusy: (busy: boolean, status?: AppStatus) => void;
  setImportOverlay: (active: boolean) => void;
  store: BoardStore;
  viewport: BoardViewport;
};

export class ImportWorkflow {
  private readonly assetImports: AssetImportManager;
  private readonly editor: BoardEditor;
  private readonly importSessions: AssetImportSessionCoordinator;
  private readonly nodeFactory: AssetNodeFactory;
  private readonly onMutation: ImportWorkflowOptions["onMutation"];
  private readonly onStatus: ImportWorkflowOptions["onStatus"];
  private readonly persistence: BoardPersistenceController;
  private readonly scene: BoardScene;
  private readonly setBusy: ImportWorkflowOptions["setBusy"];
  private readonly setImportOverlay: ImportWorkflowOptions["setImportOverlay"];
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;

  constructor(options: ImportWorkflowOptions) {
    this.assetImports = options.assetImports;
    this.editor = options.editor;
    this.importSessions = options.importSessions;
    this.nodeFactory = options.nodeFactory;
    this.onMutation = options.onMutation;
    this.onStatus = options.onStatus;
    this.persistence = options.persistence;
    this.scene = options.scene;
    this.setBusy = options.setBusy;
    this.setImportOverlay = options.setImportOverlay;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  async importPaths(paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const showImportOverlay = paths.length > 1;
    if (showImportOverlay) {
      this.setImportOverlay(true);
    }
    this.setBusy(true, "importing");
    try {
      const placeholderAssets = createImportingAssets(paths);
      this.editor.upsertAssets(placeholderAssets);
      const previousSelectionIds = this.editor.getSelectedIds();
      const placeholderNodes = this.nodeFactory.createNodes(placeholderAssets, {
        center: this.viewport.screenToWorld({
          x: this.scene.screen.width / 2,
          y: this.scene.screen.height / 2,
        }),
        existingNodes: this.store.getNodes(),
      });
      const mutation = this.editor.insertNodesTransient(placeholderNodes);
      this.onMutation(mutation, { scheduleSave: false });
      await persistBoardWrite(this.persistence, { quiet: true });
      this.setBusy(false);
      this.onStatus("importing");

      const session = this.importSessions.start(placeholderNodes, previousSelectionIds);
      void this.assetImports.importPaths(
        paths,
        {
          onImported: (event) =>
            this.importSessions.queueReplacement(session.id, event.index, event.asset),
          onPrepared: (event) =>
            this.importSessions.queueReplacement(session.id, event.index, event.asset),
          onFailed: (event) => this.importSessions.queueRemoval(session.id, event.index),
        },
        session.signal,
      )
        .then((completion) =>
          this.finishImportSession(session.id, completion, showImportOverlay),
        )
        .catch((error) => this.failImportSession(session.id, error, showImportOverlay));
    } catch (error) {
      console.error(error);
      this.onStatus("failed");
      this.setBusy(false);
      if (showImportOverlay) {
        this.setImportOverlay(false);
      }
    }
  }

  private async finishImportSession(
    sessionId: number,
    completion: AssetImportCompletionEvent,
    showImportOverlay: boolean,
  ): Promise<void> {
    try {
      const result = await this.importSessions.finish(sessionId, completion);
      if (!result) return;
      await persistBoardWrite(this.persistence);
      this.onStatus(importCompletionStatus(result));
    } catch (error) {
      console.error(error);
      this.onStatus(this.importSessions.activeSessionCount > 0 ? "importing" : "failed");
    } finally {
      if (showImportOverlay) {
        this.setImportOverlay(false);
      }
    }
  }

  private failImportSession(
    sessionId: number,
    error: unknown,
    showImportOverlay: boolean,
  ): void {
    console.error(error);
    const activeSessionCount = this.importSessions.fail(sessionId);
    if (activeSessionCount === null) {
      if (showImportOverlay) {
        this.setImportOverlay(false);
      }
      return;
    }
    void persistBoardWrite(this.persistence).catch((persistError) => {
      console.error(persistError);
      this.onStatus("saveFailed");
    });
    this.onStatus(activeSessionCount > 0 ? "importing" : "failed");
    this.setBusy(false);
    if (showImportOverlay) {
      this.setImportOverlay(false);
    }
  }
}

function createImportingAssets(paths: string[]): Asset[] {
  const now = Date.now();
  return paths.map((path) => ({
    id: createId("asset"),
    kind: "importing",
    metadata: {
      text: "导入中",
    },
    fileName: fileNameFromPath(path),
    createdAt: now,
    updatedAt: now,
  }));
}

function fileNameFromPath(path: string): string | undefined {
  return path.split(/[\\/]/).filter(Boolean).pop();
}

function importCompletionStatus(result: {
  activeSessionCount: number;
  importedCount: number;
}): AppStatus {
  if (result.activeSessionCount > 0) return "importing";
  return result.importedCount > 0 ? "imported" : "failed";
}
