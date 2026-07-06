import type { BoardNode } from "./types";

export type Point = { x: number; y: number };

export type SpatialItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
};

export function normalizeBounds(start: Point, end: Point, id = "bounds"): SpatialItem {
  return {
    id,
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}

export function nodeBounds(node: BoardNode): SpatialItem {
  const corners = nodeWorldCorners(node);
  return {
    id: node.id,
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

export function nodeWorldCorners(node: BoardNode): Point[] {
  const localCorners: Point[] = [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: node.width, y: node.height },
    { x: 0, y: node.height },
  ];

  if (node.rotation === 0) {
    return localCorners.map((point) => ({
      x: node.x + point.x,
      y: node.y + point.y,
    }));
  }

  const cos = Math.cos(node.rotation);
  const sin = Math.sin(node.rotation);
  return localCorners.map((point) => ({
    x: node.x + point.x * cos - point.y * sin,
    y: node.y + point.x * sin + point.y * cos,
  }));
}

export function boundsForItems(id: string, items: SpatialItem[]): SpatialItem | null {
  if (items.length === 0) return null;
  return {
    id,
    minX: Math.min(...items.map((item) => item.minX)),
    minY: Math.min(...items.map((item) => item.minY)),
    maxX: Math.max(...items.map((item) => item.maxX)),
    maxY: Math.max(...items.map((item) => item.maxY)),
  };
}
