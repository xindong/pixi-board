import type { Asset } from "@pixi-board/board-domain";
import {
  AssetPreparationQueue,
  type AssetPreparationScheduler,
  yieldToLowPriorityWork,
} from "./assetPreparationQueue";
import type { AssetPreparationRepository, AssetPreparationStage } from "./assetPreparationTypes";
import { AssetPreviewPipeline } from "./assetPreviewPipeline";
import { AssetPreviewJobRunner } from "./assetPreviewJobRunner";

const PREPARATION_CONCURRENCY = 2;

type AssetPipelineOptions = {
  concurrency?: number;
  previewRunner?: AssetPreviewJobRunner;
  scheduler?: AssetPreparationScheduler;
  stages?: AssetPreparationStage[];
};

export class AssetPipeline {
  private readonly previews: AssetPreviewPipeline;
  private readonly queue: AssetPreparationQueue;
  private readonly scheduler: AssetPreparationScheduler;

  constructor(
    repository: AssetPreparationRepository,
    options?: AssetPipelineOptions,
  ) {
    this.scheduler = options?.scheduler ?? yieldToLowPriorityWork;
    this.previews = new AssetPreviewPipeline(repository, {
      runner: options?.previewRunner,
      scheduler: this.scheduler,
      stages: options?.stages,
    });
    this.queue = new AssetPreparationQueue(
      options?.concurrency ?? PREPARATION_CONCURRENCY,
      (asset) => this.prepareAsset(asset),
      this.scheduler,
    );
  }

  async prepareAssets(assets: Asset[]): Promise<Asset[]> {
    return this.queue.prepareAll(assets);
  }

  private async prepareAsset(asset: Asset): Promise<Asset> {
    return this.previews.prepareAsset(asset, { priority: "background" });
  }
}
