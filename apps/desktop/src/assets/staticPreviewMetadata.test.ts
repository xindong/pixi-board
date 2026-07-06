import { describe, expect, it } from "vitest";
import { AUDIO_WAVEFORM_HEIGHT, AUDIO_WAVEFORM_WIDTH } from "../audioWaveform";
import { staticPreviewMetadataFor } from "./staticPreviewMetadata";

describe("staticPreviewMetadataFor", () => {
  it("uses 1920x1080 for model previews and preserves the model extension", () => {
    expect(staticPreviewMetadataFor({ kind: "model", fileName: "ship.obj" })).toEqual({
      width: 1920,
      height: 1080,
      format: "obj",
    });
  });

  it("uses the waveform dimensions for audio previews", () => {
    expect(staticPreviewMetadataFor({ kind: "audio", fileName: "loop.mp3" })).toEqual({
      width: AUDIO_WAVEFORM_WIDTH,
      height: AUDIO_WAVEFORM_HEIGHT,
    });
  });
});
