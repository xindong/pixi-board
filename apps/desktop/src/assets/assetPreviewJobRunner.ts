import type { Asset } from "@pixi-board/board-domain";
import {
  type AssetPreparationContext,
  type AssetPreparationStage,
} from "./assetPreparationTypes";
import {
  type AssetPreparationScheduler,
  yieldToLowPriorityWork,
} from "./assetPreparationQueue";

const DEFAULT_MAX_RUNNING_JOBS = 1;

export type AssetPreviewJobRunnerOptions = {
  maxRunningJobs?: number;
  scheduler?: AssetPreparationScheduler;
};

type AssetPreviewJob = {
  asset: Asset;
  context?: AssetPreparationContext;
  key: string;
  reject: (error: unknown) => void;
  resolve: (asset: Asset) => void;
  stages: readonly AssetPreparationStage[];
};

export class AssetPreviewJobRunner {
  private readonly maxRunningJobs: number;
  private readonly scheduler: AssetPreparationScheduler;
  private readonly backgroundQueue: AssetPreviewJob[] = [];
  private readonly queuedJobs = new Map<string, Promise<Asset>>();
  private readonly userQueue: AssetPreviewJob[] = [];
  private runningJobCount = 0;

  constructor(options: AssetPreviewJobRunnerOptions = {}) {
    this.maxRunningJobs = options.maxRunningJobs ?? DEFAULT_MAX_RUNNING_JOBS;
    this.scheduler = options.scheduler ?? yieldToLowPriorityWork;
  }

  prepareAsset(
    asset: Asset,
    stages: readonly AssetPreparationStage[],
    context?: AssetPreparationContext,
  ): Promise<Asset> {
    const key = previewJobKey(asset, context);
    const existing = this.queuedJobs.get(key);
    if (existing) return existing;

    let job: AssetPreviewJob;
    const promise = new Promise<Asset>((resolve, reject) => {
      job = {
        asset,
        context,
        key,
        reject,
        resolve,
        stages,
      };
    });
    this.queuedJobs.set(key, promise);
    promise.finally(() => {
      if (this.queuedJobs.get(key) === promise) {
        this.queuedJobs.delete(key);
      }
    });

    const queue = context?.priority === "user" ? this.userQueue : this.backgroundQueue;
    queue.push(job!);
    this.drain();
    return promise;
  }

  private drain(): void {
    while (this.runningJobCount < this.maxRunningJobs) {
      const job = this.userQueue.shift() ?? this.backgroundQueue.shift();
      if (!job) return;

      this.runningJobCount++;
      void this.run(job)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.runningJobCount = Math.max(0, this.runningJobCount - 1);
          this.drain();
        });
    }
  }

  private async run(job: AssetPreviewJob): Promise<Asset> {
    let prepared = job.asset;

    for (const stage of job.stages) {
      if (stage.supports(prepared, job.context)) {
        await this.scheduler();
        prepared = await stage.prepare(prepared, job.context);
      }
    }

    return prepared;
  }
}

function previewJobKey(asset: Asset, context?: AssetPreparationContext): string {
  return [
    asset.id,
    context?.force ? "force" : "prepare",
    context?.priority ?? "background",
    Math.round(context?.size?.width ?? 0),
    Math.round(context?.size?.height ?? 0),
  ].join(":");
}
