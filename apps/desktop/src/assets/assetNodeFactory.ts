import type { Point } from "@pixi-board/board-domain";
import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { baseNameWithoutExtension, createId } from "../utils";
import { suggestAssetNodeSize } from "./assetSizing";

const DEFAULT_STACK_X = 36;
const DEFAULT_STACK_Y = 28;
const DEFAULT_PLACEMENT_GAP = 32;
const MAX_PLACEMENT_RINGS = 24;
const MIN_PLACEMENT_STEP = 48;

export type AssetPlacement = {
  center: Point;
  stackOffset?: Point;
  existingNodes?: readonly BoardNode[];
  placementGap?: number;
  nodes?: Array<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    options?: Record<string, unknown>;
  }>;
};

type AssetNodeFactoryOptions = {
  getNextZIndex: () => number;
};

export class AssetNodeFactory {
  private readonly getNextZIndex: AssetNodeFactoryOptions["getNextZIndex"];

  constructor(options: AssetNodeFactoryOptions) {
    this.getNextZIndex = options.getNextZIndex;
  }

  createNodes(assets: Asset[], placement: AssetPlacement): BoardNode[] {
    let zIndex = this.getNextZIndex();
    const stackOffset = placement.stackOffset ?? {
      x: DEFAULT_STACK_X,
      y: DEFAULT_STACK_Y,
    };
    const placedNodes: BoardNode[] = [];
    const existingNodes = placement.existingNodes ?? [];

    return assets.map((asset, index) => {
      const nodePlacement = placement.nodes?.[index];
      const size = suggestAssetNodeSize(asset);
      const centeredIndexOffset = index - (assets.length - 1) / 2;
      const name = nodePlacement?.name ?? assetDisplayName(asset);
      const desiredPosition = {
        x: nodePlacement?.x ?? placement.center.x + centeredIndexOffset * stackOffset.x,
        y: nodePlacement?.y ?? placement.center.y + centeredIndexOffset * stackOffset.y,
      };
      const position =
        existingNodes.length > 0
          ? findAvailableNodePosition({
              ...desiredPosition,
              width: nodePlacement?.width ?? size.width,
              height: nodePlacement?.height ?? size.height,
              existingNodes: [...existingNodes, ...placedNodes],
              gap: placement.placementGap,
            })
          : desiredPosition;

      const node: BoardNode = {
        id: createId("node"),
        name,
        type: asset.kind,
        assetId: asset.id,
        options: nodePlacement?.options,
        x: position.x,
        y: position.y,
        width: nodePlacement?.width ?? size.width,
        height: nodePlacement?.height ?? size.height,
        rotation: 0,
        zIndex: zIndex++,
      };
      placedNodes.push(node);
      return node;
    });
  }
}

export type AvailableNodePositionInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  existingNodes: readonly BoardNode[];
  gap?: number;
};

export function findAvailableNodePosition(input: AvailableNodePositionInput): Point {
  const gap = input.gap ?? DEFAULT_PLACEMENT_GAP;
  const desired = { x: input.x, y: input.y };
  if (
    !overlapsAnyNode(
      { ...desired, width: input.width, height: input.height },
      input.existingNodes,
      gap,
    )
  ) {
    return desired;
  }

  const stepX = Math.max(input.width + gap, MIN_PLACEMENT_STEP);
  const stepY = Math.max(input.height + gap, MIN_PLACEMENT_STEP);

  for (let ring = 1; ring <= MAX_PLACEMENT_RINGS; ring++) {
    const candidates = candidateOffsetsForRing(ring)
      .map(({ x, y }) => ({
        x: input.x + x * stepX,
        y: input.y + y * stepY,
      }))
      .sort((left, right) => {
        const leftMovesHorizontally = left.x !== input.x;
        const rightMovesHorizontally = right.x !== input.x;
        if (leftMovesHorizontally !== rightMovesHorizontally) {
          return leftMovesHorizontally ? -1 : 1;
        }
        return distanceSquared(input, left) - distanceSquared(input, right);
      });

    for (const candidate of candidates) {
      if (
        !overlapsAnyNode(
          { ...candidate, width: input.width, height: input.height },
          input.existingNodes,
          gap,
        )
      ) {
        return candidate;
      }
    }
  }

  return {
    x: input.x + (MAX_PLACEMENT_RINGS + 1) * stepX,
    y: input.y + (MAX_PLACEMENT_RINGS + 1) * stepY,
  };
}

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function overlapsAnyNode(rect: NodeRect, nodes: readonly BoardNode[], gap: number): boolean {
  return nodes.some((node) => rectanglesOverlap(rect, expandedNodeRect(node, gap)));
}

function expandedNodeRect(node: BoardNode, gap: number): NodeRect {
  return {
    x: node.x - gap,
    y: node.y - gap,
    width: node.width + gap * 2,
    height: node.height + gap * 2,
  };
}

function rectanglesOverlap(left: NodeRect, right: NodeRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function candidateOffsetsForRing(ring: number): Point[] {
  const offsets: Point[] = [];
  for (let y = -ring; y <= ring; y++) {
    for (let x = -ring; x <= ring; x++) {
      if (Math.abs(x) === ring || Math.abs(y) === ring) {
        offsets.push({ x, y });
      }
    }
  }
  return offsets;
}

function distanceSquared(origin: Point, point: Point): number {
  return (point.x - origin.x) ** 2 + (point.y - origin.y) ** 2;
}

function assetDisplayName(asset: Asset): string {
  if (asset.fileName) return baseNameWithoutExtension(asset.fileName);
  const title = asset.metadata?.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return asset.kind;
}
