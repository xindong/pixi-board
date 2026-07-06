import { normalizeBounds, type Point } from "@pixi-board/board-domain";

export type MarqueeSelectionState = {
  start: Point;
  current: Point;
  additive: boolean;
};

type MarqueeSelectionOptions = {
  currentSelectionIds: Iterable<string>;
  queryNodeIds: (bounds: ReturnType<typeof normalizeBounds>) => string[];
  scale: number;
  state: MarqueeSelectionState;
};

export function resolveMarqueeSelection(options: MarqueeSelectionOptions): string[] {
  const bounds = normalizeBounds(options.state.start, options.state.current);
  if (isMarqueeClick(bounds, options.scale)) {
    return options.state.additive ? [...options.currentSelectionIds] : [];
  }

  const ids = options.queryNodeIds(bounds);
  if (!options.state.additive) return ids;
  return [...new Set([...options.currentSelectionIds, ...ids])];
}

function isMarqueeClick(
  bounds: ReturnType<typeof normalizeBounds>,
  scale: number,
): boolean {
  return bounds.maxX - bounds.minX < 4 / scale && bounds.maxY - bounds.minY < 4 / scale;
}
