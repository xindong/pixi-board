import { describe, expect, it } from "vitest";
import { suggestAssetNodeSize } from "./assetSizing";

describe("suggestAssetNodeSize", () => {
  it("uses a square loading size for importing assets", () => {
    expect(suggestAssetNodeSize({ kind: "importing" })).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it("uses a square loading size for generating assets", () => {
    expect(suggestAssetNodeSize({ kind: "generating" })).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it("uses the square loading size for preview-backed assets before dimensions are known", () => {
    expect(suggestAssetNodeSize({ kind: "video" })).toEqual({
      width: 1024,
      height: 1024,
    });
  });

  it("uses the wide default size for text-like assets before dimensions are known", () => {
    expect(suggestAssetNodeSize({ kind: "markdown" })).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("uses the wide waveform default size for audio before dimensions are known", () => {
    expect(suggestAssetNodeSize({ kind: "audio" })).toEqual({
      width: 2160,
      height: 1080,
    });
  });
});
