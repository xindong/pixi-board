import { describe, expect, it } from "vitest";
import type { BoardNode } from "@pixi-board/board-domain";
import { nodeLabelAnchor } from "./nodeLabelGeometry";

describe("nodeLabelAnchor", () => {
  it("uses the top-left node corner for unrotated nodes", () => {
    expect(nodeLabelAnchor(createNode())).toEqual({ x: 10, y: 20 });
  });

  it("uses the leftmost point of the rotated top edge", () => {
    const anchor = nodeLabelAnchor({
      ...createNode(),
      width: 100,
      height: 60,
      rotation: Math.PI / 2,
    });

    expect(anchor.x).toBeCloseTo(-50);
    expect(anchor.y).toBeCloseTo(20);
  });
});

function createNode(): BoardNode {
  return {
    id: "node",
    type: "image",
    assetId: "asset",
    x: 10,
    y: 20,
    width: 100,
    height: 60,
    rotation: 0,
    zIndex: 1,
  };
}
