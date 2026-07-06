import { boundsForItems, displayNodeName, nodeBounds, type BoardNode } from "@pixi-board/board-domain";
import type { AppStatus } from "../status";
import type { ContextMenuItem } from "../ui/contextMenu";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import { canRefreshNodePreview } from "./boardPreviewService";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";
import { refreshNodePreviewAction } from "./refreshNodePreviewAction";

type SelectionContextMenuItemsOptions = {
  downloadNode: (node: BoardNode) => void;
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null) => void;
  onReload: () => void | Promise<void>;
  onStatus: (status: AppStatus) => void;
  refreshNodePreview: (nodeId: string) => void | Promise<void>;
  revealAsset: (assetId: string) => void;
  revealProject: () => void;
  scene: BoardScene;
  store: BoardStore;
  syncViewportNow: () => void;
  tauriRuntime: boolean;
  viewport: BoardViewport;
};

export class SelectionContextMenuItems {
  private readonly options: SelectionContextMenuItemsOptions;

  constructor(options: SelectionContextMenuItemsOptions) {
    this.options = options;
  }

  canvasItems(): ContextMenuItem[] {
    return [
      {
        id: "refresh",
        label: "刷新",
        icon: "refresh",
        onSelect: () => this.options.onReload(),
      },
      {
        id: "fit-content",
        label: "适应全部内容",
        icon: "frame",
        onSelect: () => this.fitAllNodes(),
      },
      {
        id: "reveal-project",
        label: "在 Finder 中打开",
        icon: "folderOpen",
        hidden: !this.options.tauriRuntime,
        onSelect: () => this.options.revealProject(),
      },
    ];
  }

  nodeItems(node: BoardNode): ContextMenuItem[] {
    const asset = this.options.store.getAsset(node.assetId);
    const hasOriginal = Boolean(asset?.localPath);
    return [
      {
        id: "download",
        label: "下载",
        icon: "download",
        hidden: !hasOriginal || !this.options.tauriRuntime,
        onSelect: () => this.options.downloadNode(node),
      },
      {
        id: "duplicate-node",
        label: "复制节点",
        icon: "copy",
        onSelect: () => this.duplicateSelection(),
      },
      {
        id: "refresh-preview",
        label: "刷新预览",
        icon: "refresh",
        hidden: !canRefreshNodePreview(node, asset),
        onSelect: () => this.refreshNodePreview(node),
      },
      {
        id: "copy-node-name",
        label: "复制节点名称",
        icon: "text",
        onSelect: () => this.copyNodeName(node),
      },
      {
        id: "reveal-asset",
        label: "在 Finder 中打开",
        icon: "folderOpen",
        hidden: !hasOriginal || !this.options.tauriRuntime,
        onSelect: () => this.options.revealAsset(node.assetId),
      },
    ];
  }

  private fitAllNodes(): void {
    const bounds = boundsForItems("all-nodes", this.options.store.getNodes().map(nodeBounds));
    if (!bounds) return;

    this.options.viewport.fitBounds(bounds, this.options.scene.screen);
    this.options.syncViewportNow();
  }

  private duplicateSelection(): void {
    const mutation = this.options.editor.duplicateSelection();
    if (mutation) {
      this.options.onMutation(mutation);
    } else {
      this.options.scene.selection.refresh(this.options.store, this.options.viewport.scale);
    }
  }

  private copyNodeName(node: BoardNode): void {
    const name = node.name?.trim() || displayNodeName(node.name);
    void navigator.clipboard.writeText(name).catch((error) => {
      console.error(error);
      this.options.onStatus("failed");
    });
  }

  private refreshNodePreview(node: BoardNode): void {
    refreshNodePreviewAction({
      nodeId: node.id,
      onStatus: this.options.onStatus,
      refreshNodePreview: this.options.refreshNodePreview,
    });
  }
}
