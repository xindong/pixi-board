import { describe, expect, it } from "vitest";
import type { Asset } from "./types";
import { getRenderableAssetVariant } from "./assetDerivatives";

describe("asset derivative render variant selection", () => {
  it("does not route images without previews to the original asset", () => {
    expect(getRenderableAssetVariant(createImageAsset())).toBeNull();
  });

  it("does not route videos without thumbnails to the original asset", () => {
    expect(getRenderableAssetVariant(createVideoAsset())).toBeNull();
  });

  it("does not route audio without waveform to the original asset", () => {
    expect(getRenderableAssetVariant(createAudioAsset())).toBeNull();
  });

  it("does not route audio preview to static rendering", () => {
    expect(
      getRenderableAssetVariant({
        ...createAudioAsset(),
        derivatives: {
          preview: createDerivative("assets/previews/audio-preview.webp"),
        },
      }),
    ).toBeNull();
  });

  it("uses canonical preview for videos", () => {
    expect(
      getRenderableAssetVariant({
        ...createVideoAsset(),
        derivatives: {
          preview: createDerivative("assets/previews/clip-preview.webp"),
        },
      }),
    ).toBe("preview");
  });

  it("does not route text-like assets without previews to original source files", () => {
    expect(getRenderableAssetVariant(createTextAsset("html"))).toBeNull();
    expect(getRenderableAssetVariant(createTextAsset("markdown"))).toBeNull();
    expect(getRenderableAssetVariant(createTextAsset("text"))).toBeNull();
  });

  it("uses preview derivatives for text-like assets", () => {
    expect(
      getRenderableAssetVariant({
        ...createTextAsset("html"),
        derivatives: {
          preview: createDerivative("assets/previews/card.webp"),
        },
      }),
    ).toBe("preview");
  });
});

function createImageAsset(): Asset {
  return {
    id: "asset-image",
    kind: "image",
    localPath: "assets/originals/asset-image.png",
    mimeType: "image/png",
    fileName: "asset-image.png",
    size: 1,
    hash: "hash",
    createdAt: 1,
    updatedAt: 1,
  };
}

function createAudioAsset(): Asset {
  return {
    id: "asset-audio",
    kind: "audio",
    localPath: "assets/originals/asset-audio.mp3",
    mimeType: "audio/mpeg",
    fileName: "asset-audio.mp3",
    size: 1,
    hash: "hash",
    createdAt: 1,
    updatedAt: 1,
  };
}

function createVideoAsset(): Asset {
  return {
    id: "asset-1",
    kind: "video",
    localPath: "assets/originals/asset-1.mp4",
    mimeType: "video/mp4",
    fileName: "asset-1.mp4",
    size: 1,
    hash: "hash",
    createdAt: 1,
    updatedAt: 1,
  };
}

function createTextAsset(kind: Extract<Asset["kind"], "text" | "markdown" | "html">): Asset {
  return {
    id: `asset-${kind}`,
    kind,
    localPath: `assets/originals/asset-${kind}.${kind === "markdown" ? "md" : kind}`,
    mimeType: kind === "html" ? "text/html" : "text/plain",
    fileName: `asset-${kind}`,
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
