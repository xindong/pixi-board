import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import type { AssetImportStreamCallbacks, BoardRepository } from "../storage/boardRepository";
import type { AssetPipeline } from "./assetPipeline";
import { AssetImportManager } from "./assetImportManager";

describe("AssetImportManager", () => {
  it("streams imported, prepared, failed, and complete events", async () => {
    const repository = {
      startAssetImportBatch: vi.fn(async (_paths: string[], callbacks: AssetImportStreamCallbacks) => {
        callbacks.onImported?.({
          batchId: "batch-1",
          index: 0,
          path: "/tmp/a.png",
          status: "imported",
          asset: createAsset("asset-a"),
        });
        callbacks.onFailed?.({
          batchId: "batch-1",
          index: 1,
          path: "/tmp/b.txt",
          status: "failed",
          error: "Unsupported media format: txt",
        });
        callbacks.onImported?.({
          batchId: "batch-1",
          index: 2,
          path: "/tmp/c.png",
          status: "imported",
          asset: createAsset("asset-c"),
        });
        return { batchId: "batch-1", importedCount: 2, failedCount: 1 };
      }),
    } as unknown as BoardRepository;
    const assetPipeline = {
      prepareAssets: vi.fn(async (assets: Asset[]) =>
        assets.map((asset) => ({
          ...asset,
          width: 640,
        })),
      ),
    } as unknown as AssetPipeline;
    const manager = new AssetImportManager({ repository, assetPipeline });
    const events: string[] = [];

    const completion = await manager.importPaths(["/tmp/a.png", "/tmp/b.txt", "/tmp/c.png"], {
      onImported: (event) => events.push(`imported:${event.index}:${event.asset.id}`),
      onPrepared: (event) => events.push(`prepared:${event.index}:${event.asset.width}`),
      onFailed: (event) => events.push(`failed:${event.index}:${event.error}`),
      onComplete: (event) => events.push(`complete:${event.importedCount}:${event.failedCount}`),
    });

    expect(repository.startAssetImportBatch).toHaveBeenCalled();
    expect(assetPipeline.prepareAssets).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      "imported:0:asset-a",
      "failed:1:Unsupported media format: txt",
      "imported:2:asset-c",
      "prepared:0:640",
      "prepared:2:640",
      "complete:2:1",
    ]);
    expect(completion).toEqual({ importedCount: 2, failedCount: 1 });
  });

  it("waits for streamed preparation to settle before completing", async () => {
    const prepared = deferred<Asset[]>();
    const repository = {
      startAssetImportBatch: vi.fn(async (_paths: string[], callbacks: AssetImportStreamCallbacks) => {
        callbacks.onImported?.({
          batchId: "batch-1",
          index: 0,
          path: "/tmp/a.png",
          status: "imported",
          asset: createAsset("asset-a"),
        });
        return { batchId: "batch-1", importedCount: 1, failedCount: 0 };
      }),
    } as unknown as BoardRepository;
    const assetPipeline = {
      prepareAssets: vi.fn(() => prepared.promise),
    } as unknown as AssetPipeline;
    const manager = new AssetImportManager({ repository, assetPipeline });
    const events: string[] = [];

    const importPromise = manager.importPaths(["/tmp/a.png"], {
      onPrepared: (event) => events.push(`prepared:${event.asset.id}`),
      onComplete: () => events.push("complete"),
    });
    await Promise.resolve();

    expect(events).toEqual([]);

    prepared.resolve([{ ...createAsset("asset-a"), width: 640 }]);
    await importPromise;

    expect(events).toEqual(["prepared:asset-a", "complete"]);
  });

  it("does not emit streamed callbacks after abort", async () => {
    const controller = new AbortController();
    const repository = {
      startAssetImportBatch: vi.fn(
        async (_paths: string[], callbacks: AssetImportStreamCallbacks, signal?: AbortSignal) => {
          controller.abort();
          callbacks.onImported?.({
            batchId: "batch-1",
            index: 0,
            path: "/tmp/a.png",
            status: "imported",
            asset: createAsset("asset-a"),
          });
          return {
            batchId: "batch-1",
            importedCount: signal?.aborted ? 0 : 1,
            failedCount: 0,
          };
        },
      ),
    } as unknown as BoardRepository;
    const assetPipeline = {
      prepareAssets: vi.fn(async (assets: Asset[]) => assets),
    } as unknown as AssetPipeline;
    const manager = new AssetImportManager({ repository, assetPipeline });
    const events: string[] = [];

    await manager.importPaths(
      ["/tmp/a.png"],
      {
        onImported: () => events.push("imported"),
        onPrepared: () => events.push("prepared"),
        onComplete: () => events.push("complete"),
      },
      controller.signal,
    );

    expect(events).toEqual([]);
    expect(assetPipeline.prepareAssets).not.toHaveBeenCalled();
  });

  it("imports a batch once and emits imported, prepared, failed, and complete events", async () => {
    const repository = {
      importAssetBatch: vi.fn(async () => [
        {
          ok: true,
          index: 0,
          path: "/tmp/a.png",
          asset: createAsset("asset-a"),
        },
        {
          ok: false,
          index: 1,
          path: "/tmp/b.txt",
          error: "Unsupported media format: txt",
        },
        {
          ok: true,
          index: 2,
          path: "/tmp/c.png",
          asset: createAsset("asset-c"),
        },
      ]),
    } as unknown as BoardRepository;
    const assetPipeline = {
      prepareAssets: vi.fn(async (assets: Asset[]) =>
        assets.map((asset) => ({
          ...asset,
          width: 640,
        })),
      ),
    } as unknown as AssetPipeline;
    const manager = new AssetImportManager({ repository, assetPipeline });
    const events: string[] = [];

    const completion = await manager.importPaths(["/tmp/a.png", "/tmp/b.txt", "/tmp/c.png"], {
      onImported: (event) => events.push(`imported:${event.index}:${event.asset.id}`),
      onPrepared: (event) => events.push(`prepared:${event.index}:${event.asset.width}`),
      onFailed: (event) => events.push(`failed:${event.index}:${event.error}`),
      onComplete: (event) => events.push(`complete:${event.importedCount}:${event.failedCount}`),
    });

    expect(repository.importAssetBatch).toHaveBeenCalledWith([
      "/tmp/a.png",
      "/tmp/b.txt",
      "/tmp/c.png",
    ]);
    expect(assetPipeline.prepareAssets).toHaveBeenCalledWith([
      expect.objectContaining({ id: "asset-a" }),
      expect.objectContaining({ id: "asset-c" }),
    ]);
    expect(events).toEqual([
      "imported:0:asset-a",
      "failed:1:Unsupported media format: txt",
      "imported:2:asset-c",
      "prepared:0:640",
      "prepared:2:640",
      "complete:2:1",
    ]);
    expect(completion).toEqual({ importedCount: 2, failedCount: 1 });
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createAsset(id: string): Asset {
  return {
    id,
    kind: "image",
    createdAt: 1,
    updatedAt: 1,
  };
}
