import { loadAudioPeaksDerivative } from "../audioWaveform";
import type { Asset, AssetVariant } from "@pixi-board/board-domain";
import { applyTextureToView, transitionTextureToView, type NodeView } from "./nodeView";
import {
  bindNodeAudioRuntime,
  createNodeAudioWaveformTexture,
  scheduleNodeAudioWaveformRender,
  type NodeAudioRuntime,
} from "./nodeAudioRuntime";

type NodeAudioRuntimeBinderOptions = {
  getRuntime: (nodeId: string) => NodeAudioRuntime | undefined;
  getView: (nodeId: string) => NodeView | undefined;
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>;
};

export class NodeAudioRuntimeBinder {
  private readonly getRuntime: NodeAudioRuntimeBinderOptions["getRuntime"];
  private readonly getView: NodeAudioRuntimeBinderOptions["getView"];
  private readonly resolveAssetUrl: NodeAudioRuntimeBinderOptions["resolveAssetUrl"];

  constructor(options: NodeAudioRuntimeBinderOptions) {
    this.getRuntime = options.getRuntime;
    this.getView = options.getView;
    this.resolveAssetUrl = options.resolveAssetUrl;
  }

  bind(nodeId: string, asset: Asset, runtime: NodeAudioRuntime, view: NodeView): void {
    bindNodeAudioRuntime(runtime, () => this.scheduleRender(nodeId, runtime));
    this.render(nodeId, runtime);
    void this.loadPeaks(nodeId, asset, runtime, view);
  }

  private async loadPeaks(
    nodeId: string,
    asset: Asset,
    runtime: NodeAudioRuntime,
    view: NodeView,
  ): Promise<void> {
    try {
      const waveformUrl = await this.resolveAssetUrl(asset.id, "waveform");
      const peaks = await loadAudioPeaksDerivative(waveformUrl);
      if (this.getRuntime(nodeId) !== runtime || this.getView(nodeId) !== view) return;
      runtime.peaks = peaks;
      this.render(nodeId, runtime);
    } catch {
      // Missing waveform derivatives are expected for older projects and failed preparations.
    }
  }

  private scheduleRender(nodeId: string, runtime: NodeAudioRuntime): void {
    scheduleNodeAudioWaveformRender(runtime, () => this.render(nodeId, runtime));
  }

  private render(nodeId: string, runtime: NodeAudioRuntime): void {
    const view = this.getView(nodeId);
    if (!view || this.getRuntime(nodeId) !== runtime) return;

    const { texture, previousTexture, changed } = createNodeAudioWaveformTexture(runtime);
    if (!changed) return;
    if (previousTexture) {
      applyTextureToView(view, texture);
    } else {
      transitionTextureToView(view, texture, 120);
    }
    previousTexture?.destroy(true);
  }
}
