import type { FederatedPointerEvent } from "../pixi";
import { nodeBounds, type SpatialItem } from "@pixi-board/board-domain";
import type { BoardNode } from "@pixi-board/board-domain";
import type { BoardStore } from "./boardStore";
import type { ResizeHandleCorner, SelectionOverlayLayer } from "./selectionOverlayLayer";

export type ScreenRect = { minX: number; minY: number; maxX: number; maxY: number };

export type SelectionScreenInfo = { nodeId: string; screen: ScreenRect };

type BoardSceneSelectionPortOptions = {
  getWorldTransform: () => {
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  overlay: SelectionOverlayLayer;
  refreshLabels: (store: BoardStore, scale: number) => void;
};

export class BoardSceneSelectionPort {
  private readonly getWorldTransform: BoardSceneSelectionPortOptions["getWorldTransform"];
  private readonly overlay: SelectionOverlayLayer;
  private readonly refreshLabels: BoardSceneSelectionPortOptions["refreshLabels"];
  private onChange: ((selection: SelectionScreenInfo | null) => void) | null = null;

  constructor(options: BoardSceneSelectionPortOptions) {
    this.getWorldTransform = options.getWorldTransform;
    this.overlay = options.overlay;
    this.refreshLabels = options.refreshLabels;
  }

  setResizeHandlePointerDownHandler(
    handler: (event: FederatedPointerEvent, corner: ResizeHandleCorner) => void,
  ): void {
    this.overlay.setResizeHandlePointerDownHandler(handler);
  }

  setChangeHandler(handler: (selection: SelectionScreenInfo | null) => void): void {
    this.onChange = handler;
  }

  refresh(store: BoardStore, scale: number): void {
    const selectedNodes = store.getSelectedNodes();
    this.overlay.refresh(selectedNodes, scale);
    this.emitChange(selectedNodes);
    this.refreshLabels(store, scale);
  }

  refreshPlacement(store: BoardStore): void {
    this.emitChange(store.getSelectedNodes());
  }

  setMarquee(bounds: SpatialItem, scale: number): void {
    this.overlay.setMarquee(bounds, scale);
  }

  clearMarquee(): void {
    this.overlay.clearMarquee();
  }

  private emitChange(selectedNodes: BoardNode[]): void {
    if (!this.onChange) return;
    if (selectedNodes.length !== 1) {
      this.onChange(null);
      return;
    }

    const node = selectedNodes[0];
    this.onChange({
      nodeId: node.id,
      screen: selectionScreenRect(node, this.getWorldTransform()),
    });
  }
}

function selectionScreenRect(
  node: BoardNode,
  transform: { scale: number; offsetX: number; offsetY: number },
): ScreenRect {
  const bounds = nodeBounds(node);
  return {
    minX: bounds.minX * transform.scale + transform.offsetX,
    minY: bounds.minY * transform.scale + transform.offsetY,
    maxX: bounds.maxX * transform.scale + transform.offsetX,
    maxY: bounds.maxY * transform.scale + transform.offsetY,
  };
}
