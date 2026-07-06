import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

type BoardFrameSchedulerOptions = {
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

export class BoardFrameScheduler {
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;
  private frame: number | null = null;
  private viewportDirty = false;
  private viewportApplied = false;
  private selectionDirty = false;

  constructor(options: BoardFrameSchedulerOptions) {
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  requestViewportSync(): void {
    this.viewportDirty = true;
    this.scene.applyViewport(this.viewport);
    this.scene.selection.refreshPlacement(this.store);
    this.viewportApplied = true;
    this.schedule();
  }

  requestSelectionSync(): void {
    this.selectionDirty = true;
    this.schedule();
  }

  flushNow(): void {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.flush();
  }

  destroy(): void {
    if (this.frame === null) return;
    window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.viewportDirty = false;
    this.selectionDirty = false;
    this.viewportApplied = false;
  }

  private schedule(): void {
    if (this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.flush();
    });
  }

  private flush(): void {
    if (this.viewportDirty) {
      if (!this.viewportApplied) {
        this.scene.applyViewport(this.viewport);
      }
      this.scene.syncViewport(this.store, this.viewport);
    } else if (this.selectionDirty) {
      this.scene.selection.refresh(this.store, this.viewport.scale);
    }
    this.viewportDirty = false;
    this.selectionDirty = false;
    this.viewportApplied = false;
  }
}
