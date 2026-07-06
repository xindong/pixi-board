import { describe, expect, it } from "vitest";
import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { canRefreshNodePreview } from "./boardPreviewService";

describe("canRefreshNodePreview", () => {
  it("allows refresh when the selected node points at a previewable asset", () => {
    expect(canRefreshNodePreview(createNode("node-1", "asset-image"), createAsset("asset-image", "image"))).toBe(true);
    expect(canRefreshNodePreview(createNode("node-1", "asset-video"), createAsset("asset-video", "video"))).toBe(true);
    expect(canRefreshNodePreview(createNode("node-1", "asset-audio"), createAsset("asset-audio", "audio"))).toBe(true);
    expect(canRefreshNodePreview(createNode("node-1", "asset-html"), createAsset("asset-html", "html"))).toBe(true);
  });

  it("hides refresh for missing, mismatched, or non-previewable assets", () => {
    expect(canRefreshNodePreview(createNode("node-1", "asset-image"), undefined)).toBe(false);
    expect(canRefreshNodePreview(createNode("node-1", "asset-image"), createAsset("other", "image"))).toBe(false);
    expect(canRefreshNodePreview(createNode("node-1", "asset-generating"), createAsset("asset-generating", "generating"))).toBe(false);
    expect(canRefreshNodePreview(createNode("node-1", "asset-importing"), createAsset("asset-importing", "importing"))).toBe(false);
  });
});

function createNode(id: string, assetId: string): BoardNode {
  return {
    id,
    type: "image",
    assetId,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 0,
  };
}

function createAsset(id: string, kind: Asset["kind"]): Asset {
  return {
    id,
    kind,
    localPath: `${id}.bin`,
    mimeType: "application/octet-stream",
    fileName: `${id}.bin`,
    size: 1,
    hash: `${id}-hash`,
    createdAt: 1,
    updatedAt: 1,
  };
}
