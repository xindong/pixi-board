import { describe, expect, it } from "vitest";
import { mergeScenePatches, scenePatchHasDataChanges } from "./boardScenePatch";

describe("boardScenePatch", () => {
  it("merges node changes while letting removals win", () => {
    expect(
      mergeScenePatches([
        { addedNodeIds: ["a", "b"], selectionChanged: true },
        { updatedNodeIds: ["a"], assetChangedNodeIds: ["b"] },
        { removedNodeIds: ["b"] },
      ]),
    ).toEqual({
      addedNodeIds: ["a"],
      removedNodeIds: ["b"],
      updatedNodeIds: ["a"],
      assetChangedNodeIds: [],
      selectionChanged: true,
    });
  });

  it("separates data changes from selection-only changes", () => {
    expect(scenePatchHasDataChanges({ selectionChanged: true })).toBe(false);
    expect(scenePatchHasDataChanges({ updatedNodeIds: ["node-1"] })).toBe(true);
  });
});
