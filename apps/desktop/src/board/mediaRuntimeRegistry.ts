import type { Asset, AssetVariant, BoardNode } from "@pixi-board/board-domain";
import type { NodeView } from "./nodeView";
import { NodeAudioRuntimeBinder } from "./nodeAudioRuntimeBinder";
import {
  createNodeAudioRuntime,
  destroyAudioRuntime,
  type NodeAudioRuntime,
} from "./nodeAudioRuntime";
import { VideoRuntimePool } from "./videoRuntimePool";

type MediaRuntimeRegistryOptions = {
  getView: (nodeId: string) => NodeView | undefined;
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>;
};

export class MediaRuntimeRegistry {
  private readonly getView: MediaRuntimeRegistryOptions["getView"];
  private readonly resolveAssetUrl: MediaRuntimeRegistryOptions["resolveAssetUrl"];
  private readonly audioBinder: NodeAudioRuntimeBinder;
  private readonly videoRuntimePool: VideoRuntimePool;
  private readonly audioRuntimes = new Map<string, NodeAudioRuntime>();
  private readonly audioRuntimeLoads = new Map<string, Promise<NodeAudioRuntime | null>>();

  constructor(options: MediaRuntimeRegistryOptions) {
    this.getView = options.getView;
    this.resolveAssetUrl = options.resolveAssetUrl;
    this.videoRuntimePool = new VideoRuntimePool({
      getView: this.getView,
      resolveAssetUrl: this.resolveAssetUrl,
    });
    this.audioBinder = new NodeAudioRuntimeBinder({
      getRuntime: (nodeId) => this.audioRuntimes.get(nodeId),
      getView: this.getView,
      resolveAssetUrl: this.resolveAssetUrl,
    });
  }

  isActive(nodeId: string): boolean {
    return this.videoRuntimePool.has(nodeId) || this.audioRuntimes.has(nodeId);
  }

  getNodeVideoElement(nodeId: string): HTMLVideoElement | null {
    return this.videoRuntimePool.getElement(nodeId);
  }

  getNodeAudioElement(nodeId: string): HTMLAudioElement | null {
    return this.audioRuntimes.get(nodeId)?.element ?? null;
  }

  prepareNodeVideo(node: BoardNode, asset: Asset): Promise<HTMLVideoElement | null> {
    return this.videoRuntimePool.prepare(node, asset);
  }

  async activateNodeVideo(node: BoardNode, asset: Asset): Promise<HTMLVideoElement | null> {
    return this.videoRuntimePool.activate(node, asset);
  }

  async activateNodeAudio(node: BoardNode, asset: Asset): Promise<HTMLAudioElement | null> {
    const existing = this.audioRuntimes.get(node.id);
    if (existing) return existing.element;

    const existingLoad = this.audioRuntimeLoads.get(node.id);
    if (existingLoad) return (await existingLoad)?.element ?? null;

    const view = this.getView(node.id);
    if (!view) return null;

    const load = (async () => {
      const url = await this.resolveAssetUrl(asset.id, "original");
      if (this.getView(node.id) !== view) return null;

      const runtime = createNodeAudioRuntime(url);
      this.audioRuntimes.set(node.id, runtime);
      this.audioBinder.bind(node.id, asset, runtime, view);

      return runtime;
    })();

    this.audioRuntimeLoads.set(node.id, load);
    try {
      return (await load)?.element ?? null;
    } catch (error) {
      console.warn("Audio playback runtime failed", error);
      return null;
    } finally {
      if (this.audioRuntimeLoads.get(node.id) === load) {
        this.audioRuntimeLoads.delete(node.id);
      }
    }
  }

  destroyNodeRuntime(nodeId: string): void {
    this.destroyNodeVideoRuntime(nodeId);
    this.destroyNodeAudioRuntime(nodeId);
  }

  destroy(): void {
    this.videoRuntimePool.destroy();
    for (const id of [...this.audioRuntimes.keys()]) {
      this.destroyNodeAudioRuntime(id);
    }
  }

  private destroyNodeVideoRuntime(nodeId: string): void {
    this.videoRuntimePool.release(nodeId);
  }

  private destroyNodeAudioRuntime(nodeId: string): void {
    const runtime = this.audioRuntimes.get(nodeId);
    if (!runtime) return;

    this.audioRuntimes.delete(nodeId);
    destroyAudioRuntime(runtime);
  }
}
