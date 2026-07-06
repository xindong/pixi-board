import { describe, expect, it } from "vitest";
import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { BoardEditor } from "./boardEditor";
import { BoardStore } from "./boardStore";

describe("BoardEditor", () => {
  it("renames a node through history", () => {
    const store = new BoardStore();
    const editor = new BoardEditor(store);

    store.appendNodes([createNode({ id: "node-1", name: "before" })]);

    const mutation = editor.renameNode("node-1", "after");

    expect(mutation?.label).toBe("Rename node");
    expect(mutation?.scenePatch).toEqual({
      updatedNodeIds: ["node-1"],
      selectionChanged: true,
    });
    expect(store.getNode("node-1")?.name).toBe("after");

    editor.undo();
    expect(store.getNode("node-1")?.name).toBe("before");

    editor.redo();
    expect(store.getNode("node-1")?.name).toBe("after");
  });

  it("preserves an undefined previous name when undoing", () => {
    const store = new BoardStore();
    const editor = new BoardEditor(store);

    store.appendNodes([createNode({ id: "node-1" })]);

    editor.renameNode("node-1", "after");
    expect(store.getNode("node-1")?.name).toBe("after");

    editor.undo();
    expect(store.getNode("node-1")?.name).toBeUndefined();
  });

  it("transiently replaces node asset while keeping the visual center stable", () => {
    const store = new BoardStore();
    const editor = new BoardEditor(store);

    store.appendNodes([
      createNode({
        id: "node-1",
        x: 10,
        y: 20,
        width: 100,
        height: 80,
      }),
    ]);

    editor.replaceNodeAssetTransient("node-1", {
      asset: {
        id: "asset-2",
        kind: "image",
        createdAt: 1,
        updatedAt: 1,
      },
      width: 200,
      height: 120,
    });

    expect(store.getNode("node-1")).toEqual(
      expect.objectContaining({
        assetId: "asset-2",
        type: "image",
        x: -40,
        y: 0,
        width: 200,
        height: 120,
      }),
    );
    expect(store.getAsset("asset-2")?.kind).toBe("image");
  });

  it("does not add transient node changes to history", () => {
    const store = new BoardStore();
    const editor = new BoardEditor(store);

    editor.insertNodesTransient([createNode({ id: "node-1" })], {
      selectInserted: true,
    });
    editor.replaceNodeAssetTransient("node-1", {
      asset: {
        id: "asset-2",
        kind: "image",
        createdAt: 1,
        updatedAt: 1,
      },
    });

    expect(editor.canUndo).toBe(false);
    expect(store.getNode("node-1")?.assetId).toBe("asset-2");
  });

  it("transiently replaces multiple node assets and unlocks them", () => {
    const store = new BoardStore();
    const editor = new BoardEditor(store);

    store.appendNodes([
      createNode({ id: "node-1", locked: true }),
      createNode({ id: "node-2", locked: true }),
    ]);

    const mutation = editor.replaceNodeAssetsTransient([
      {
        nodeId: "node-1",
        replacement: {
          asset: createAsset("asset-1"),
          locked: false,
        },
      },
      {
        nodeId: "node-2",
        replacement: {
          asset: createAsset("asset-2"),
          locked: false,
        },
      },
    ]);

    expect(mutation?.label).toBe("Replace node assets");
    expect(mutation?.scenePatch).toEqual({
      updatedNodeIds: ["node-1", "node-2"],
      assetChangedNodeIds: ["node-1", "node-2"],
    });
    expect(store.getNode("node-1")).toEqual(
      expect.objectContaining({ assetId: "asset-1", locked: false }),
    );
    expect(store.getNode("node-2")).toEqual(
      expect.objectContaining({ assetId: "asset-2", locked: false }),
    );
    expect(editor.canUndo).toBe(false);
  });

  it("commits an already applied import as one undoable history entry", () => {
    const store = new BoardStore();
    const editor = new BoardEditor(store);
    const node = createNode({ id: "node-1", assetId: "asset-2" });

    editor.insertNodesTransient([node]);
    const mutation = editor.commitInsertedNodes([node], [], {
      label: "Import media",
    });

    expect(mutation?.label).toBe("Import media");
    expect(mutation?.scenePatch).toEqual({
      addedNodeIds: ["node-1"],
      selectionChanged: true,
    });
    expect(editor.canUndo).toBe(true);
    expect(store.getNode("node-1")).toBeDefined();

    editor.undo();
    expect(store.getNode("node-1")).toBeUndefined();

    editor.redo();
    expect(store.getNode("node-1")?.assetId).toBe("asset-2");
  });
});

function createNode(overrides: Partial<BoardNode> = {}): BoardNode {
  return {
    id: "node",
    type: "image",
    assetId: "asset",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    rotation: 0,
    zIndex: 1,
    ...overrides,
  };
}

function createAsset(id: string): Asset {
  return {
    id,
    kind: "image",
    createdAt: 1,
    updatedAt: 1,
  };
}
