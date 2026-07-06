import { Circle, Container, Graphics } from "../pixi";
import type { FederatedPointerEvent } from "../pixi";
import {
  boundsForItems,
  nodeBounds,
  nodeWorldCorners,
  type SpatialItem,
} from "@pixi-board/board-domain";
import type { BoardNode } from "@pixi-board/board-domain";
import { boardLodStateForScale } from "./boardLodPolicy";

export type ResizeHandleCorner = "tl" | "tr" | "bl" | "br";

export class SelectionOverlayLayer {
  readonly container = new Container();
  private readonly selectionGraphics = new Graphics();
  private readonly marqueeGraphics = new Graphics();
  private readonly handleLayer = new Container();
  private readonly handles: { corner: ResizeHandleCorner; graphics: Graphics }[] = [];
  private onResizeHandlePointerDown:
    | ((event: FederatedPointerEvent, corner: ResizeHandleCorner) => void)
    | null = null;
  private marqueeBounds: SpatialItem | null = null;

  constructor() {
    this.selectionGraphics.eventMode = "none";
    this.marqueeGraphics.eventMode = "none";
    this.buildResizeHandles();
    this.container.addChild(this.selectionGraphics, this.marqueeGraphics, this.handleLayer);
  }

  setResizeHandlePointerDownHandler(
    handler: (event: FederatedPointerEvent, corner: ResizeHandleCorner) => void,
  ): void {
    this.onResizeHandlePointerDown = handler;
  }

  setMarquee(bounds: SpatialItem, scale: number): void {
    this.marqueeBounds = bounds;
    this.drawMarquee(scale);
  }

  clearMarquee(): void {
    this.marqueeBounds = null;
    this.marqueeGraphics.clear();
  }

  refresh(nodes: BoardNode[], scale: number): void {
    this.drawSelection(nodes, scale);
    this.drawHandles(nodes, scale);
    this.drawMarquee(scale);
  }

  private buildResizeHandles(): void {
    const corners: ResizeHandleCorner[] = ["tl", "tr", "bl", "br"];
    for (const corner of corners) {
      const graphics = new Graphics();
      graphics.eventMode = "static";
      graphics.cursor = corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize";
      graphics.visible = false;
      graphics.on("pointerdown", (event) => {
        event.stopPropagation();
        this.onResizeHandlePointerDown?.(event, corner);
      });
      this.handleLayer.addChild(graphics);
      this.handles.push({ corner, graphics });
    }
  }

  private drawSelection(nodes: BoardNode[], scale: number): void {
    this.selectionGraphics.clear();
    if (boardLodStateForScale(scale).overlayMode === "simple" && nodes.length > 1) {
      const bounds = boundsForItems("selection", nodes.map(nodeBounds));
      if (bounds) {
        this.selectionGraphics
          .rect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
          .stroke({ color: 0x2563eb, width: Math.max(1 / scale, 0.5), alpha: 0.8 });
      }
      return;
    }
    const lineWidth = Math.max(1 / scale, 0.5);

    for (const node of nodes) {
      drawPolygon(this.selectionGraphics, nodeWorldCorners(node), {
        color: 0x2563eb,
        width: lineWidth,
        alpha: 0.95,
      });
    }

    if (nodes.length > 1) {
      const bounds = boundsForItems("selection", nodes.map(nodeBounds));
      if (bounds) {
        this.selectionGraphics
          .rect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
          .stroke({ color: 0x0f172a, width: lineWidth, alpha: 0.6 });
      }
    }
  }

  private drawHandles(nodes: BoardNode[], scale: number): void {
    if (boardLodStateForScale(scale).overlayMode === "simple" || nodes.length === 0) {
      this.hideHandles();
      return;
    }

    const bbox = boundsForItems(
      "selection-handles",
      nodes.map(nodeBounds),
    );
    if (!bbox) {
      this.hideHandles();
      return;
    }

    const radius = 5 / scale;
    const hitRadius = radius * 2;
    const strokeWidth = Math.max(1 / scale, 0.5);

    const corners: Record<ResizeHandleCorner, { x: number; y: number }> = {
      tl: { x: bbox.minX, y: bbox.minY },
      tr: { x: bbox.maxX, y: bbox.minY },
      bl: { x: bbox.minX, y: bbox.maxY },
      br: { x: bbox.maxX, y: bbox.maxY },
    };

    for (const handle of this.handles) {
      const point = corners[handle.corner];
      handle.graphics.position.set(point.x, point.y);
      handle.graphics.visible = true;
      handle.graphics.clear();
      handle.graphics
        .circle(0, 0, radius)
        .fill({ color: 0xffffff, alpha: 1 })
        .stroke({ color: 0x2563eb, width: strokeWidth, alpha: 1 });
      handle.graphics.hitArea = new Circle(0, 0, hitRadius);
    }
  }

  private hideHandles(): void {
    for (const handle of this.handles) {
      handle.graphics.visible = false;
    }
  }

  private drawMarquee(scale: number): void {
    this.marqueeGraphics.clear();
    if (!this.marqueeBounds) return;

    this.marqueeGraphics
      .rect(
        this.marqueeBounds.minX,
        this.marqueeBounds.minY,
        this.marqueeBounds.maxX - this.marqueeBounds.minX,
        this.marqueeBounds.maxY - this.marqueeBounds.minY,
      )
      .fill({ color: 0x2563eb, alpha: 0.08 })
      .stroke({
        color: 0x2563eb,
        width: Math.max(1 / scale, 0.5),
        alpha: 0.9,
      });
  }
}

function drawPolygon(
  graphics: Graphics,
  points: { x: number; y: number }[],
  stroke: { color: number; width: number; alpha: number },
): void {
  if (points.length === 0) return;

  graphics.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.closePath().stroke(stroke);
}
