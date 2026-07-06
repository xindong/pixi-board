import type { BoardNode } from "@pixi-board/board-domain";
import type { AppStatus } from "../status";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardScene, SelectionScreenInfo } from "./boardScene";
import { canRefreshNodePreview } from "./boardPreviewService";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";
import { refreshNodePreviewAction } from "./refreshNodePreviewAction";
import { SelectionPanel } from "./selectionPanel";
import { SelectionPlaybackController } from "./selectionPlaybackController";

type SelectionPanelControllerOptions = {
  downloadNode: (node: BoardNode) => void;
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null) => void;
  onStatus: (status: AppStatus) => void;
  onViewportWheel: (event: WheelEvent) => void;
  refreshNodePreview: (nodeId: string) => void | Promise<void>;
  root: HTMLElement;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

export class SelectionPanelController {
  private readonly editor: BoardEditor;
  private readonly onMutation: SelectionPanelControllerOptions["onMutation"];
  private readonly onStatus: SelectionPanelControllerOptions["onStatus"];
  private readonly refreshNodePreview: SelectionPanelControllerOptions["refreshNodePreview"];
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;
  private readonly panel: SelectionPanel;
  private readonly playback: SelectionPlaybackController;
  private activeNodeId: string | null = null;

  constructor(options: SelectionPanelControllerOptions) {
    this.editor = options.editor;
    this.onMutation = options.onMutation;
    this.onStatus = options.onStatus;
    this.refreshNodePreview = options.refreshNodePreview;
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
    this.playback = new SelectionPlaybackController({
      mediaRuntime: this.scene.media,
      store: this.store,
    });
    this.panel = new SelectionPanel(options.root, {
      onDownload: options.downloadNode,
      onRefreshPreview: (node) => this.handleRefreshNodePreview(node),
      onRestoreAspectRatio: (node) => this.restoreAspectRatio(node),
      onWheel: options.onViewportWheel,
    });
  }

  handleSelectionChange(selection: SelectionScreenInfo | null): void {
    if (!selection) {
      this.hide();
      return;
    }

    const node = this.store.getNode(selection.nodeId);
    if (!node) {
      this.hide();
      return;
    }

    if (this.activeNodeId === node.id) {
      this.panel.reposition(selection.screen);
      return;
    }

    this.playback.clear();
    const playback = this.playback.createPlayback(node);
    this.activeNodeId = node.id;
    const asset = this.store.getAsset(node.assetId);
    this.panel.show(node, selection.screen, playback, {
      canRefreshPreview: canRefreshNodePreview(node, asset),
      canRestoreAspectRatio: this.assetAspectRatio(node) !== null,
    });
  }

  hide(): void {
    this.playback.clear();
    this.activeNodeId = null;
    this.panel.hide();
  }

  destroy(): void {
    this.playback.clear();
    this.panel.destroy();
  }

  private handleRefreshNodePreview(node: BoardNode): void {
    refreshNodePreviewAction({
      nodeId: node.id,
      onStatus: this.onStatus,
      refreshNodePreview: this.refreshNodePreview,
    });
  }

  private restoreAspectRatio(node: BoardNode): void {
    const ratio = this.assetAspectRatio(node);
    if (!ratio) return;

    const centerX = node.x + node.width / 2;
    const centerY = node.y + node.height / 2;
    const currentRatio = node.width / Math.max(node.height, 1);
    const next =
      currentRatio > ratio
        ? {
            width: node.height * ratio,
            height: node.height,
          }
        : {
            width: node.width,
            height: node.width / ratio,
          };
    const mutation = this.editor.updateNodes([
      {
        id: node.id,
        width: next.width,
        height: next.height,
        x: centerX - next.width / 2,
        y: centerY - next.height / 2,
      },
    ]);

    if (mutation) {
      this.onMutation(mutation);
    } else {
      this.scene.selection.refresh(this.store, this.viewport.scale);
    }
  }

  private assetAspectRatio(node: BoardNode): number | null {
    const asset = this.store.getAsset(node.assetId);
    if (!asset) return null;

    const width = positiveNumber(asset.width) ?? positiveNumber(asset.metadata?.previewWidth);
    const height = positiveNumber(asset.height) ?? positiveNumber(asset.metadata?.previewHeight);
    if (!width || !height) return null;
    return width / height;
  }
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
