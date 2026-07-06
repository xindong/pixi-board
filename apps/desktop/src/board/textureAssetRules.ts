import type { Asset, AssetVariant } from "@pixi-board/board-domain";
import { getRenderableAssetVariant } from "@pixi-board/board-domain";

export function textureVariantForAsset(asset: Asset): AssetVariant | null {
  return getRenderableAssetVariant(asset);
}

export function assetTextureCacheKey(asset: Asset, variant: AssetVariant): string {
  const derivative =
    variant === "original" ? undefined : asset.derivatives?.[variant];
  return [
    asset.id,
    variant,
    derivative?.localPath ?? asset.localPath,
    derivative?.updatedAt ?? asset.updatedAt,
  ].join(":");
}

export function cacheBustedAssetUrl(asset: Asset, variant: AssetVariant, url: string): string {
  if (variant === "original") return url;
  const version = asset.derivatives?.[variant]?.updatedAt ?? asset.updatedAt;
  if (!version) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(version))}`;
}

export function isTextureBackedNodeType(nodeType: string): boolean {
  return (
    nodeType === "image" ||
    nodeType === "video" ||
    nodeType === "model" ||
    nodeType === "text" ||
    nodeType === "markdown" ||
    nodeType === "html"
  );
}

export function isPreviewBackedAssetKind(kind: string): boolean {
  return (
    kind === "image" ||
    kind === "video" ||
    kind === "model" ||
    kind === "text" ||
    kind === "markdown" ||
    kind === "html"
  );
}
