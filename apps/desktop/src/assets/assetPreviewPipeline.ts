import type { Asset } from "@pixi-board/board-domain";
import { AssetPreviewJobRunner } from "./assetPreviewJobRunner";
import {
  type AssetPreparationContext,
  type AssetPreparationRepository,
  type AssetPreparationStage,
} from "./assetPreparationTypes";
import type { AssetPreparationScheduler } from "./assetPreparationQueue";
import { AudioWaveformPreparationStage } from "./audioWaveformPreparationStage";
import { PreviewPreparationStage } from "./previewPreparationStage";
import { isPreviewGeneratorKind } from "./previewGenerators";
import { TextLikePreviewPreparationStage } from "./textLikePreviewPreparationStage";
import { isTextLikeAssetKind } from "./textLikePreviewRenderer";

export type AssetPreviewPipelineOptions = {
  runner?: AssetPreviewJobRunner;
  scheduler?: AssetPreparationScheduler;
  stages?: AssetPreparationStage[];
};

export class AssetPreviewPipeline {
  private readonly runner: AssetPreviewJobRunner;
  private readonly stages: AssetPreparationStage[];

  constructor(
    repository: AssetPreparationRepository,
    options?: AssetPreviewPipelineOptions,
  ) {
    this.runner = options?.runner ?? new AssetPreviewJobRunner({ scheduler: options?.scheduler });
    this.stages = options?.stages ?? createDefaultAssetPreviewStages(repository);
  }

  canPrepare(asset: Asset, context?: AssetPreparationContext): boolean {
    return this.stages.some((stage) => stage.supports(asset, context));
  }

  async prepareAsset(
    asset: Asset,
    context?: AssetPreparationContext,
  ): Promise<Asset> {
    return this.runner.prepareAsset(asset, this.stages, context);
  }
}

export function createDefaultAssetPreviewStages(
  repository: AssetPreparationRepository,
): AssetPreparationStage[] {
  return [
    new TextLikePreviewPreparationStage(repository),
    new PreviewPreparationStage(repository),
    new AudioWaveformPreparationStage(repository),
  ];
}

export function canPrepareAssetPreview(asset: Asset): boolean {
  return isTextLikeAssetKind(asset.kind) || isPreviewGeneratorKind(asset.kind);
}
