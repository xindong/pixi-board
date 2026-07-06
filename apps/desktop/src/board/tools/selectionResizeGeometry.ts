import type { Point } from "@pixi-board/board-domain";
import type { NodeBounds } from "../boardStore";
import type { ResizeHandleCorner } from "../boardScene";
import { clamp } from "../../utils";

const MIN_RESIZE_DIMENSION = 32;

export type SelectionResizeBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function oppositeResizeAnchor(
  corner: ResizeHandleCorner,
  bbox: SelectionResizeBox,
): Point {
  switch (corner) {
    case "tl":
      return { x: bbox.maxX, y: bbox.maxY };
    case "tr":
      return { x: bbox.minX, y: bbox.maxY };
    case "bl":
      return { x: bbox.maxX, y: bbox.minY };
    case "br":
      return { x: bbox.minX, y: bbox.minY };
  }
}

export function resizeBoundsFromPointer(
  options: {
    anchor: Point;
    bboxBefore: SelectionResizeBox;
    beforeBounds: Map<string, NodeBounds>;
    corner: ResizeHandleCorner;
    pointerWorld: Point;
  },
): Map<string, NodeBounds> {
  const oldWidth = options.bboxBefore.maxX - options.bboxBefore.minX;
  const oldHeight = options.bboxBefore.maxY - options.bboxBefore.minY;
  const minScaleX = oldWidth > 0 ? MIN_RESIZE_DIMENSION / oldWidth : 1;
  const minScaleY = oldHeight > 0 ? MIN_RESIZE_DIMENSION / oldHeight : 1;

  const oldSpanX = draggedCornerX(options.corner, options.bboxBefore) - options.anchor.x;
  const oldSpanY = draggedCornerY(options.corner, options.bboxBefore) - options.anchor.y;
  const rawSpanX = options.pointerWorld.x - options.anchor.x;
  const rawSpanY = options.pointerWorld.y - options.anchor.y;
  const safeScaleX = clamp(oldSpanX === 0 ? 1 : rawSpanX / oldSpanX, minScaleX, 50);
  const safeScaleY = clamp(oldSpanY === 0 ? 1 : rawSpanY / oldSpanY, minScaleY, 50);

  const nextBounds = new Map<string, NodeBounds>();
  for (const [id, before] of options.beforeBounds.entries()) {
    nextBounds.set(id, {
      x: options.anchor.x + (before.x - options.anchor.x) * safeScaleX,
      y: options.anchor.y + (before.y - options.anchor.y) * safeScaleY,
      width: Math.max(MIN_RESIZE_DIMENSION, before.width * safeScaleX),
      height: Math.max(MIN_RESIZE_DIMENSION, before.height * safeScaleY),
    });
  }
  return nextBounds;
}

function draggedCornerX(
  corner: ResizeHandleCorner,
  bbox: { minX: number; maxX: number },
): number {
  return corner === "tl" || corner === "bl" ? bbox.minX : bbox.maxX;
}

function draggedCornerY(
  corner: ResizeHandleCorner,
  bbox: { minY: number; maxY: number },
): number {
  return corner === "tl" || corner === "tr" ? bbox.minY : bbox.maxY;
}
