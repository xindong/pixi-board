import type { Asset } from "@pixi-board/board-domain";
import { hasAssetDerivative } from "@pixi-board/board-domain";
import type {
  AssetPreparationContext,
  AssetPreparationRepository,
  AssetPreparationStage,
} from "./assetPreparationTypes";
import {
  isTextLikeAssetKind,
  renderTextLikeErrorPreview,
  renderTextLikePreview,
  type TextLikePreviewResult,
  type TextLikePreviewSize,
} from "./textLikePreviewRenderer";

export type TextLikePreviewPreparationOptions = {
  force?: boolean;
  size?: Partial<TextLikePreviewSize>;
};

export class TextLikePreviewPreparationStage implements AssetPreparationStage {
  private readonly repository: AssetPreparationRepository;
  private readonly options: TextLikePreviewPreparationOptions;

  constructor(
    repository: AssetPreparationRepository,
    options: TextLikePreviewPreparationOptions = {},
  ) {
    this.repository = repository;
    this.options = options;
  }

  supports(asset: Asset): boolean {
    return isTextLikeAssetKind(asset.kind);
  }

  async prepare(asset: Asset, context?: AssetPreparationContext): Promise<Asset> {
    if (!isTextLikeAssetKind(asset.kind)) return asset;
    const force = context?.force ?? this.options.force ?? false;
    const size = normalizeSize({
      ...(this.options.size ?? {}),
      ...(context?.size ?? {}),
    });
    if (!force && hasAssetDerivative(asset, "preview")) return asset;

    try {
      const sourceText = await this.readSourceText(asset);
      const preview = await renderTextLikePreview(asset, sourceText, size);
      return this.savePreview(asset, preview);
    } catch (error) {
      console.warn("Text-like preview generation failed", error);
      const preview = await renderTextLikeErrorPreview(
        asset,
        "预览生成失败",
        size,
      );
      return this.savePreview(asset, preview);
    }
  }

  private async readSourceText(asset: Asset): Promise<string> {
    const url = await this.repository.resolveAssetUrl(asset.id, "original");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to read source file: HTTP ${response.status}`);
    }
    return response.text();
  }

  private savePreview(
    asset: Asset,
    preview: TextLikePreviewResult,
  ): Promise<Asset> {
    return this.repository.saveDerivatives({
      assetId: asset.id,
      derivatives: [
        {
          variant: "preview",
          extension: preview.extension,
          bytes: preview.bytes,
        },
      ],
      metadata: {
        ...preview.metadata,
        metadata: {
          ...(asset.metadata ?? {}),
          ...(preview.metadata.metadata ?? {}),
        },
      },
    });
  }
}

function normalizeSize(
  size: Partial<TextLikePreviewSize>,
): Partial<TextLikePreviewSize> | undefined {
  return size.width === undefined && size.height === undefined ? undefined : size;
}
