import { displayNodeName, type BoardNode } from "@pixi-board/board-domain";
import { nodeLabelAnchor } from "./nodeLabelGeometry";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

const NODE_NAME_EDITOR_GAP = 6;
const NODE_NAME_EDITOR_LINE_HEIGHT = 13;

type NodeNameEditorControllerOptions = {
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null) => void;
  root: HTMLElement;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

export class NodeNameEditorController {
  private readonly editor: BoardEditor;
  private readonly onMutation: NodeNameEditorControllerOptions["onMutation"];
  private readonly root: HTMLElement;
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;
  private input: HTMLInputElement | null = null;
  private nodeId: string | null = null;
  private cancelled = false;

  constructor(options: NodeNameEditorControllerOptions) {
    this.editor = options.editor;
    this.onMutation = options.onMutation;
    this.root = options.root;
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  start(nodeId: string): void {
    const node = this.store.getNode(nodeId);
    if (!node) return;

    this.destroy(false);

    const input = document.createElement("input");
    input.className = "node-name-editor";
    input.value = node.name ?? "";
    input.placeholder = displayNodeName(node.name);
    input.maxLength = 120;
    input.addEventListener("pointerdown", stopNameEditorEvent);
    input.addEventListener("click", stopNameEditorEvent);
    input.addEventListener("wheel", stopNameEditorEvent, { passive: false });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.cancelled = true;
        input.blur();
      }
    });
    input.addEventListener("blur", () => this.destroy(true));

    this.input = input;
    this.nodeId = nodeId;
    this.cancelled = false;
    this.root.appendChild(input);
    this.scene.labels.setEditingNodeLabel(nodeId);
    this.position();
    input.focus();
    input.select();
  }

  position(): void {
    if (!this.input || !this.nodeId) return;
    const node = this.store.getNode(this.nodeId);
    if (!node) return;

    const anchor = nodeNameEditorAnchor(node, this.viewport);
    this.input.style.left = `${anchor.x}px`;
    this.input.style.top = `${anchor.y - 2}px`;
  }

  destroy(save: boolean): void {
    const input = this.input;
    const nodeId = this.nodeId;
    const cancelled = this.cancelled;
    if (!input) return;

    this.input = null;
    this.nodeId = null;
    this.cancelled = false;
    this.scene.labels.setEditingNodeLabel(null);
    input.remove();

    if (!save || cancelled || !nodeId) return;

    const mutation = this.editor.renameNode(nodeId, input.value.trim());
    if (mutation) {
      this.onMutation(mutation);
    } else {
      this.scene.selection.refresh(this.store, this.viewport.scale);
    }
  }
}

function stopNameEditorEvent(event: Event): void {
  if (event instanceof WheelEvent) {
    event.preventDefault();
  }
  event.stopPropagation();
}

function nodeNameEditorAnchor(
  node: BoardNode,
  viewport: BoardViewport,
): { x: number; y: number } {
  const screen = viewport.worldToScreen(nodeLabelAnchor(node));
  return {
    x: screen.x,
    y: screen.y - NODE_NAME_EDITOR_GAP - NODE_NAME_EDITOR_LINE_HEIGHT,
  };
}
