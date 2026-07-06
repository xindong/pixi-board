import type { Asset, AssetVariant, BoardNode } from "@pixi-board/board-domain";
import { transitionTextureToView, updateNodeView, type NodeView } from "./nodeView";
import {
  createNodeVideoRuntime,
  destroyVideoRuntime,
  type NodeVideoRuntime,
} from "./nodeVideoRuntime";

const DEFAULT_MAX_READY_RUNTIMES = 2;
const DEFAULT_MAX_LOADING_RUNTIMES = 1;

type VideoRuntimePoolOptions = {
  getView: (nodeId: string) => NodeView | undefined;
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>;
  maxReadyRuntimes?: number;
  maxLoadingRuntimes?: number;
};

type VideoRuntimeEntry = {
  nodeId: string;
  runtime?: NodeVideoRuntime;
  promise?: Promise<NodeVideoRuntime | null>;
  lastUsedAt: number;
  queuedLoad?: QueuedVideoRuntimeLoad;
  active: boolean;
};

type QueuedVideoRuntimeLoad = {
  entry: VideoRuntimeEntry;
  start: () => void;
  resolve: (runtime: NodeVideoRuntime | null) => void;
  started: boolean;
};

export class VideoRuntimePool {
  private readonly getView: VideoRuntimePoolOptions["getView"];
  private readonly resolveAssetUrl: VideoRuntimePoolOptions["resolveAssetUrl"];
  private readonly maxReadyRuntimes: number;
  private readonly maxLoadingRuntimes: number;
  private readonly entries = new Map<string, VideoRuntimeEntry>();
  private readonly prepareQueue: QueuedVideoRuntimeLoad[] = [];
  private loadingCount = 0;

  constructor(options: VideoRuntimePoolOptions) {
    this.getView = options.getView;
    this.resolveAssetUrl = options.resolveAssetUrl;
    this.maxReadyRuntimes = options.maxReadyRuntimes ?? DEFAULT_MAX_READY_RUNTIMES;
    this.maxLoadingRuntimes = options.maxLoadingRuntimes ?? DEFAULT_MAX_LOADING_RUNTIMES;
  }

  has(nodeId: string): boolean {
    const entry = this.entries.get(nodeId);
    return Boolean(entry?.runtime && entry.active);
  }

  getElement(nodeId: string): HTMLVideoElement | null {
    const entry = this.entries.get(nodeId);
    if (!entry?.active) return null;
    return entry.runtime?.element ?? null;
  }

  prepare(node: BoardNode, asset: Asset): Promise<HTMLVideoElement | null> {
    const entry = this.ensureEntry(node.id);
    entry.lastUsedAt = performance.now();
    if (entry.runtime) {
      return Promise.resolve(entry.runtime.element);
    }
    if (!entry.promise) {
      entry.promise = this.enqueueLoad(node, asset, entry);
    }
    return entry.promise.then((runtime) => runtime?.element ?? null);
  }

  async activate(node: BoardNode, asset: Asset): Promise<HTMLVideoElement | null> {
    const runtime = await this.prepareRuntime(node, asset);
    if (!runtime) return null;

    const view = this.getView(node.id);
    if (!view) {
      this.release(node.id);
      return null;
    }

    transitionTextureToView(view, runtime.texture);
    updateNodeView(view);
    const entry = this.entries.get(node.id);
    if (entry?.runtime === runtime) {
      entry.active = true;
      entry.lastUsedAt = performance.now();
    }
    return runtime.element;
  }

  release(nodeId: string): void {
    const entry = this.entries.get(nodeId);
    if (!entry) return;
    this.entries.delete(nodeId);
    this.cancelQueuedLoad(entry);
    if (entry.runtime) {
      destroyVideoRuntime(entry.runtime);
    }
  }

  destroy(): void {
    for (const nodeId of [...this.entries.keys()]) {
      this.release(nodeId);
    }
    for (const queued of this.prepareQueue.splice(0)) {
      queued.resolve(null);
    }
  }

  private async prepareRuntime(node: BoardNode, asset: Asset): Promise<NodeVideoRuntime | null> {
    const entry = this.ensureEntry(node.id);
    entry.lastUsedAt = performance.now();
    if (entry.runtime) return entry.runtime;
    if (!entry.promise) {
      entry.promise = this.enqueueLoad(node, asset, entry);
    }
    return entry.promise;
  }

  private ensureEntry(nodeId: string): VideoRuntimeEntry {
    let entry = this.entries.get(nodeId);
    if (!entry) {
      entry = {
        nodeId,
        active: false,
        lastUsedAt: performance.now(),
      };
      this.entries.set(nodeId, entry);
    }
    return entry;
  }

  private enqueueLoad(
    node: BoardNode,
    asset: Asset,
    entry: VideoRuntimeEntry,
  ): Promise<NodeVideoRuntime | null> {
    return new Promise((resolve) => {
      const queued: QueuedVideoRuntimeLoad = {
        entry,
        resolve,
        started: false,
        start: () => {
          queued.started = true;
          void this.loadRuntime(node, asset, entry).then(resolve);
        },
      };
      entry.queuedLoad = queued;
      this.prepareQueue.push(queued);
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    while (
      this.loadingCount < this.maxLoadingRuntimes &&
      this.prepareQueue.length > 0
    ) {
      const queued = this.prepareQueue.shift();
      if (!queued) return;
      queued.entry.queuedLoad = undefined;
      this.loadingCount++;
      queued.start();
    }
  }

  private async loadRuntime(
    node: BoardNode,
    asset: Asset,
    entry: VideoRuntimeEntry,
  ): Promise<NodeVideoRuntime | null> {
    try {
      if (!this.entries.has(node.id)) return null;
      const view = this.getView(node.id);
      if (!view) return null;

      const url = await this.resolveAssetUrl(asset.id, "original");
      if (this.getView(node.id) !== view || this.entries.get(node.id) !== entry) return null;

      const runtime = await createNodeVideoRuntime(url, node.id, asset);
      if (this.getView(node.id) !== view || this.entries.get(node.id) !== entry) {
        destroyVideoRuntime(runtime);
        return null;
      }

      entry.runtime = runtime;
      entry.lastUsedAt = performance.now();
      this.evictReadyRuntimes();
      return runtime;
    } catch (error) {
      console.warn("Video runtime preparation failed", error);
      return null;
    } finally {
      if (entry.promise) {
        entry.promise = undefined;
      }
      this.loadingCount = Math.max(0, this.loadingCount - 1);
      this.drainQueue();
    }
  }

  private cancelQueuedLoad(entry: VideoRuntimeEntry): void {
    const queued = entry.queuedLoad;
    if (!queued || queued.started) return;
    entry.queuedLoad = undefined;
    const index = this.prepareQueue.indexOf(queued);
    if (index >= 0) {
      this.prepareQueue.splice(index, 1);
    }
    queued.resolve(null);
  }

  private evictReadyRuntimes(): void {
    const readyEntries = [...this.entries.values()]
      .filter((entry) => entry.runtime && !entry.active && !isRuntimePlaying(entry.runtime))
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt);

    while (readyEntries.length > this.maxReadyRuntimes) {
      const entry = readyEntries.shift();
      if (!entry) return;
      this.release(entry.nodeId);
    }
  }
}

function isRuntimePlaying(runtime: NodeVideoRuntime): boolean {
  return !runtime.element.paused && !runtime.element.ended;
}
