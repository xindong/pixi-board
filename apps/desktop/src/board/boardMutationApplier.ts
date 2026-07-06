import type { BoardMutation } from "./boardHistory";
import type { BoardPersistenceController } from "./boardPersistenceController";
import type { BoardScene } from "./boardScene";
import { scenePatchHasDataChanges } from "./boardScenePatch";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

type BoardMutationApplierOptions = {
  persistence: BoardPersistenceController;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

export class BoardMutationApplier {
  private readonly persistence: BoardPersistenceController;
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;

  constructor(options: BoardMutationApplierOptions) {
    this.persistence = options.persistence;
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  apply(
    mutation: BoardMutation | null,
    options: { scheduleSave?: boolean } = {},
  ): void {
    if (!mutation) return;

    if (scenePatchHasDataChanges(mutation.scenePatch)) {
      this.scene.applyScenePatch(this.store, this.viewport, mutation.scenePatch);
    } else {
      this.scene.selection.refresh(this.store, this.viewport.scale);
    }

    if (options.scheduleSave ?? true) {
      this.persistence.scheduleDocumentSave();
    }
  }
}
