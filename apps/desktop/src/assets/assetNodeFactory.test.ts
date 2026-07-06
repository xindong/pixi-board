import { describe, expect, it } from "vitest";
import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { AssetNodeFactory } from "./assetNodeFactory";

describe("AssetNodeFactory", () => {
  it("stacks imported nodes around the placement center and increments z-index", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 7,
    });

    const assets: Asset[] = [
      createAsset("asset-1"),
      createAsset("asset-2"),
      createAsset("asset-3"),
    ];

    const nodes = factory.createNodes(assets, {
      center: { x: 100, y: 200 },
    });

    expect(
      nodes.map((node) => ({
        assetId: node.assetId,
        x: node.x,
        y: node.y,
        zIndex: node.zIndex,
      })),
    ).toEqual([
      { assetId: "asset-1", x: 64, y: 172, zIndex: 7 },
      { assetId: "asset-2", x: 100, y: 200, zIndex: 8 },
      { assetId: "asset-3", x: 136, y: 228, zIndex: 9 },
    ]);
  });

  it("keeps the requested position when it does not overlap existing nodes", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const [node] = factory.createNodes([createAsset("asset-1")], {
      center: { x: 500, y: 500 },
      existingNodes: [createNode({ x: 0, y: 0, width: 100, height: 100 })],
    });

    expect({ x: node.x, y: node.y }).toEqual({ x: 500, y: 500 });
  });

  it("places new nodes at nearby non-overlapping positions", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const nodes = factory.createNodes(
      [createAsset("asset-1"), createAsset("asset-2")],
      {
        center: { x: 0, y: 0 },
        stackOffset: { x: 0, y: 0 },
        existingNodes: [createNode({ x: 0, y: 0, width: 320, height: 240 })],
      },
    );

    expect(nodes[0].x).not.toBe(0);
    expect(rectanglesOverlap(nodes[0], nodes[1])).toBe(false);
  });

  it("uses original image dimensions when metadata is available", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const [node] = factory.createNodes(
      [
        createAsset("asset-large", {
          width: 1920,
          height: 1080,
        }),
      ],
      {
        center: { x: 0, y: 0 },
      },
    );

    expect({
      width: node.width,
      height: node.height,
    }).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("uses the square loading size when image dimensions are missing", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const [node] = factory.createNodes(
      [
        createAsset("asset-missing-size", {
          width: undefined,
          height: undefined,
        }),
      ],
      {
        center: { x: 0, y: 0 },
      },
    );

    expect({
      width: node.width,
      height: node.height,
    }).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it("uses original video dimensions when metadata is available", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const [node] = factory.createNodes(
      [
        createAsset("asset-video", {
          kind: "video",
          localPath: "asset-video.mp4",
          mimeType: "video/mp4",
          fileName: "asset-video.mp4",
          width: 1920,
          height: 1080,
        }),
      ],
      {
        center: { x: 0, y: 0 },
      },
    );

    expect({
      width: node.width,
      height: node.height,
    }).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("uses original model dimensions when metadata is available", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const [node] = factory.createNodes(
      [
        createAsset("asset-model", {
          kind: "model",
          localPath: "asset-model.glb",
          mimeType: "model/gltf-binary",
          fileName: "asset-model.glb",
          width: 960,
          height: 540,
        }),
      ],
      {
        center: { x: 0, y: 0 },
      },
    );

    expect({
      width: node.width,
      height: node.height,
    }).toEqual({
      width: 960,
      height: 540,
    });
  });

  it("uses the default fitted size for audio nodes", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const [node] = factory.createNodes(
      [
        createAsset("asset-audio", {
          kind: "audio",
          localPath: "asset-audio.mp3",
          mimeType: "audio/mpeg",
          fileName: "asset-audio.mp3",
          width: undefined,
          height: undefined,
        }),
      ],
      {
        center: { x: 0, y: 0 },
      },
    );

    expect({
      width: node.width,
      height: node.height,
    }).toEqual({
      width: 2160,
      height: 1080,
    });
  });

  it("uses the asset file basename as the default node name", () => {
    const factory = new AssetNodeFactory({
      getNextZIndex: () => 1,
    });

    const nodes = factory.createNodes(
      [
        createAsset("asset-image", {
          fileName: "scene.final.png",
        }),
        createAsset("asset-audio", {
          fileName: "voice",
        }),
        createAsset("asset-empty", {
          fileName: ".mp3",
        }),
      ],
      {
        center: { x: 0, y: 0 },
      },
    );

    expect(nodes.map((node) => node.name)).toEqual(["scene.final", "voice", ""]);
  });
});

function createAsset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    kind: "image",
    localPath: `${id}.png`,
    mimeType: "image/png",
    fileName: `${id}.png`,
    size: 1,
    hash: `${id}-hash`,
    width: 320,
    height: 240,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createNode(overrides: Partial<BoardNode> = {}): BoardNode {
  return {
    id: "node",
    type: "image",
    assetId: "asset",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 1,
    ...overrides,
  };
}

function rectanglesOverlap(left: BoardNode, right: BoardNode): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}
