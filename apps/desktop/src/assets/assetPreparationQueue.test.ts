import { describe, expect, it, vi } from "vitest";
import type { Asset } from "@pixi-board/board-domain";
import { AssetPreparationQueue } from "./assetPreparationQueue";

describe("AssetPreparationQueue", () => {
  it("deduplicates inflight preparation work for repeated asset ids", async () => {
    const worker = vi.fn(async (asset: Asset) => {
      await Promise.resolve();
      return {
        ...asset,
        width: 640,
      };
    });

    const queue = new AssetPreparationQueue(3, worker);
    const repeatedAsset = createAsset("asset-1");

    const prepared = await queue.prepareAll([
      repeatedAsset,
      { ...repeatedAsset },
    ]);

    expect(worker).toHaveBeenCalledTimes(1);
    expect(prepared).toEqual([
      expect.objectContaining({ id: "asset-1", width: 640 }),
      expect.objectContaining({ id: "asset-1", width: 640 }),
    ]);
  });

  it("uses the scheduler and respects the configured concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const scheduler = vi.fn(async () => {});
    const worker = vi.fn(async (asset: Asset) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
      active--;
      return asset;
    });

    const queue = new AssetPreparationQueue(2, worker, scheduler);

    await queue.prepareAll([
      createAsset("asset-1"),
      createAsset("asset-2"),
      createAsset("asset-3"),
      createAsset("asset-4"),
      createAsset("asset-5"),
    ]);

    expect(scheduler).toHaveBeenCalledTimes(5);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

function createAsset(id: string): Asset {
  return {
    id,
    kind: "image",
    localPath: `${id}.png`,
    mimeType: "image/png",
    fileName: `${id}.png`,
    size: 1,
    hash: `${id}-hash`,
    createdAt: 1,
    updatedAt: 1,
  };
}
