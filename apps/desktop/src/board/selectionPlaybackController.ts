import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { createMediaPlaybackController, type MediaPlayback } from "./mediaPlayback";
import type { MediaRuntimeRegistry } from "./mediaRuntimeRegistry";
import type { BoardStore } from "./boardStore";

type ActivePlayback = {
  nodeId: string;
  teardown: () => void;
};

type SelectionPlaybackControllerOptions = {
  mediaRuntime: MediaRuntimeRegistry;
  store: BoardStore;
};

export class SelectionPlaybackController {
  private readonly mediaRuntime: MediaRuntimeRegistry;
  private readonly store: BoardStore;
  private activePlayback: ActivePlayback | null = null;

  constructor(options: SelectionPlaybackControllerOptions) {
    this.mediaRuntime = options.mediaRuntime;
    this.store = options.store;
  }

  createPlayback(node: BoardNode): MediaPlayback | null {
    const asset = this.store.getAsset(node.assetId);
    if (!asset) return null;

    if (asset.kind === "video") {
      return this.createVideoPlayback(node, asset);
    }
    if (asset.kind === "audio") {
      return this.createAudioPlayback(node, asset);
    }
    return null;
  }

  clear(): void {
    if (!this.activePlayback) return;
    this.activePlayback.teardown();
    this.activePlayback = null;
  }

  private createVideoPlayback(node: BoardNode, asset: Asset): MediaPlayback {
    const playback = createMediaPlaybackController({
      activateElement: () => this.mediaRuntime.activateNodeVideo(node, asset),
      durationFallback: asset.duration,
      getElement: () => this.mediaRuntime.getNodeVideoElement(node.id),
      isActive: () => this.activePlayback?.nodeId === node.id,
    });

    this.activePlayback = {
      nodeId: node.id,
      teardown: playback.teardown,
    };
    void this.mediaRuntime.prepareNodeVideo(node, asset);
    return playback.controls;
  }

  private createAudioPlayback(node: BoardNode, asset: Asset): MediaPlayback {
    const playback = createMediaPlaybackController({
      activateElement: () => this.mediaRuntime.activateNodeAudio(node, asset),
      durationFallback: asset.duration,
      getElement: () => this.mediaRuntime.getNodeAudioElement(node.id),
      isActive: () => this.activePlayback?.nodeId === node.id,
    });

    this.activePlayback = {
      nodeId: node.id,
      teardown: playback.teardown,
    };
    return playback.controls;
  }
}
