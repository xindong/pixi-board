import { Assets, Texture } from "../pixi";
import type { Asset, AssetVariant } from "@pixi-board/board-domain";
import { hasAssetDerivative } from "@pixi-board/board-domain";
import { assetLabel } from "../assets/assetLabels";
import { loadAudioWaveformTexture } from "./audioWaveformTextureLoader";
import {
  assetTextureCacheKey,
  cacheBustedAssetUrl,
  isPreviewBackedAssetKind,
  isTextureBackedNodeType,
  textureVariantForAsset,
} from "./textureAssetRules";
import { createPlaceholderTexture } from "./texturePlaceholder";

export type LoadedTexture = {
  texture: Texture;
  url?: string;
  managedByAssets: boolean;
};

export type TextureLoadDescriptor = {
  key: string;
  load: () => Promise<LoadedTexture>;
};

type BoardTextureLoaderOptions = {
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>;
};

export class BoardTextureLoader {
  private readonly resolveAssetUrl: BoardTextureLoaderOptions["resolveAssetUrl"];

  constructor(options: BoardTextureLoaderOptions) {
    this.resolveAssetUrl = options.resolveAssetUrl;
  }

  descriptorForAsset(asset: Asset, nodeType: string = asset.kind): TextureLoadDescriptor {
    if (asset.kind === "audio") {
      return this.audioDescriptor(asset);
    }

    if (!isTextureBackedNodeType(nodeType)) {
      return this.placeholderDescriptor(nodeType, assetLabel(asset));
    }

    const variant = textureVariantForAsset(asset);
    if (!variant && isPreviewBackedAssetKind(asset.kind)) {
      throw new Error("Asset preview is not available");
    }
    if (!variant) {
      return this.placeholderDescriptor(asset.kind, assetLabel(asset));
    }

    const key = assetTextureCacheKey(asset, variant);
    return {
      key,
      load: () => this.loadAssetTexture(asset, variant),
    };
  }

  placeholderDescriptor(kind: string, label: string): TextureLoadDescriptor {
    return {
      key: `placeholder:${kind}:${label}`,
      load: async () => ({
        texture: createPlaceholderTexture(kind, label),
        managedByAssets: false,
      }),
    };
  }

  private audioDescriptor(asset: Asset): TextureLoadDescriptor {
    if (!hasAssetDerivative(asset, "waveform")) {
      return this.placeholderDescriptor("audio:waveform", assetLabel(asset));
    }

    return {
      key: assetTextureCacheKey(asset, "waveform"),
      load: async () => ({
        texture: await loadAudioWaveformTexture(asset, this.resolveAssetUrl),
        managedByAssets: false,
      }),
    };
  }

  private async loadAssetTexture(
    asset: Asset,
    variant: AssetVariant,
  ): Promise<LoadedTexture> {
    const resolvedUrl = await this.resolveAssetUrl(asset.id, variant);
    const url = cacheBustedAssetUrl(asset, variant, resolvedUrl);
    return {
      texture: await Assets.load<Texture>(url),
      url,
      managedByAssets: true,
    };
  }
}
