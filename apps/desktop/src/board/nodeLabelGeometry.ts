import type { BoardNode } from "@pixi-board/board-domain";
import { nodeWorldCorners } from "@pixi-board/board-domain";

export function nodeLabelAnchor(node: BoardNode): { x: number; y: number } {
  const corners = nodeWorldCorners(node);
  const topEdge = [...corners]
    .sort((left, right) => left.y - right.y || left.x - right.x)
    .slice(0, 2);
  const leftTop = topEdge.reduce((left, point) => (point.x < left.x ? point : left), topEdge[0]);

  return {
    x: leftTop.x,
    y: leftTop.y,
  };
}
