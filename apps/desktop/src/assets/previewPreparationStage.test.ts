import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import type { AssetPreparationRepository } from "./assetPreparationTypes";

const previewGeneratorsModule = vi.hoisted(() => ({
  previewGenerators: {
    image: vi.fn(),
    video: vi.fn(),
    audio: vi.fn(),
    model: vi.fn(),
  },
  isPreviewGeneratorKind: (kind: string) => ["image", "video", "audio", "model"].includes(kind),
}));

vi.mock("./previewGenerators", () => previewGeneratorsModule);

import { PreviewPreparationStage } from "./previewPreparationStage";

describe("PreviewPreparationStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const generator of Object.values(previewGeneratorsModule.previewGenerators)) {
      generator.mockResolvedValue({
        extension: "webp",
        bytes: [1, 2, 3],
        metadata: {
          width: 640,
          height: 420,
        },
      });
    }
    previewGeneratorsModule.previewGenerators.video.mockResolvedValue({
      extension: "webp",
      bytes: [4, 5, 6],
      metadata: {
        width: 1920,
        height: 1080,
        duration: 12.5,
      },
    });
  });

  it("generates and saves a preview derivative through the asset kind generator", async () => {
    const asset = createAsset("image");
    const repository = createRepository(asset);

    const result = await new PreviewPreparationStage(repository).prepare(asset);

    expect(repository.resolveAssetUrl).toHaveBeenCalledWith("asset-1", "original");
    expect(previewGeneratorsModule.previewGenerators.image).toHaveBeenCalledWith(
      asset,
      "asset://original",
      undefined,
    );
    expect(repository.saveDerivatives).toHaveBeenCalledWith({
      assetId: "asset-1",
      derivatives: [
        {
          variant: "preview",
          extension: "webp",
          bytes: [1, 2, 3],
        },
      ],
      metadata: {
        width: 640,
        height: 420,
      },
    });
    expect(result.derivatives?.preview).toBeDefined();
  });

  it("updates metadata without rewriting an existing preview", async () => {
    const asset = {
      ...createAsset("video"),
      derivatives: {
        preview: createDerivative("assets/previews/asset-1-preview.webp"),
      },
    };
    const repository = createRepository(asset);

    const result = await new PreviewPreparationStage(repository).prepare(asset);

    expect(previewGeneratorsModule.previewGenerators.video).toHaveBeenCalledWith(
      asset,
      "asset://original",
      undefined,
    );
    expect(repository.updateAssetMetadata).toHaveBeenCalledWith("asset-1", {
      width: 1920,
      height: 1080,
      duration: 12.5,
    });
    expect(repository.saveDerivatives).not.toHaveBeenCalled();
    expect(result.duration).toBe(12.5);
  });

  it("forced refresh rewrites an existing preview derivative", async () => {
    const asset = {
      ...createAsset("image"),
      width: 640,
      height: 420,
      derivatives: {
        preview: createDerivative("assets/previews/existing.webp"),
      },
    };
    const repository = createRepository(asset);

    const context = {
      force: true,
      refreshPreviewOnly: true,
      size: { width: 320, height: 180 },
    };

    await new PreviewPreparationStage(repository).prepare(asset, context);

    expect(previewGeneratorsModule.previewGenerators.image).toHaveBeenCalledWith(
      asset,
      "asset://original",
      context,
    );
    expect(repository.saveDerivatives).toHaveBeenCalledWith({
      assetId: "asset-1",
      derivatives: [
        {
          variant: "preview",
          extension: "webp",
          bytes: [1, 2, 3],
        },
      ],
      metadata: {
        width: 640,
        height: 420,
      },
    });
    expect(repository.updateAssetMetadata).not.toHaveBeenCalled();
  });
});

function createRepository(asset: Asset): AssetPreparationRepository {
  return {
    resolveAssetUrl: vi.fn(async () => "asset://original"),
    saveDerivative: vi.fn(async () => {
      throw new Error("saveDerivative should not be called");
    }),
    saveDerivatives: vi.fn(async (input) => ({
      ...asset,
      derivatives: {
        ...asset.derivatives,
        [input.derivatives[0].variant]: createDerivative("assets/previews/asset-1-preview.webp"),
      },
      ...input.metadata,
    })),
    updateAssetMetadata: vi.fn(async (_assetId, metadata) => ({
      ...asset,
      ...metadata,
    })),
  };
}

function createAsset(kind: Asset["kind"]): Asset {
  return {
    id: "asset-1",
    kind,
    localPath: `assets/originals/asset-1.${kind === "audio" ? "mp3" : "bin"}`,
    mimeType: "application/octet-stream",
    fileName: `asset-1.${kind === "audio" ? "mp3" : "bin"}`,
    size: 1,
    hash: "hash",
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
