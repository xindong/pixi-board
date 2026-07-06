import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import type {
  AssetPreparationContext,
  AssetPreparationRepository,
  AssetPreparationStage,
} from "./assetPreparationTypes";
import { getAssetDerivativePath } from "@pixi-board/board-domain";
import { AssetPipeline } from "./assetPipeline";

describe("AssetPipeline", () => {
  it("runs every matching preparation stage in order", async () => {
    const firstPrepare = vi.fn(async (asset: Asset) => ({
      ...asset,
      derivatives: {
        ...asset.derivatives,
        preview: createDerivative("prepared-preview.webp"),
      },
    }));
    const secondPrepare = vi.fn(async (asset: Asset) => ({
      ...asset,
      derivatives: {
        ...asset.derivatives,
        derived: createDerivative("prepared-derived.webp"),
      },
    }));

    const pipeline = new AssetPipeline(createRepository(), {
      stages: [
        createStage(
          (asset) => asset.kind === "image",
          firstPrepare,
        ),
        createStage(
          (asset) => asset.kind === "image" && Boolean(asset.derivatives?.preview),
          secondPrepare,
        ),
      ],
    });

    const [image, video] = await pipeline.prepareAssets([
      createAsset("image-1", "image"),
      createAsset("video-1", "video"),
    ]);

    expect(getAssetDerivativePath(image, "preview")).toBe("prepared-preview.webp");
    expect(getAssetDerivativePath(image, "derived")).toBe("prepared-derived.webp");
    expect(video).toEqual(createAsset("video-1", "video"));
    expect(firstPrepare).toHaveBeenCalledTimes(1);
    expect(secondPrepare).toHaveBeenCalledWith(
      expect.objectContaining({
        derivatives: expect.objectContaining({
          preview: expect.objectContaining({ localPath: "prepared-preview.webp" }),
        }),
      }),
      { priority: "background" },
    );
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

function createDerivative(localPath: string) {
  return {
    localPath,
    extension: "webp",
    createdAt: 1,
    updatedAt: 1,
  };
}
