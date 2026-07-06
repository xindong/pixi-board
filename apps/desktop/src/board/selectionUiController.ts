import type { BoardNode } from "@pixi-board/board-domain";
import type { AppStatus } from "../status";
import { NodeNameEditorController } from "./nodeNameEditorController";
import { SelectionContextMenuController } from "./selectionContextMenuController";
import { SelectionPanelController } from "./selectionPanelController";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardScene, SelectionScreenInfo } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

type SelectionUiControllerOptions = {
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null) => void;
  onReload: () => void | Promise<void>;
  onStatus: (status: AppStatus) => void;
  onViewportWheel: (event: WheelEvent) => void;
  root: HTMLElement;
  scene: BoardScene;
  store: BoardStore;
  tauriRuntime: boolean;
  viewport: BoardViewport;
  downloadNode: (node: BoardNode) => void;
  revealAsset: (assetId: string) => void;
  revealProject: () => void;
  refreshNodePreview: (nodeId: string) => void | Promise<void>;
  syncViewportNow: () => void;
};

export class SelectionUiController {
  private readonly nameEditor: NodeNameEditorController;
  private readonly panel: SelectionPanelController;
  private readonly contextMenu: SelectionContextMenuController;

  constructor(options: SelectionUiControllerOptions) {
    this.nameEditor = new NodeNameEditorController({
      editor: options.editor,
      onMutation: options.onMutation,
      root: options.root,
      scene: options.scene,
      store: options.store,
      viewport: options.viewport,
    });
    this.panel = new SelectionPanelController({
      downloadNode: options.downloadNode,
      editor: options.editor,
      onMutation: options.onMutation,
      onStatus: options.onStatus,
      onViewportWheel: options.onViewportWheel,
      refreshNodePreview: options.refreshNodePreview,
      root: options.root,
      scene: options.scene,
      store: options.store,
      viewport: options.viewport,
    });
    this.contextMenu = new SelectionContextMenuController({
      downloadNode: options.downloadNode,
      editor: options.editor,
      onBeforeOpen: () => this.nameEditor.destroy(false),
      onMutation: options.onMutation,
      onReload: options.onReload,
      onStatus: options.onStatus,
      refreshNodePreview: options.refreshNodePreview,
      revealAsset: options.revealAsset,
      revealProject: options.revealProject,
      root: options.root,
      scene: options.scene,
      store: options.store,
      syncViewportNow: options.syncViewportNow,
      tauriRuntime: options.tauriRuntime,
      viewport: options.viewport,
    });
  }

  attach(): void {
    this.contextMenu.attach();
  }

  detach(): void {
    this.contextMenu.detach();
  }

  destroy(): void {
    this.nameEditor.destroy(false);
    this.contextMenu.destroy();
    this.panel.destroy();
  }

  handleSelectionChange(selection: SelectionScreenInfo | null): void {
    this.panel.handleSelectionChange(selection);
  }

  startNodeNameEdit(nodeId: string): void {
    this.nameEditor.start(nodeId);
  }

  positionNameEditor(): void {
    this.nameEditor.position();
  }

  hideTransientUi(): void {
    this.panel.hide();
    this.nameEditor.destroy(false);
  }
}
