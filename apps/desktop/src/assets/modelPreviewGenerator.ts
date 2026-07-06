import type { Asset } from "@pixi-board/board-domain";
import { generateModelCardPreview } from "./modelPreviewCard";
import { renderModelPreview } from "./modelPreviewScene";
import type { ModelPreviewResult } from "./modelPreviewTypes";

export type { ModelPreviewResult } from "./modelPreviewTypes";

export async function generateModelPreview(asset: Asset, sourceUrl: string): Promise<ModelPreviewResult> {
  try {
    return await renderModelPreview(asset, sourceUrl);
  } catch (error) {
    console.warn("Model preview generation failed, using placeholder", error);
    return generateModelCardPreview(asset);
  }
}
