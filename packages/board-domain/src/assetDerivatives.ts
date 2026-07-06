import type {
  Asset,
  AssetDerivative,
  AssetDerivativeVariant,
  AssetVariant,
} from "./types";

export function getAssetDerivative(
  asset: Pick<Asset, "derivatives">,
  variant: AssetDerivativeVariant,
): AssetDerivative | undefined {
  return asset.derivatives?.[variant];
}

export function getAssetDerivativePath(
  asset: Pick<Asset, "derivatives">,
  variant: AssetDerivativeVariant,
): string | undefined {
  return getAssetDerivative(asset, variant)?.localPath;
}

export function hasAssetDerivative(
  asset: Pick<Asset, "derivatives">,
  variant: AssetDerivativeVariant,
): boolean {
  return Boolean(getAssetDerivative(asset, variant));
}

export function getRenderableAssetVariant(asset: Asset): AssetVariant | null {
  if (asset.kind === "audio") {
    return null;
  }

  if (isPreviewBackedAssetKind(asset.kind)) {
    if (hasAssetDerivative(asset, "preview")) return "preview";
    return null;
  }

  return null;
}

function isPreviewBackedAssetKind(kind: Asset["kind"]): boolean {
  return (
    kind === "image" ||
    kind === "video" ||
    kind === "model" ||
    kind === "text" ||
    kind === "markdown" ||
    kind === "html"
  );
}

export function getAssetVisualKey(asset: Asset | undefined): string {
  if (!asset) {
    return "missing";
  }

  return [
    asset.id,
    getAssetDerivativePath(asset, "preview") ?? "no-preview",
    getAssetDerivativePath(asset, "waveform") ?? "no-waveform",
    asset.localPath ?? "no-original",
    asset.updatedAt,
  ].join(":");
}
