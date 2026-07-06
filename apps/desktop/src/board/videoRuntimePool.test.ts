import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeView } from "./nodeView";
import { VideoRuntimePool } from "./videoRuntimePool";

const mocks = vi.hoisted(() => ({
  createNodeVideoRuntime: vi.fn(),
  destroyVideoRuntime: vi.fn(),
  transitionTextureToView: vi.fn(),
  updateNodeView: vi.fn(),
}));

vi.mock("./nodeVideoRuntime", () => ({
  createNodeVideoRuntime: (...args: unknown[]) => mocks.createNodeVideoRuntime(...args),
  destroyVideoRuntime: (...args: unknown[]) => mocks.destroyVideoRuntime(...args),
}));

vi.mock("./nodeView", () => ({
  transitionTextureToView: (...args: unknown[]) => mocks.transitionTextureToView(...args),
  updateNodeView: (...args: unknown[]) => mocks.updateNodeView(...args),
}));

describe("VideoRuntimePool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates repeated prepares for the same node", async () => {
    const runtime = fakeRuntime("runtime-a");
    mocks.createNodeVideoRuntime.mockResolvedValue(runtime);
    const pool = createPool();

    const first = pool.prepare(fakeNode("node-a"), fakeAsset("asset-a"));
    const second = pool.prepare(fakeNode("node-a"), fakeAsset("asset-a"));

    await expect(first).resolves.toBe(runtime.element);
    await expect(second).resolves.toBe(runtime.element);
    expect(mocks.createNodeVideoRuntime).toHaveBeenCalledTimes(1);
    expect(pool.getElement("node-a")).toBeNull();
  });

  it("limits concurrent runtime preparation", async () => {
    const pending = deferred<ReturnType<typeof fakeRuntime>>();
    mocks.createNodeVideoRuntime.mockImplementationOnce(() => pending.promise);
    mocks.createNodeVideoRuntime.mockResolvedValueOnce(fakeRuntime("runtime-b"));
    const pool = createPool({ maxLoadingRuntimes: 1 });

    const first = pool.prepare(fakeNode("node-a"), fakeAsset("asset-a"));
    const second = pool.prepare(fakeNode("node-b"), fakeAsset("asset-b"));
    await Promise.resolve();

    expect(mocks.createNodeVideoRuntime).toHaveBeenCalledTimes(1);
    pending.resolve(fakeRuntime("runtime-a"));
    await first;
    await second;

    expect(mocks.createNodeVideoRuntime).toHaveBeenCalledTimes(2);
  });

  it("evicts least recently used ready runtimes", async () => {
    const firstRuntime = fakeRuntime("runtime-a");
    const secondRuntime = fakeRuntime("runtime-b");
    mocks.createNodeVideoRuntime
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime);
    const pool = createPool({ maxReadyRuntimes: 1 });

    await pool.prepare(fakeNode("node-a"), fakeAsset("asset-a"));
    await pool.prepare(fakeNode("node-b"), fakeAsset("asset-b"));

    expect(pool.getElement("node-a")).toBeNull();
    expect(await pool.activate(fakeNode("node-b"), fakeAsset("asset-b"))).toBe(secondRuntime.element);
    expect(mocks.destroyVideoRuntime).toHaveBeenCalledWith(firstRuntime);
  });

  it("activates a prepared runtime by committing its texture to the current view", async () => {
    const runtime = fakeRuntime("runtime-a");
    mocks.createNodeVideoRuntime.mockResolvedValue(runtime);
    const view = fakeView("node-a");
    const pool = createPool({ getView: () => view });

    await pool.prepare(fakeNode("node-a"), fakeAsset("asset-a"));
    await expect(pool.activate(fakeNode("node-a"), fakeAsset("asset-a"))).resolves.toBe(runtime.element);

    expect(mocks.transitionTextureToView).toHaveBeenCalledWith(view, runtime.texture);
    expect(mocks.updateNodeView).toHaveBeenCalledWith(view);
    expect(mocks.createNodeVideoRuntime).toHaveBeenCalledTimes(1);
    expect(pool.getElement("node-a")).toBe(runtime.element);
  });

  it("resolves queued prepares when a node is released before loading starts", async () => {
    const pending = deferred<ReturnType<typeof fakeRuntime>>();
    mocks.createNodeVideoRuntime.mockImplementationOnce(() => pending.promise);
    const pool = createPool({ maxLoadingRuntimes: 1 });

    const first = pool.prepare(fakeNode("node-a"), fakeAsset("asset-a"));
    const queued = pool.prepare(fakeNode("node-b"), fakeAsset("asset-b"));
    await Promise.resolve();

    pool.release("node-b");
    pending.resolve(fakeRuntime("runtime-a"));

    await first;
    await expect(queued).resolves.toBeNull();
    expect(mocks.createNodeVideoRuntime).toHaveBeenCalledTimes(1);
  });

  it("does not evict an active runtime even when it is paused", async () => {
    const firstRuntime = fakeRuntime("runtime-a");
    const secondRuntime = fakeRuntime("runtime-b");
    mocks.createNodeVideoRuntime
      .mockResolvedValueOnce(firstRuntime)
      .mockResolvedValueOnce(secondRuntime);
    const pool = createPool({ maxReadyRuntimes: 1 });

    await pool.activate(fakeNode("node-a"), fakeAsset("asset-a"));
    await pool.prepare(fakeNode("node-b"), fakeAsset("asset-b"));

    expect(pool.getElement("node-a")).toBe(firstRuntime.element);
    expect(mocks.destroyVideoRuntime).not.toHaveBeenCalledWith(firstRuntime);
  });
});

function createPool(
  options: Partial<ConstructorParameters<typeof VideoRuntimePool>[0]> = {},
): VideoRuntimePool {
  const views = new Map<string, ReturnType<typeof fakeView>>();
  return new VideoRuntimePool({
    getView: options.getView ?? ((nodeId) => {
      let view = views.get(nodeId);
      if (!view) {
        view = fakeView(nodeId);
        views.set(nodeId, view);
      }
      return view;
    }),
    resolveAssetUrl: options.resolveAssetUrl ?? (async (assetId) => `file://${assetId}`),
    maxReadyRuntimes: options.maxReadyRuntimes,
    maxLoadingRuntimes: options.maxLoadingRuntimes,
  });
}

function fakeAsset(id: string): Asset {
  return {
    id,
    kind: "video",
    mimeType: "video/mp4",
    fileName: `${id}.mp4`,
    localPath: `assets/${id}.mp4`,
    size: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

function fakeNode(id: string): BoardNode {
  return {
    id,
    assetId: `asset-${id}`,
    type: "video",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 1,
  };
}

function fakeRuntime(id: string) {
  return {
    element: {
      id,
      ended: false,
      paused: true,
    } as unknown as HTMLVideoElement,
    texture: { id: `${id}-texture` },
    cacheKey: `${id}-cache`,
  };
}

function fakeView(nodeId: string) {
  return {
    node: fakeNode(nodeId),
  } as unknown as NodeView;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
