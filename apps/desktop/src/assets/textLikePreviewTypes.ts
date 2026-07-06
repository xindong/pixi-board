import type { AssetKind, AssetMetadataUpdate } from "@pixi-board/board-domain";
import type { CanvasDerivativeExtension } from "./mediaPreview";

export type TextLikeAssetKind = Extract<AssetKind, "text" | "markdown" | "html">;

export type TextLikePreviewSize = {
  width: number;
  height: number;
};

export type TextLikePreviewResult = {
  extension: CanvasDerivativeExtension;
  bytes: number[];
  metadata: AssetMetadataUpdate;
};

export type RenderPreviewOptions = {
  expandHeightToContent?: boolean;
};
