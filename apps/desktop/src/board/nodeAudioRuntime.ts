import { Texture } from "../pixi";
import { createAudioWaveformCanvas } from "../audioWaveform";

export type NodeAudioRuntime = {
  element: HTMLAudioElement;
  peaks?: number[];
  waveformTexture?: Texture;
  renderFrame: number | null;
  renderKey: string | null;
  teardown: () => void;
};

export function createNodeAudioRuntime(url: string): NodeAudioRuntime {
  const element = new Audio(url);
  element.preload = "metadata";
  return {
    element,
    renderFrame: null,
    renderKey: null,
    teardown: () => {},
  };
}

export function bindNodeAudioRuntime(runtime: NodeAudioRuntime, onChange: () => void): void {
  const events = ["durationchange", "loadedmetadata", "pause", "play", "seeked", "timeupdate"];
  for (const eventName of events) {
    runtime.element.addEventListener(eventName, onChange);
  }
  runtime.teardown = () => {
    for (const eventName of events) {
      runtime.element.removeEventListener(eventName, onChange);
    }
    cancelNodeAudioWaveformRender(runtime);
  };
}

export function scheduleNodeAudioWaveformRender(
  runtime: NodeAudioRuntime,
  render: () => void,
): void {
  if (runtime.renderFrame !== null) return;
  runtime.renderFrame = requestAnimationFrame(() => {
    runtime.renderFrame = null;
    render();
    if (!runtime.element.paused && !runtime.element.ended) {
      scheduleNodeAudioWaveformRender(runtime, render);
    }
  });
}

export function createNodeAudioWaveformTexture(runtime: NodeAudioRuntime): {
  texture: Texture;
  previousTexture?: Texture;
  changed: boolean;
} {
  const duration = runtime.element.duration;
  const progress =
    Number.isFinite(duration) && duration > 0 ? runtime.element.currentTime / duration : 0;
  const renderKey = `${runtime.peaks ? "real" : "default"}:${Math.round(progress * 640)}`;
  if (runtime.renderKey === renderKey && runtime.waveformTexture) {
    return {
      texture: runtime.waveformTexture,
      previousTexture: runtime.waveformTexture,
      changed: false,
    };
  }

  runtime.renderKey = renderKey;
  const texture = Texture.from(
    createAudioWaveformCanvas({
      peaks: runtime.peaks,
      progress,
    }),
  );
  const previousTexture = runtime.waveformTexture;
  runtime.waveformTexture = texture;
  return {
    texture,
    previousTexture,
    changed: true,
  };
}

export function destroyAudioRuntime(runtime: NodeAudioRuntime): void {
  runtime.teardown();
  runtime.element.pause();
  runtime.element.removeAttribute("src");
  runtime.element.load();
  runtime.waveformTexture?.destroy(true);
}

function cancelNodeAudioWaveformRender(runtime: NodeAudioRuntime): void {
  if (runtime.renderFrame === null) return;
  cancelAnimationFrame(runtime.renderFrame);
  runtime.renderFrame = null;
}
