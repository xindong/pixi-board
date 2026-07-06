import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import type { AssetPreparationRepository } from "./assetPreparationTypes";

const rendererModule = vi.hoisted(() => ({
  isTextLikeAssetKind: (kind: string) => kind === "text" || kind === "markdown" || kind === "html",
  renderTextLikeErrorPreview: vi.fn(),
  renderTextLikePreview: vi.fn(),
}));

vi.mock("./textLikePreviewRenderer", () => rendererModule);

import { TextLikePreviewPreparationStage } from "./textLikePreviewPreparationStage";

describe("TextLikePreviewPreparationStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "# Hello",
      })),
    );
    rendererModule.renderTextLikePreview.mockResolvedValue({
      extension: "webp",
      bytes: [1, 2, 3],
      metadata: {
        width: 960,
        height: 600,
        metadata: {
          previewWidth: 960,
          previewHeight: 600,
        },
      },
    });
    rendererModule.renderTextLikeErrorPreview.mockResolvedValue({
      extension: "png",
      bytes: [9, 8, 7],
      metadata: {
        width: 320,
        height: 180,
        metadata: {
          previewWidth: 320,
          previewHeight: 180,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a preview derivative and preserves existing asset metadata", async () => {
    const asset = createAsset("markdown");
    const repository = createRepository(asset);

    const result = await new TextLikePreviewPreparationStage(repository, {
      size: { width: 960, height: 600 },
    }).prepare(asset);

    expect(repository.resolveAssetUrl).toHaveBeenCalledWith("asset-markdown", "original");
    expect(rendererModule.renderTextLikePreview).toHaveBeenCalledWith(
      asset,
      "# Hello",
      { width: 960, height: 600 },
    );
    expect(repository.saveDerivatives).toHaveBeenCalledWith({
      assetId: "asset-markdown",
      derivatives: [
        {
          variant: "preview",
          extension: "webp",
          bytes: [1, 2, 3],
        },
      ],
      metadata: {
        width: 960,
        height: 600,
        metadata: {
          title: "Original title",
          previewWidth: 960,
          previewHeight: 600,
        },
      },
    });
    expect(result.derivatives?.preview).toBeDefined();
  });

  it("skips assets that already have a preview unless forced", async () => {
    const asset = {
      ...createAsset("html"),
      derivatives: {
        preview: createDerivative("assets/previews/existing.webp"),
      },
    };
    const repository = createRepository(asset);

    const result = await new TextLikePreviewPreparationStage(repository).prepare(asset);

    expect(result).toBe(asset);
    expect(repository.resolveAssetUrl).not.toHaveBeenCalled();
    expect(repository.saveDerivatives).not.toHaveBeenCalled();
  });

  it("forced refresh uses the requested node bounds", async () => {
    const asset = {
      ...createAsset("html"),
      derivatives: {
        preview: createDerivative("assets/previews/existing.webp"),
      },
    };
    const repository = createRepository(asset);

    await new TextLikePreviewPreparationStage(repository, {
      force: true,
      size: { width: 380, height: 200 },
    }).prepare(asset);

    expect(rendererModule.renderTextLikePreview).toHaveBeenCalledWith(
      asset,
      "# Hello",
      { width: 380, height: 200 },
    );
  });

  it("context force and size override constructor defaults", async () => {
    const asset = {
      ...createAsset("html"),
      derivatives: {
        preview: createDerivative("assets/previews/existing.webp"),
      },
    };
    const repository = createRepository(asset);

    await new TextLikePreviewPreparationStage(repository, {
      force: false,
      size: { width: 200, height: 120 },
    }).prepare(asset, {
      force: true,
      size: { width: 480, height: 260 },
    });

    expect(rendererModule.renderTextLikePreview).toHaveBeenCalledWith(
      asset,
      "# Hello",
      { width: 480, height: 260 },
    );
  });

  it("saves an error placeholder preview when source rendering fails", async () => {
    const asset = createAsset("text");
    const repository = createRepository(asset);
    rendererModule.renderTextLikePreview.mockRejectedValueOnce(new Error("boom"));

    await new TextLikePreviewPreparationStage(repository, {
      size: { width: 320, height: 180 },
    }).prepare(asset);

    expect(rendererModule.renderTextLikeErrorPreview).toHaveBeenCalledWith(
      asset,
      "预览生成失败",
      { width: 320, height: 180 },
    );
    expect(repository.saveDerivatives).toHaveBeenCalledWith({
      assetId: "asset-text",
      derivatives: [
        {
          variant: "preview",
          extension: "png",
          bytes: [9, 8, 7],
        },
      ],
      metadata: {
        width: 320,
        height: 180,
        metadata: {
          title: "Original title",
          previewWidth: 320,
          previewHeight: 180,
        },
      },
    });
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
        [input.derivatives[0].variant]: createDerivative("assets/previews/asset-preview.webp"),
      },
      ...input.metadata,
    })),
    updateAssetMetadata: vi.fn(async () => {
      throw new Error("updateAssetMetadata should not be called");
    }),
  };
}

function createAsset(kind: Extract<Asset["kind"], "text" | "markdown" | "html">): Asset {
  return {
    id: `asset-${kind}`,
    kind,
    localPath: `assets/originals/asset-${kind}`,
    mimeType: kind === "html" ? "text/html" : "text/plain",
    fileName: `asset-${kind}`,
    size: 1,
    hash: "hash",
    metadata: {
      title: "Original title",
    },
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
