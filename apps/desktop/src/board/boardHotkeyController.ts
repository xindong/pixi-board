import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardStore } from "./boardStore";
import { shouldHandleHotkey } from "./keyUtils";

type BoardHotkeyControllerOptions = {
  editor: BoardEditor;
  onDeleteSelection?: () => boolean;
  onMutation: (mutation: BoardMutation) => void;
  setActiveTool: (id: string) => void;
  store: BoardStore;
  hasTool: (id: string) => boolean;
};

export class BoardHotkeyController {
  private readonly editor: BoardEditor;
  private readonly onDeleteSelection: BoardHotkeyControllerOptions["onDeleteSelection"];
  private readonly onMutation: BoardHotkeyControllerOptions["onMutation"];
  private readonly setActiveTool: BoardHotkeyControllerOptions["setActiveTool"];
  private readonly store: BoardStore;
  private readonly hasTool: BoardHotkeyControllerOptions["hasTool"];

  constructor(options: BoardHotkeyControllerOptions) {
    this.editor = options.editor;
    this.onDeleteSelection = options.onDeleteSelection;
    this.onMutation = options.onMutation;
    this.setActiveTool = options.setActiveTool;
    this.store = options.store;
    this.hasTool = options.hasTool;
  }

  handle(event: KeyboardEvent): void {
    if (this.handleToolSwitchKeys(event)) return;
    if (this.handleHistoryKeys(event)) return;
    if (this.handleDuplicateKeys(event)) return;
    if (this.handleClipboardKeys(event)) return;
    if (this.handleDeleteKeys(event)) return;
  }

  private handleDuplicateKeys(event: KeyboardEvent): boolean {
    if (!shouldHandleHotkey(event, { requireMeta: true })) return false;
    if (event.shiftKey) return false;
    if (event.key.toLowerCase() !== "d") return false;
    if (this.store.selectedIds.size === 0) return false;

    event.preventDefault();
    const mutation = this.editor.duplicateSelection();
    if (mutation) this.onMutation(mutation);
    return true;
  }

  private handleClipboardKeys(event: KeyboardEvent): boolean {
    if (!shouldHandleHotkey(event, { requireMeta: true })) return false;
    if (event.shiftKey) return false;

    const lowerKey = event.key.toLowerCase();
    if (lowerKey === "c") {
      event.preventDefault();
      this.editor.copySelectionToClipboard();
      return true;
    }
    if (lowerKey === "x") {
      event.preventDefault();
      const mutation = this.editor.cutSelection();
      if (mutation) this.onMutation(mutation);
      return true;
    }
    if (lowerKey === "v") {
      event.preventDefault();
      const mutation = this.editor.pasteFromClipboard();
      if (mutation) this.onMutation(mutation);
      return true;
    }
    return false;
  }

  private handleDeleteKeys(event: KeyboardEvent): boolean {
    if (event.key !== "Delete" && event.key !== "Backspace") return false;
    if (!shouldHandleHotkey(event, { requireMeta: false })) return false;
    if (this.store.selectedIds.size === 0) return false;

    event.preventDefault();
    if (this.onDeleteSelection?.()) return true;
    const mutation = this.editor.deleteSelected();
    if (mutation) this.onMutation(mutation);
    return true;
  }

  private handleToolSwitchKeys(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey) return false;
    if (!shouldHandleHotkey(event, { requireMeta: false })) return false;

    const key = event.key.toLowerCase();
    const targetToolId = TOOL_KEY_BINDINGS[key];
    if (!targetToolId) return false;
    if (!this.hasTool(targetToolId)) return false;

    event.preventDefault();
    this.setActiveTool(targetToolId);
    return true;
  }

  private handleHistoryKeys(event: KeyboardEvent): boolean {
    if (!shouldHandleHotkey(event, { requireMeta: true })) return false;

    const lowerKey = event.key.toLowerCase();
    if (lowerKey === "z") {
      event.preventDefault();
      const mutation = event.shiftKey ? this.editor.redo() : this.editor.undo();
      if (mutation) this.onMutation(mutation);
      return true;
    }

    if (lowerKey === "y") {
      event.preventDefault();
      const mutation = this.editor.redo();
      if (mutation) this.onMutation(mutation);
      return true;
    }

    return false;
  }
}

const TOOL_KEY_BINDINGS: Record<string, string> = {
  v: "select",
};
