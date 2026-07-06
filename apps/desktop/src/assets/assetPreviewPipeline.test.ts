import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import {
  AssetPreviewPipeline,
  canPrepareAssetPreview,
} from "./assetPreviewPipeline";
import { AssetPreviewJobRunner } from "./assetPreviewJobRunner";
import type {
  AssetPreparationContext,
  AssetPreparationRepository,
  AssetPreparationStage,
} from "./assetPreparationTypes";

describe("AssetPreviewPipeline", () => {
  it("runs matching preview stages with the provided context", async () => {
    const context: AssetPreparationContext = {
      force: true,
      size: { width: 320, height: 180 },
    };
    const prepare = vi.fn(async (asset: Asset) => ({
      ...asset,
      width: context.size?.width,
      height: context.size?.height,
    }));
    const supports = vi.fn((asset: Asset) => asset.kind === "image");
    const pipeline = new AssetPreviewPipeline(createRepository(), {
      scheduler: vi.fn(async () => undefined),
      stages: [createStage(supports, prepare)],
    });

    const result = await pipeline.prepareAsset(createAsset("image"), context);

    expect(supports).toHaveBeenCalledWith(expect.objectContaining({ kind: "image" }), context);
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ kind: "image" }), context);
    expect(result.width).toBe(320);
    expect(result.height).toBe(180);
  });

  it("uses the injected shared preview runner", async () => {
    const runner = new AssetPreviewJobRunner({
      scheduler: vi.fn(async () => undefined),
    });
    const prepare = vi.fn(async (asset: Asset) => asset);
    const pipeline = new AssetPreviewPipeline(createRepository(), {
      runner,
      stages: [createStage(() => true, prepare)],
    });

    await pipeline.prepareAsset(createAsset("image"), { priority: "user" });

    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "image" }),
      { priority: "user" },
    );
  });

  it("reports previewable asset kinds for board-level refresh controls", () => {
    expect(canPrepareAssetPreview(createAsset("image"))).toBe(true);
    expect(canPrepareAssetPreview(createAsset("video"))).toBe(true);
    expect(canPrepareAssetPreview(createAsset("audio"))).toBe(true);
    expect(canPrepareAssetPreview(createAsset("model"))).toBe(true);
    expect(canPrepareAssetPreview(createAsset("markdown"))).toBe(true);
    expect(canPrepareAssetPreview(createAsset("generating"))).toBe(false);
    expect(canPrepareAssetPreview(createAsset("importing"))).toBe(false);
  });
});

function createStage(
  supports: (asset: Asset, context?: AssetPreparationContext) => boolean,
  prepare: (asset: Asset, context?: AssetPreparationContext) => Promise<Asset>,
): AssetPreparationStage {
  return {
    supports,
    prepare,
  };
}

function createRepository(): AssetPreparationRepository {
  return {
    resolveAssetUrl: vi.fn(async () => ""),
    updateAssetMetadata: vi.fn(async () => {
      throw new Error("updateAssetMetadata should not be called in this test");
    }),
    saveDerivative: vi.fn(async () => {
      throw new Error("saveDerivative should not be called in this test");
    }),
    saveDerivatives: vi.fn(async () => {
      throw new Error("saveDerivatives should not be called in this test");
    }),
  };
}

function createAsset(kind: Asset["kind"]): Asset {
  return {
    id: `asset-${kind}`,
    kind,
    localPath: `${kind}.bin`,
    mimeType: "application/octet-stream",
    fileName: `${kind}.bin`,
    size: 1,
    hash: `${kind}-hash`,
    createdAt: 1,
    updatedAt: 1,
  };
}
