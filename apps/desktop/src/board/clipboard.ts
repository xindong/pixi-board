import type { BoardNode } from "@pixi-board/board-domain";

let slot: BoardNode[] | null = null;
let pasteCount = 0;

export const boardClipboard = {
  copy(nodes: BoardNode[]): boolean {
    if (nodes.length === 0) return false;
    slot = nodes.map((node) => structuredClone(node));
    pasteCount = 0;
    return true;
  },

  read(): BoardNode[] | null {
    if (!slot) return null;
    return slot.map((node) => structuredClone(node));
  },

  hasContent(): boolean {
    return slot !== null && slot.length > 0;
  },

  nextPasteOffset(): { x: number; y: number } {
    pasteCount += 1;
    return { x: 24 * pasteCount, y: 24 * pasteCount };
  },

  clear(): void {
    slot = null;
    pasteCount = 0;
  },
};
