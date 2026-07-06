import { describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  deleteAssets: vi.fn(),
  exportAsset: vi.fn(),
  importAssetFileBatch: vi.fn(),
  importAssetFiles: vi.fn(),
  loadBoardSnapshot: vi.fn(),
  resolveAssetUrl: vi.fn(),
  saveAssetDerivative: vi.fn(),
  saveAssetDerivatives: vi.fn(),
  saveBoardState: vi.fn(),
  updateAssetMetadata: vi.fn(),
  upsertAssets: vi.fn(),
}));

vi.mock("../tauriBridge", () => bridge);

import { TauriBoardRepository } from "./tauriBoardRepository";

describe("TauriBoardRepository", () => {
  it("passes its bound project root to bridge calls", async () => {
    const repository = new TauriBoardRepository({ projectRoot: "/tmp/canvas-a" });

    bridge.loadBoardSnapshot.mockResolvedValue({ nodes: [], assets: [] });
    bridge.saveBoardState.mockResolvedValue(undefined);
    bridge.resolveAssetUrl.mockResolvedValue("asset://preview");
    bridge.importAssetFileBatch.mockResolvedValue([]);
    bridge.deleteAssets.mockResolvedValue(undefined);

    await repository.loadSnapshot();
    await repository.saveBoardState([], { scale: 1, offset: { x: 0, y: 0 } });
    await repository.resolveAssetUrl("asset-1", "preview");
    await repository.importAssetBatch(["/tmp/a.png"]);
    await repository.deleteAssets(["asset-1"]);

    expect(bridge.loadBoardSnapshot).toHaveBeenCalledWith("/tmp/canvas-a");
    expect(bridge.saveBoardState).toHaveBeenCalledWith("/tmp/canvas-a", [], {
      scale: 1,
      offset: { x: 0, y: 0 },
    });
    expect(bridge.resolveAssetUrl).toHaveBeenCalledWith("/tmp/canvas-a", "asset-1", "preview");
    expect(bridge.importAssetFileBatch).toHaveBeenCalledWith("/tmp/canvas-a", ["/tmp/a.png"]);
    expect(bridge.deleteAssets).toHaveBeenCalledWith("/tmp/canvas-a", ["asset-1"]);
  });
});
