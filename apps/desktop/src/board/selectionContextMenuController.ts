import type { BoardNode } from "@pixi-board/board-domain";
import type { AppStatus } from "../status";
import { ContextMenu } from "../ui/contextMenu";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import { hitTestTopNodeAtScreen } from "./boardHitTest";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";
import { SelectionContextMenuItems } from "./selectionContextMenuItems";

type SelectionContextMenuControllerOptions = {
  downloadNode: (node: BoardNode) => void;
  editor: BoardEditor;
  onBeforeOpen: () => void;
  onMutation: (mutation: BoardMutation | null) => void;
  onReload: () => void | Promise<void>;
  onStatus: (status: AppStatus) => void;
  refreshNodePreview: (nodeId: string) => void | Promise<void>;
  revealAsset: (assetId: string) => void;
  revealProject: () => void;
  root: HTMLElement;
  scene: BoardScene;
  store: BoardStore;
  syncViewportNow: () => void;
  tauriRuntime: boolean;
  viewport: BoardViewport;
};

export class SelectionContextMenuController {
  private readonly contextMenu: ContextMenu;
  private readonly items: SelectionContextMenuItems;
  private readonly editor: BoardEditor;
  private readonly onBeforeOpen: SelectionContextMenuControllerOptions["onBeforeOpen"];
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;

  constructor(options: SelectionContextMenuControllerOptions) {
    this.contextMenu = new ContextMenu(options.root);
    this.items = new SelectionContextMenuItems(options);
    this.editor = options.editor;
    this.onBeforeOpen = options.onBeforeOpen;
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  attach(): void {
    this.scene.canvas.addEventListener("contextmenu", this.handleContextMenu);
  }

  detach(): void {
    this.scene.canvas.removeEventListener("contextmenu", this.handleContextMenu);
  }

  destroy(): void {
    this.contextMenu.destroy();
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();

    this.onBeforeOpen();

    const rect = this.scene.canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const labelNodeId = this.scene.labels.hitTest(screen);
    const nodeId =
      labelNodeId ??
      hitTestTopNodeAtScreen(screen, {
        scene: this.scene,
        store: this.store,
        viewport: this.viewport,
      });

    if (!nodeId) {
      this.contextMenu.show(
        { x: event.clientX, y: event.clientY },
        this.items.canvasItems(),
      );
      return;
    }

    if (!this.store.selectedIds.has(nodeId)) {
      this.editor.selectOnly([nodeId]);
      this.scene.selection.refresh(this.store, this.viewport.scale);
    }

    const node = this.store.getNode(nodeId);
    if (!node) return;
    this.contextMenu.show(
      { x: event.clientX, y: event.clientY },
      this.items.nodeItems(node),
    );
  };
}
