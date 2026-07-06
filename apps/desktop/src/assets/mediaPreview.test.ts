import { describe, expect, it, vi } from "vitest";
import { constrainPreviewSize, encodeCanvasDerivative } from "./mediaPreview";

describe("mediaPreview", () => {
  it("encodes a canvas derivative once when WebP is supported", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
    const toBlob = vi.fn((callback: BlobCallback) => callback(blob));
    const canvas = { toBlob } as unknown as HTMLCanvasElement;

    const result = await encodeCanvasDerivative(canvas);

    expect(result).toEqual({
      extension: "webp",
      bytes: [1, 2, 3],
    });
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.86);
  });

  it("uses a caller-provided max edge for preview dimensions", () => {
    expect(constrainPreviewSize(4000, 2000, 500)).toEqual({
      width: 500,
      height: 250,
    });
  });
});
