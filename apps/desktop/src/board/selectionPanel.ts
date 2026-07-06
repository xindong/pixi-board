import type { ScreenRect } from "./boardScene";
import type { MediaPlayback } from "./mediaPlayback";
import type { BoardNode } from "@pixi-board/board-domain";
import { createIcon, type AppIconName } from "../ui/icons";
import { SelectionMediaControls } from "./selectionMediaControls";

const PANEL_GAP = 8;

export type SelectionPanelOptions = {
  onDownload: (node: BoardNode) => void;
  onRefreshPreview: (node: BoardNode) => void;
  onRestoreAspectRatio: (node: BoardNode) => void;
  onWheel: (event: WheelEvent) => void;
};

export class SelectionPanel {
  private readonly root: HTMLDivElement;
  private readonly downloadButton: HTMLButtonElement;
  private readonly restoreAspectButton: HTMLButtonElement;
  private readonly refreshPreviewButton: HTMLButtonElement;
  private readonly mediaControls: SelectionMediaControls;

  private node: BoardNode | null = null;

  constructor(host: HTMLElement, options: SelectionPanelOptions) {
    this.root = document.createElement("div");
    this.root.className = "selection-panel";
    this.root.hidden = true;
    this.root.addEventListener("pointerdown", stopPanelPointerEvent);
    this.root.addEventListener("pointerup", stopPanelPointerEvent);
    this.root.addEventListener("click", stopPanelPointerEvent);
    this.root.addEventListener(
      "wheel",
      (event) => {
        event.stopPropagation();
        options.onWheel(event);
      },
      { passive: false },
    );

    this.downloadButton = createButton("sp-button", "下载", "download");
    this.downloadButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.node) options.onDownload(this.node);
    });
    this.downloadButton.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      if (this.node) options.onDownload(this.node);
    });

    this.restoreAspectButton = createButton("sp-button", "恢复比例", "frame");
    this.restoreAspectButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.node) options.onRestoreAspectRatio(this.node);
    });
    this.restoreAspectButton.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      if (this.node) options.onRestoreAspectRatio(this.node);
    });

    this.refreshPreviewButton = createButton("sp-button", "刷新预览", "refresh");
    this.refreshPreviewButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.node) options.onRefreshPreview(this.node);
    });
    this.refreshPreviewButton.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      if (this.node) options.onRefreshPreview(this.node);
    });

    this.mediaControls = new SelectionMediaControls();

    this.root.append(
      this.downloadButton,
      this.restoreAspectButton,
      this.refreshPreviewButton,
      this.mediaControls.element,
    );
    host.appendChild(this.root);
  }

  show(
    node: BoardNode,
    screen: ScreenRect,
    playback: MediaPlayback | null,
    options: {
      canRefreshPreview?: boolean;
      canRestoreAspectRatio?: boolean;
    } = {},
  ): void {
    this.node = node;
    this.restoreAspectButton.hidden = !options.canRestoreAspectRatio;
    this.refreshPreviewButton.hidden = !options.canRefreshPreview;
    this.mediaControls.show(playback);
    this.root.hidden = false;
    this.reposition(screen);
  }

  reposition(screen: ScreenRect): void {
    const centerX = (screen.minX + screen.maxX) / 2;
    const top = screen.maxY + PANEL_GAP;
    this.root.style.left = `${centerX}px`;
    this.root.style.top = `${top}px`;
  }

  hide(): void {
    this.mediaControls.hide();
    this.root.hidden = true;
    this.node = null;
  }

  destroy(): void {
    this.mediaControls.destroy();
    this.root.remove();
  }
}

function stopPanelPointerEvent(event: Event): void {
  event.stopPropagation();
}

function createButton(
  className: string,
  title: string,
  iconName: AppIconName,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.append(createIcon(iconName, { size: 15 }));
  return button;
}
