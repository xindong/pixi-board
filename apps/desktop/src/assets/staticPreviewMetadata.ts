import type { AssetMetadataUpdate, FileAssetKind, ModelAssetFormat } from "@pixi-board/board-domain";
import { extensionOf } from "../utils";
import { AUDIO_WAVEFORM_HEIGHT, AUDIO_WAVEFORM_WIDTH } from "../audioWaveform";

export const STATIC_PREVIEW_WIDTH = 1920;
export const STATIC_PREVIEW_HEIGHT = 1080;

const MODEL_FORMATS = new Set<ModelAssetFormat>([
  "glb",
  "gltf",
  "obj",
  "fbx",
  "stl",
  "ply",
  "dae",
  "3mf",
  "3ds",
  "vrml",
  "wrl",
  "zip",
]);

export function staticPreviewMetadataFor(
  input: { kind: FileAssetKind; fileName?: string },
): AssetMetadataUpdate {
  if (input.kind === "audio") {
    return {
      width: AUDIO_WAVEFORM_WIDTH,
      height: AUDIO_WAVEFORM_HEIGHT,
    };
  }

  return {
    width: STATIC_PREVIEW_WIDTH,
    height: STATIC_PREVIEW_HEIGHT,
    format: input.kind === "model" ? modelFormatFor(input.fileName) : undefined,
  };
}

function modelFormatFor(fileName?: string): ModelAssetFormat {
  const extension = extensionOf(fileName ?? "");
  if (MODEL_FORMATS.has(extension as ModelAssetFormat)) {
    return extension as ModelAssetFormat;
  }
  return "glb";
}
