import { Texture } from "../pixi";
import { createAudioWaveformCanvas, loadAudioPeaksDerivative } from "../audioWaveform";
import type { Asset, AssetVariant } from "@pixi-board/board-domain";
import { assetLabel } from "../assets/assetLabels";
import { createPlaceholderTexture } from "./texturePlaceholder";

export async function loadAudioWaveformTexture(
  asset: Asset,
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>,
): Promise<Texture> {
  try {
    const url = await resolveAssetUrl(asset.id, "waveform");
    const peaks = await loadAudioPeaksDerivative(url);
    return Texture.from(createAudioWaveformCanvas({ label: assetLabel(asset), peaks }));
  } catch (error) {
    console.warn("Audio waveform texture load failed", error);
    return createPlaceholderTexture("audio:waveform", assetLabel(asset));
  }
}
