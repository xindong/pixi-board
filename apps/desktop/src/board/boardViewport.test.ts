import { describe, expect, it } from "vitest";
import { BoardViewport } from "./boardViewport";

describe("BoardViewport", () => {
  it("converts world and screen points symmetrically", () => {
    const viewport = new BoardViewport();
    viewport.loadSnapshot({
      scale: 0.75,
      offset: { x: 120, y: -40 },
    });

    const screen = { x: 320, y: 240 };
    const world = viewport.screenToWorld(screen);

    expect(viewport.worldToScreen(world)).toEqual(screen);
  });
});
