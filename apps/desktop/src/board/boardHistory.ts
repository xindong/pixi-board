import type { BoardStore } from "./boardStore";
import type { BoardScenePatch } from "./boardScenePatch";

export type BoardMutation = {
  label: string;
  scenePatch: BoardScenePatch;
};

export type BoardCommand = {
  label: string;
  applyPatch: BoardScenePatch;
  revertPatch: BoardScenePatch;
  apply: (store: BoardStore) => void;
  revert: (store: BoardStore) => void;
};

export class BoardHistory {
  private readonly undoStack: BoardCommand[] = [];
  private readonly redoStack: BoardCommand[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  execute(store: BoardStore, command: BoardCommand): BoardMutation {
    command.apply(store);
    return this.pushUndo(command);
  }

  commitApplied(command: BoardCommand): BoardMutation {
    return this.pushUndo(command);
  }

  undo(store: BoardStore): BoardMutation | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    command.revert(store);
    this.redoStack.push(command);

    return { label: `Undo ${command.label}`, scenePatch: command.revertPatch };
  }

  redo(store: BoardStore): BoardMutation | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    command.apply(store);
    this.undoStack.push(command);

    return { label: `Redo ${command.label}`, scenePatch: command.applyPatch };
  }

  private pushUndo(command: BoardCommand): BoardMutation {
    this.undoStack.push(command);
    this.redoStack.length = 0;

    return { label: command.label, scenePatch: command.applyPatch };
  }
}
