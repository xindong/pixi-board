import type { Point } from "@pixi-board/board-domain";
import type { NodeBounds } from "./boardStore";

export function pointMapsMatch(
  left: Map<string, Point>,
  right: Map<string, Point>,
): boolean {
  if (left.size !== right.size) return false;

  for (const [id, point] of left.entries()) {
    const other = right.get(id);
    if (!other || other.x !== point.x || other.y !== point.y) {
      return false;
    }
  }

  return true;
}

export function boundsMapsMatch(
  left: Map<string, NodeBounds>,
  right: Map<string, NodeBounds>,
): boolean {
  if (left.size !== right.size) return false;

  for (const [id, bounds] of left.entries()) {
    const other = right.get(id);
    if (
      !other ||
      other.x !== bounds.x ||
      other.y !== bounds.y ||
      other.width !== bounds.width ||
      other.height !== bounds.height
    ) {
      return false;
    }
  }

  return true;
}
