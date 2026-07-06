import { decodeAudioPeaks, encodeAudioPeaksDerivative } from "../audioWaveform";
import type { Asset } from "@pixi-board/board-domain";
import type {
  AssetPreparationContext,
  AssetPreparationRepository,
  AssetPreparationStage,
} from "./assetPreparationTypes";
import { hasAssetDerivative } from "@pixi-board/board-domain";

export class AudioWaveformPreparationStage implements AssetPreparationStage {
  private readonly repository: AssetPreparationRepository;

  constructor(repository: AssetPreparationRepository) {
    this.repository = repository;
  }

  supports(asset: Asset): boolean {
    return asset.kind === "audio";
  }

  async prepare(asset: Asset, context?: AssetPreparationContext): Promise<Asset> {
    if (context?.refreshPreviewOnly) return asset;
    if (!context?.force && hasAssetDerivative(asset, "waveform")) return asset;

    try {
      const sourceUrl = await this.repository.resolveAssetUrl(asset.id, "original");
      const peaks = await decodeAudioPeaks(sourceUrl);
      return this.repository.saveDerivatives({
        assetId: asset.id,
        derivatives: [
          {
            variant: "waveform",
            extension: "json",
            bytes: encodeAudioPeaksDerivative(peaks),
          },
        ],
      });
    } catch (error) {
      console.warn("Audio waveform preparation failed", error);
      return asset;
    }
  }
}
