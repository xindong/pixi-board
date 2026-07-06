import type { Asset } from "@pixi-board/board-domain";
import type {
  AssetPreparationContext,
  AssetPreparationRepository,
  AssetPreparationStage,
} from "./assetPreparationTypes";
import { hasAssetDerivative } from "@pixi-board/board-domain";
import { isPreviewGeneratorKind, previewGenerators } from "./previewGenerators";

type PreviewPreparationOptions = {
  force?: boolean;
};

export class PreviewPreparationStage implements AssetPreparationStage {
  private readonly repository: AssetPreparationRepository;
  private readonly options: PreviewPreparationOptions;

  constructor(
    repository: AssetPreparationRepository,
    options: PreviewPreparationOptions = {},
  ) {
    this.repository = repository;
    this.options = options;
  }

  supports(asset: Asset): boolean {
    return isPreviewGeneratorKind(asset.kind);
  }

  async prepare(asset: Asset, context?: AssetPreparationContext): Promise<Asset> {
    const force = context?.force ?? this.options.force ?? false;
    const needsPreview = force || !hasAssetDerivative(asset, "preview");
    const needsMetadata = needsPreview || !hasCoreMetadata(asset);
    if (!needsPreview && !needsMetadata) return asset;

    try {
      const sourceUrl = await this.repository.resolveAssetUrl(asset.id, "original");
      if (!isPreviewGeneratorKind(asset.kind)) return asset;
      const preview = await previewGenerators[asset.kind](asset, sourceUrl, context);

      if (!needsPreview) {
        return this.repository.updateAssetMetadata(asset.id, preview.metadata);
      }

      return this.repository.saveDerivatives({
        assetId: asset.id,
        derivatives: [
          {
            variant: "preview",
            extension: preview.extension,
            bytes: preview.bytes,
          },
        ],
        metadata: preview.metadata,
      });
    } catch (error) {
      console.warn("Preview generation failed", error);
      return asset;
    }
  }
}

function hasCoreMetadata(asset: Asset): boolean {
  if (asset.kind === "video") {
    return Boolean(asset.width && asset.height && asset.duration);
  }
  if (asset.kind === "image" || asset.kind === "audio" || asset.kind === "model") {
    return Boolean(asset.width && asset.height);
  }
  return true;
}
