import type { BoardNode, BoardViewportSnapshot } from "@pixi-board/board-domain";
import type { AppStatus } from "../status";
import type { BoardRepository } from "../storage/boardRepository";

const BOARD_SAVE_DEBOUNCE_MS = 350;
const VIEWPORT_SAVE_DEBOUNCE_MS = 1_000;

type BoardPersistenceControllerOptions = {
  getNodes: () => readonly BoardNode[];
  getViewport: () => BoardViewportSnapshot;
  onStatus: (status: AppStatus) => void;
  repository: BoardRepository;
};

export class BoardPersistenceController {
  private readonly getNodes: BoardPersistenceControllerOptions["getNodes"];
  private readonly getViewport: BoardPersistenceControllerOptions["getViewport"];
  private readonly onStatus: BoardPersistenceControllerOptions["onStatus"];
  private readonly repository: BoardRepository;
  private saveTimer: number | null = null;
  private viewportSaveTimer: number | null = null;

  constructor(options: BoardPersistenceControllerOptions) {
    this.getNodes = options.getNodes;
    this.getViewport = options.getViewport;
    this.onStatus = options.onStatus;
    this.repository = options.repository;
  }

  scheduleDocumentSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persistNow().catch((error) => {
        console.error(error);
        this.onStatus("saveFailed");
      });
    }, BOARD_SAVE_DEBOUNCE_MS);
  }

  scheduleViewportSave(): void {
    if (this.viewportSaveTimer !== null) {
      window.clearTimeout(this.viewportSaveTimer);
    }

    this.viewportSaveTimer = window.setTimeout(() => {
      this.viewportSaveTimer = null;
      this.persistNow({ quiet: true }).catch((error) => {
        console.error(error);
        this.onStatus("saveFailed");
      });
    }, VIEWPORT_SAVE_DEBOUNCE_MS);
  }

  clearPendingDocumentSave(): void {
    if (this.saveTimer === null) return;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  destroy(): void {
    this.clearPendingDocumentSave();
    if (this.viewportSaveTimer !== null) {
      window.clearTimeout(this.viewportSaveTimer);
      this.viewportSaveTimer = null;
    }
  }

  async persistNow(options: { quiet?: boolean } = {}): Promise<void> {
    if (!options.quiet) {
      this.onStatus("saving");
    }
    await this.repository.saveBoardState(this.getNodes(), this.getViewport());
    if (!options.quiet) {
      this.onStatus("saved");
    }
  }
}
