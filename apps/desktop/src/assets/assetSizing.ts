import type { Asset } from "@pixi-board/board-domain";
import { fitSize } from "../utils";

const UNKNOWN_MEDIA_SIZE = 1024;
const DEFAULT_TEXT_LIKE_WIDTH = 1920;
const DEFAULT_TEXT_LIKE_HEIGHT = 1080;
const DEFAULT_AUDIO_WIDTH = 2160;
const DEFAULT_AUDIO_HEIGHT = 1080;

export type AssetNodeSize = {
  width: number;
  height: number;
};

export function suggestAssetNodeSize(
  asset: Pick<Asset, "kind" | "width" | "height">,
): AssetNodeSize {
  if (asset.kind === "importing" || asset.kind === "generating") {
    return {
      width: UNKNOWN_MEDIA_SIZE,
      height: UNKNOWN_MEDIA_SIZE,
    };
  }

  const width = toPositiveDimension(asset.width);
  const height = toPositiveDimension(asset.height);

  if (
    (asset.kind === "image" || asset.kind === "video" || asset.kind === "model") &&
    width !== undefined &&
    height !== undefined
  ) {
    return {
      width,
      height,
    };
  }

  if (asset.kind === "image" || asset.kind === "video" || asset.kind === "model") {
    return {
      width: UNKNOWN_MEDIA_SIZE,
      height: UNKNOWN_MEDIA_SIZE,
    };
  }

  if (asset.kind === "text" || asset.kind === "markdown" || asset.kind === "html") {
    return fitSize(asset.width, asset.height, DEFAULT_TEXT_LIKE_WIDTH, DEFAULT_TEXT_LIKE_HEIGHT);
  }

  if (asset.kind === "audio") {
    return fitSize(asset.width, asset.height, DEFAULT_AUDIO_WIDTH, DEFAULT_AUDIO_HEIGHT);
  }

  return fitSize(asset.width, asset.height);
}

function toPositiveDimension(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}
