import { nodeBounds, type BoardNode } from "@pixi-board/board-domain";

const NODE_TYPE_VALUES = ["image", "video", "audio", "model", "text", "markdown", "html", "importing", "generating"] as const;

export type NodeFilter = {
  type?: BoardNode["type"];
  keyword?: string;
  bounds?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
  };
};

type NormalizedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function filterNodes(nodes: BoardNode[], filter: unknown): BoardNode[] {
  const parsed = parseFilter(filter);
  return nodes.filter((node) => matchesType(node, parsed) && matchesKeyword(node, parsed) && matchesBounds(node, parsed));
}

function parseFilter(filter: unknown): NodeFilter {
  if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
    return {};
  }
  const source = filter as Record<string, unknown>;
  const parsed: NodeFilter = {};
  if (typeof source.type === "string" && NODE_TYPE_VALUES.includes(source.type as BoardNode["type"])) {
    parsed.type = source.type as BoardNode["type"];
  }
  if (typeof source.keyword === "string") {
    parsed.keyword = source.keyword;
  } else if (typeof source.name === "string") {
    parsed.keyword = source.name;
  } else if (typeof source.text === "string") {
    parsed.keyword = source.text;
  }
  if (source.bounds && typeof source.bounds === "object" && !Array.isArray(source.bounds)) {
    parsed.bounds = source.bounds as NodeFilter["bounds"];
  }
  return parsed;
}

function matchesType(node: BoardNode, filter: NodeFilter): boolean {
  return !filter.type || node.type === filter.type;
}

function matchesKeyword(node: BoardNode, filter: NodeFilter): boolean {
  const keyword = filter.keyword?.trim().toLowerCase();
  if (!keyword) return true;
  const haystack = [node.id, node.type, node.name ?? "", node.assetId].join("\n").toLowerCase();
  return haystack.includes(keyword);
}

function matchesBounds(node: BoardNode, filter: NodeFilter): boolean {
  if (!filter.bounds) return true;
  const bounds = normalizeBounds(filter.bounds);
  if (!bounds) return true;
  const current = nodeBounds(node);
  return (
    current.maxX >= bounds.minX &&
    current.minX <= bounds.maxX &&
    current.maxY >= bounds.minY &&
    current.minY <= bounds.maxY
  );
}

function normalizeBounds(bounds: NonNullable<NodeFilter["bounds"]>): NormalizedBounds | null {
  if (
    typeof bounds.minX === "number" &&
    typeof bounds.minY === "number" &&
    typeof bounds.maxX === "number" &&
    typeof bounds.maxY === "number"
  ) {
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    };
  }
  if (
    typeof bounds.x === "number" &&
    typeof bounds.y === "number" &&
    typeof bounds.width === "number" &&
    typeof bounds.height === "number"
  ) {
    return {
      minX: bounds.x,
      minY: bounds.y,
      maxX: bounds.x + bounds.width,
      maxY: bounds.y + bounds.height,
    };
  }
  return null;
}
