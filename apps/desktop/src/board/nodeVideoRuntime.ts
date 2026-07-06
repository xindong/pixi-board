import { Assets, Texture } from "../pixi";
import type { Asset } from "@pixi-board/board-domain";

export type NodeVideoRuntime = {
  element: HTMLVideoElement;
  texture: Texture;
  cacheKey: string;
};

type NodeVideoRuntimeOptions = {
  preload?: boolean;
};

export async function createNodeVideoRuntime(
  url: string,
  nodeId: string,
  asset: Asset,
  options: NodeVideoRuntimeOptions = {},
): Promise<NodeVideoRuntime> {
  const cacheKey = `${url}#node-${encodeURIComponent(nodeId)}`;
  const texture = await Assets.load<Texture>({
    src: cacheKey,
    parser: "video",
    data: {
      autoPlay: false,
      mime: asset.mimeType,
      muted: false,
      playsinline: true,
      preload: options.preload ?? false,
    },
  });
  const source = texture.source as { resource?: unknown };
  const element = source.resource;
  if (!(element instanceof HTMLVideoElement)) {
    texture.destroy(true);
    throw new Error("Pixi video texture did not expose an HTMLVideoElement");
  }
  element.muted = false;
  element.volume = 1;

  return {
    element,
    texture,
    cacheKey,
  };
}

export function destroyVideoRuntime(runtime: NodeVideoRuntime): void {
  runtime.element.pause();
  void Assets.unload(runtime.cacheKey).catch(() => {
    runtime.texture.destroy(true);
  });
}
