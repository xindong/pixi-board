import type { Asset } from "@pixi-board/board-domain";
import type { BoardRepository } from "../storage/boardRepository";
import type { AssetPipeline } from "./assetPipeline";

export type AssetImportEvent = {
  index: number;
  path: string;
  asset: Asset;
};

export type AssetImportFailureEvent = {
  index: number;
  path: string;
  error: string;
};

export type AssetImportCompletionEvent = {
  importedCount: number;
  failedCount: number;
};

export type AssetImportCallbacks = {
  onImported?: (event: AssetImportEvent) => void;
  onPrepared?: (event: AssetImportEvent) => void;
  onFailed?: (event: AssetImportFailureEvent) => void;
  onComplete?: (event: AssetImportCompletionEvent) => void;
};

type AssetImportManagerOptions = {
  assetPipeline: AssetPipeline;
  repository: BoardRepository;
};

export class AssetImportManager {
  private readonly assetPipeline: AssetPipeline;
  private readonly repository: BoardRepository;

  constructor(options: AssetImportManagerOptions) {
    this.assetPipeline = options.assetPipeline;
    this.repository = options.repository;
  }

  async importPaths(
    paths: string[],
    callbacks: AssetImportCallbacks = {},
    signal?: AbortSignal,
  ): Promise<AssetImportCompletionEvent> {
    if (paths.length === 0 || signal?.aborted) {
      const completion = { importedCount: 0, failedCount: 0 };
      callbacks.onComplete?.(completion);
      return completion;
    }

    if (this.repository.startAssetImportBatch) {
      return this.importPathsStreaming(paths, callbacks, signal);
    }

    return this.importPathsBatch(paths, callbacks, signal);
  }

  private async importPathsStreaming(
    paths: string[],
    callbacks: AssetImportCallbacks,
    signal?: AbortSignal,
  ): Promise<AssetImportCompletionEvent> {
    const startAssetImportBatch = this.repository.startAssetImportBatch?.bind(this.repository);
    if (!startAssetImportBatch) {
      return this.importPathsBatch(paths, callbacks, signal);
    }

    const preparationTasks: Promise<void>[] = [];

    const completion = await startAssetImportBatch(
      paths,
      {
        onImported: (event) => {
          if (signal?.aborted) return;
          callbacks.onImported?.(event);
          const preparationTask = this.assetPipeline
            .prepareAssets([event.asset])
            .then(([asset]) => {
              if (signal?.aborted) return;
              callbacks.onPrepared?.({
                index: event.index,
                path: event.path,
                asset,
              });
            })
            .catch((error) => {
              console.error(error);
            });
          preparationTasks.push(preparationTask);
        },
        onFailed: (event) => {
          if (signal?.aborted) return;
          callbacks.onFailed?.(event);
        },
      },
      signal,
    );

    const result = {
      importedCount: completion.importedCount,
      failedCount: completion.failedCount,
    };
    if (signal?.aborted) {
      return result;
    }

    await Promise.allSettled(preparationTasks);

    if (!signal?.aborted) {
      callbacks.onComplete?.(result);
    }
    return result;
  }

  private async importPathsBatch(
    paths: string[],
    callbacks: AssetImportCallbacks,
    signal?: AbortSignal,
  ): Promise<AssetImportCompletionEvent> {
    const outcomes = await this.repository.importAssetBatch(paths);
    const importedEvents: AssetImportEvent[] = [];
    let failedCount = 0;

    for (const outcome of outcomes) {
      if (signal?.aborted) return { importedCount: importedEvents.length, failedCount };

      if (outcome.ok) {
        const event = {
          index: outcome.index,
          path: outcome.path,
          asset: outcome.asset,
        };
        importedEvents.push(event);
        callbacks.onImported?.(event);
      } else {
        failedCount++;
        callbacks.onFailed?.({
          index: outcome.index,
          path: outcome.path,
          error: outcome.error,
        });
      }
    }

    const preparedAssets = await this.assetPipeline.prepareAssets(
      importedEvents.map((event) => event.asset),
    );

    for (const [preparedIndex, asset] of preparedAssets.entries()) {
      if (signal?.aborted) return { importedCount: importedEvents.length, failedCount };

      const imported = importedEvents[preparedIndex];
      callbacks.onPrepared?.({
        index: imported.index,
        path: imported.path,
        asset,
      });
    }

    const completion = {
      importedCount: importedEvents.length,
      failedCount,
    };
    if (!signal?.aborted) {
      callbacks.onComplete?.(completion);
    }
    return completion;
  }

  async importAndPrepareAssets(paths: string[]): Promise<Asset[]> {
    const outcomes = await this.repository.importAssetBatch(paths);
    const failures = outcomes.filter((outcome) => !outcome.ok);
    if (failures.length > 0) {
      throw new Error(failures.map((failure) => failure.error).join("; "));
    }

    return this.assetPipeline.prepareAssets(
      outcomes
        .filter((outcome) => outcome.ok)
        .map((outcome) => outcome.asset),
    );
  }
}
