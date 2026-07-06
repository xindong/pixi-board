import { clamp } from "../utils";
import { normalizeBounds, type Point, type SpatialItem } from "@pixi-board/board-domain";
import type { BoardViewportSnapshot } from "@pixi-board/board-domain";

const MIN_SCALE = 0.02;
const MAX_SCALE = 1.5;

export class BoardViewport {
  private currentScale = 1;
  private currentOffset: Point = { x: 0, y: 0 };

  get scale(): number {
    return this.currentScale;
  }

  get offset(): Point {
    return { ...this.currentOffset };
  }

  center(size: { width: number; height: number }): void {
    this.currentOffset = {
      x: size.width / 2,
      y: size.height / 2,
    };
  }

  fitBounds(
    bounds: SpatialItem,
    screen: { width: number; height: number },
    options: { padding?: number; maxScale?: number } = {},
  ): void {
    const padding = options.padding ?? 72;
    const maxScale = options.maxScale ?? 1;
    const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const availableWidth = Math.max(screen.width - padding * 2, 1);
    const availableHeight = Math.max(screen.height - padding * 2, 1);
    const nextScale = clamp(
      Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight),
      MIN_SCALE,
      Math.min(maxScale, MAX_SCALE),
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.currentScale = nextScale;
    this.currentOffset = {
      x: screen.width / 2 - centerX * nextScale,
      y: screen.height / 2 - centerY * nextScale,
    };
  }

  loadSnapshot(snapshot: BoardViewportSnapshot): void {
    this.currentScale = clamp(snapshot.scale, MIN_SCALE, MAX_SCALE);
    this.currentOffset = {
      x: Number.isFinite(snapshot.offset.x) ? snapshot.offset.x : 0,
      y: Number.isFinite(snapshot.offset.y) ? snapshot.offset.y : 0,
    };
  }

  snapshot(): BoardViewportSnapshot {
    return {
      scale: this.currentScale,
      offset: { ...this.currentOffset },
    };
  }

  panBy(deltaX: number, deltaY: number): void {
    this.currentOffset = {
      x: this.currentOffset.x + deltaX,
      y: this.currentOffset.y + deltaY,
    };
  }

  zoomAt(screenPoint: Point, deltaY: number): void {
    const oldScale = this.currentScale;
    const nextScale = clamp(oldScale * Math.exp(-deltaY * 0.01), MIN_SCALE, MAX_SCALE);
    const world = this.screenToWorld(screenPoint);

    this.currentScale = nextScale;
    this.currentOffset = {
      x: screenPoint.x - world.x * nextScale,
      y: screenPoint.y - world.y * nextScale,
    };
  }

  screenToWorld(point: Point): Point {
    return {
      x: (point.x - this.currentOffset.x) / this.currentScale,
      y: (point.y - this.currentOffset.y) / this.currentScale,
    };
  }

  worldToScreen(point: Point): Point {
    return {
      x: point.x * this.currentScale + this.currentOffset.x,
      y: point.y * this.currentScale + this.currentOffset.y,
    };
  }

  visibleWorldBounds(
    screen: { width: number; height: number },
    padding: number,
  ): SpatialItem {
    const topLeft = this.screenToWorld({ x: -padding, y: -padding });
    const bottomRight = this.screenToWorld({
      x: screen.width + padding,
      y: screen.height + padding,
    });

    return normalizeBounds(topLeft, bottomRight, "viewport");
  }
}
