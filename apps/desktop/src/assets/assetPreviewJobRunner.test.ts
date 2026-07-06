import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import { AssetPreviewJobRunner } from "./assetPreviewJobRunner";
import type {
  AssetPreparationContext,
  AssetPreparationStage,
} from "./assetPreparationTypes";

describe("AssetPreviewJobRunner", () => {
  it("runs preview jobs one at a time", async () => {
    const events: string[] = [];
    const releaseFirst = createDeferred<void>();
    const stage = createStage(async (asset) => {
      events.push(`start:${asset.id}`);
      if (asset.id === "first") {
        await releaseFirst.promise;
      }
      events.push(`finish:${asset.id}`);
      return asset;
    });
    const runner = new AssetPreviewJobRunner({
      scheduler: vi.fn(async () => undefined),
    });

    const first = runner.prepareAsset(createAsset("first"), [stage]);
    const second = runner.prepareAsset(createAsset("second"), [stage]);

    await Promise.resolve();
    expect(events).toEqual(["start:first"]);

    releaseFirst.resolve();
    await Promise.all([first, second]);

    expect(events).toEqual([
      "start:first",
      "finish:first",
      "start:second",
      "finish:second",
    ]);
  });

  it("prioritizes queued user jobs over background jobs", async () => {
    const events: string[] = [];
    const releaseFirst = createDeferred<void>();
    const stage = createStage(async (asset, context) => {
      events.push(`start:${asset.id}:${context?.priority ?? "none"}`);
      if (asset.id === "background-1") {
        await releaseFirst.promise;
      }
      return asset;
    });
    const runner = new AssetPreviewJobRunner({
      scheduler: vi.fn(async () => undefined),
    });

    const first = runner.prepareAsset(createAsset("background-1"), [stage], {
      priority: "background",
    });
    const second = runner.prepareAsset(createAsset("background-2"), [stage], {
      priority: "background",
    });
    const user = runner.prepareAsset(createAsset("user"), [stage], {
      priority: "user",
    });

    await Promise.resolve();
    releaseFirst.resolve();
    await Promise.all([first, second, user]);

    expect(events).toEqual([
      "start:background-1:background",
      "start:user:user",
      "start:background-2:background",
    ]);
  });

  it("deduplicates queued jobs with the same asset and context", async () => {
    const release = createDeferred<void>();
    const prepare = vi.fn(async (asset: Asset) => {
      await release.promise;
      return asset;
    });
    const stage = createStage(prepare);
    const runner = new AssetPreviewJobRunner({
      scheduler: vi.fn(async () => undefined),
    });
    const asset = createAsset("same");
    const context = {
      force: true,
      priority: "user" as const,
      size: { width: 300, height: 200 },
    };

    const first = runner.prepareAsset(asset, [stage], context);
    const second = runner.prepareAsset(asset, [stage], context);

    expect(second).toBe(first);
    release.resolve();
    await Promise.all([first, second]);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});

function createStage(
  prepare: (asset: Asset, context?: AssetPreparationContext) => Promise<Asset>,
): AssetPreparationStage {
  return {
    supports: () => true,
    prepare,
  };
}

function createAsset(id: string): Asset {
  return {
    id,
    kind: "image",
    localPath: `${id}.bin`,
    mimeType: "application/octet-stream",
    fileName: `${id}.bin`,
    size: 1,
    hash: `${id}-hash`,
    createdAt: 1,
    updatedAt: 1,
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
