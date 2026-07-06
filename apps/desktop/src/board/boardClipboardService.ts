import type { BoardNode } from "@pixi-board/board-domain";
import { createId } from "../utils";
import { boardClipboard } from "./clipboard";
import type { BoardStore } from "./boardStore";

const DUPLICATE_OFFSET = 24;

export class BoardClipboardService {
  private readonly store: BoardStore;

  constructor(store: BoardStore) {
    this.store = store;
  }

  copySelection(): boolean {
    return boardClipboard.copy(this.store.getSelectedNodes());
  }

  createPasteNodes(): BoardNode[] {
    const clipboardNodes = boardClipboard.read();
    if (!clipboardNodes || clipboardNodes.length === 0) return [];

    const offset = boardClipboard.nextPasteOffset();
    return cloneNodesForInsertion(clipboardNodes, this.store.nextZIndex(), {
      x: offset.x,
      y: offset.y,
    });
  }

  createDuplicateNodes(): BoardNode[] {
    const selectedNodes = this.store.getSelectedNodes();
    if (selectedNodes.length === 0) return [];

    return cloneNodesForInsertion(selectedNodes, this.store.nextZIndex(), {
      x: DUPLICATE_OFFSET,
      y: DUPLICATE_OFFSET,
    });
  }
}

function cloneNodesForInsertion(
  nodes: readonly BoardNode[],
  baseZIndex: number,
  offset: { x: number; y: number },
): BoardNode[] {
  return nodes.map((node, index) => ({
    ...structuredClone(node),
    id: createId("node"),
    x: node.x + offset.x,
    y: node.y + offset.y,
    zIndex: baseZIndex + index,
  }));
}
