import type { Asset } from "@pixi-board/board-domain";

export type AssetPreparationScheduler = () => Promise<void>;

export class AssetPreparationQueue {
  private readonly inflight = new Map<string, Promise<Asset>>();
  private readonly concurrency: number;
  private readonly scheduler: AssetPreparationScheduler;
  private readonly worker: (asset: Asset) => Promise<Asset>;

  constructor(
    concurrency: number,
    worker: (asset: Asset) => Promise<Asset>,
    scheduler: AssetPreparationScheduler = yieldToLowPriorityWork,
  ) {
    this.concurrency = concurrency;
    this.scheduler = scheduler;
    this.worker = worker;
  }

  async prepareAll(assets: Asset[]): Promise<Asset[]> {
    return mapWithConcurrency(assets, this.concurrency, (asset) =>
      this.prepareOnce(asset),
    );
  }

  private prepareOnce(asset: Asset): Promise<Asset> {
    const existing = this.inflight.get(asset.id);
    if (existing) {
      return existing;
    }

    const promise = this.scheduler().then(() => this.worker(asset)).finally(() => {
      this.inflight.delete(asset.id);
    });
    this.inflight.set(asset.id, promise);
    return promise;
  }
}

export function yieldToLowPriorityWork(): Promise<void> {
  return new Promise((resolve) => {
    const requestIdleCallback = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 50 });
      return;
    }

    globalThis.setTimeout(resolve, 0);
  });
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (values.length === 0) return [];

  const results = new Array<R>(values.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => runWorker()),
  );

  return results;
}
