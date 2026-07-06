import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import type { AssetPreparationRepository } from "./assetPreparationTypes";

const audioWaveform = vi.hoisted(() => ({
  decodeAudioPeaks: vi.fn(),
  encodeAudioPeaksDerivative: vi.fn(),
}));

vi.mock("../audioWaveform", () => audioWaveform);

import { AudioWaveformPreparationStage } from "./audioWaveformPreparationStage";

describe("AudioWaveformPreparationStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioWaveform.decodeAudioPeaks.mockResolvedValue([0, 0.5, 1]);
    audioWaveform.encodeAudioPeaksDerivative.mockReturnValue([123, 34, 112, 101, 97, 107, 115]);
  });

  it("saves waveform JSON bytes for audio assets without a waveform derivative", async () => {
    const asset = createAudioAsset();
    const repository: AssetPreparationRepository = {
      resolveAssetUrl: vi.fn(async () => "asset://sound.mp3"),
      saveDerivative: vi.fn(async () => {
        throw new Error("saveDerivative should not be called");
      }),
      saveDerivatives: vi.fn(async () => ({
        ...asset,
        derivatives: {
          waveform: {
            localPath: "assets/waveforms/asset-audio-waveform.json",
            extension: "json",
            createdAt: 1,
            updatedAt: 2,
          },
        },
      })),
      updateAssetMetadata: vi.fn(async () => {
        throw new Error("updateAssetMetadata should not be called");
      }),
    };

    const result = await new AudioWaveformPreparationStage(repository).prepare(asset);

    expect(repository.resolveAssetUrl).toHaveBeenCalledWith("asset-audio", "original");
    expect(audioWaveform.decodeAudioPeaks).toHaveBeenCalledWith("asset://sound.mp3");
    expect(repository.saveDerivatives).toHaveBeenCalledWith({
      assetId: "asset-audio",
      derivatives: [
        {
          variant: "waveform",
          extension: "json",
          bytes: [123, 34, 112, 101, 97, 107, 115],
        },
      ],
    });
    expect(result.derivatives?.waveform).toBeDefined();
  });

  it("skips audio assets that already have a waveform derivative", async () => {
    const asset = {
      ...createAudioAsset(),
      derivatives: {
        waveform: {
          localPath: "assets/waveforms/existing.json",
          extension: "json",
          createdAt: 1,
          updatedAt: 1,
        },
      },
    };
    const repository = createUnusedRepository();

    const result = await new AudioWaveformPreparationStage(repository).prepare(asset);

    expect(result).toBe(asset);
    expect(repository.resolveAssetUrl).not.toHaveBeenCalled();
    expect(repository.saveDerivatives).not.toHaveBeenCalled();
  });

  it("does not regenerate waveform for preview-only refresh", async () => {
    const asset = createAudioAsset();
    const repository = createUnusedRepository();

    const result = await new AudioWaveformPreparationStage(repository).prepare(asset, {
      force: true,
      refreshPreviewOnly: true,
    });

    expect(result).toBe(asset);
    expect(repository.resolveAssetUrl).not.toHaveBeenCalled();
    expect(repository.saveDerivatives).not.toHaveBeenCalled();
  });
});

function createUnusedRepository(): AssetPreparationRepository {
  return {
    resolveAssetUrl: vi.fn(async () => {
      throw new Error("resolveAssetUrl should not be called");
    }),
    saveDerivative: vi.fn(async () => {
      throw new Error("saveDerivative should not be called");
    }),
    saveDerivatives: vi.fn(async () => {
      throw new Error("saveDerivatives should not be called");
    }),
    updateAssetMetadata: vi.fn(async () => {
      throw new Error("updateAssetMetadata should not be called");
    }),
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
