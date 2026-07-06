import type { Asset, AssetMetadataUpdate, FileAssetKind } from "@pixi-board/board-domain";
import type { AssetPreparationContext } from "./assetPreparationTypes";
import {
  createVideoFrameDerivative,
  drawPreviewCanvas,
  encodeCanvasDerivative,
  loadImageElement,
  type CanvasDerivativeExtension,
} from "./mediaPreview";
import { staticPreviewMetadataFor } from "./staticPreviewMetadata";
import { createAudioWaveformCanvas } from "../audioWaveform";
import { assetLabel } from "./assetLabels";
import { generateModelPreview } from "./modelPreviewGenerator";

const PREVIEW_GENERATOR_KINDS = ["image", "video", "audio", "model"] as const;

export type PreviewResult = {
  extension: CanvasDerivativeExtension;
  bytes: number[];
  metadata: AssetMetadataUpdate;
};

export type PreviewGenerator = (
  asset: Asset,
  sourceUrl: string,
  context?: AssetPreparationContext,
) => Promise<PreviewResult>;

export const previewGenerators: Record<FileAssetKind, PreviewGenerator> = {
  image: generateImagePreview,
  video: generateVideoPreview,
  audio: generateAudioPreview,
  model: generateModelPreview,
};

export function isPreviewGeneratorKind(kind: string): kind is FileAssetKind {
  return PREVIEW_GENERATOR_KINDS.includes(kind as FileAssetKind);
}

async function generateImagePreview(
  _asset: Asset,
  sourceUrl: string,
  context?: AssetPreparationContext,
): Promise<PreviewResult> {
  const image = await loadImageElement(sourceUrl);
  const canvas = drawPreviewCanvas(
    image,
    image.naturalWidth,
    image.naturalHeight,
    { maxEdge: previewMaxEdge(context) },
  );
  const derivative = await encodeCanvasDerivative(canvas);
  return {
    ...derivative,
    metadata: {
      width: image.naturalWidth,
      height: image.naturalHeight,
    },
  };
}

async function generateVideoPreview(
  _asset: Asset,
  sourceUrl: string,
  context?: AssetPreparationContext,
): Promise<PreviewResult> {
  return createVideoFrameDerivative(sourceUrl, { maxEdge: previewMaxEdge(context) });
}

async function generateAudioPreview(asset: Asset): Promise<PreviewResult> {
  const canvas = createAudioWaveformCanvas({ label: assetLabel(asset) });
  const derivative = await encodeCanvasDerivative(canvas);
  return {
    ...derivative,
    metadata: staticPreviewMetadataFor({
      kind: "audio",
      fileName: assetLabel(asset),
    }),
  };
}

function previewMaxEdge(context: AssetPreparationContext | undefined): number | undefined {
  const width = positiveNumber(context?.size?.width);
  const height = positiveNumber(context?.size?.height);
  const edge = Math.max(width ?? 0, height ?? 0);
  if (!edge) return undefined;
  return Math.max(240, Math.min(1280, Math.ceil(edge * devicePixelRatioForPreview())));
}

function devicePixelRatioForPreview(): number {
  return Math.min(globalThis.devicePixelRatio || 1, 2);
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
