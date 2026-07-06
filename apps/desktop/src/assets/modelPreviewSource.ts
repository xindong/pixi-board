import type { Asset, ModelAssetFormat } from "@pixi-board/board-domain";
import { extensionOf } from "../utils";
import type { ModelPreviewSource } from "./modelPreviewTypes";

const MODEL_PREVIEW_PRIORITY: ModelAssetFormat[] = [
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
];
const MODEL_PREVIEW_FORMATS = new Set<ModelAssetFormat>(MODEL_PREVIEW_PRIORITY);

export async function resolveModelPreviewSource(asset: Asset, url: string): Promise<ModelPreviewSource> {
  const format = modelFormatFromAsset(asset);
  if (format !== "zip") {
    return {
      format,
      url,
    };
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to read model zip: HTTP ${response.status}`);
  }

  const files = await unzipModelArchive(new Uint8Array(await response.arrayBuffer()));
  const candidate = pickZipModelEntry(files);
  if (!candidate) {
    throw new Error("Model zip does not contain a supported first-level model file");
  }

  return {
    format: candidate.format,
    url,
    bytes: candidate.bytes,
  };
}

async function unzipModelArchive(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import("three/examples/jsm/libs/fflate.module.js");
  return unzipSync(data);
}

function pickZipModelEntry(
  files: Record<string, Uint8Array>,
): { format: ModelAssetFormat; bytes: Uint8Array } | null {
  const candidates = Object.entries(files)
    .map(([name, bytes]) => ({
      name,
      bytes,
      format: modelFormatFromFileName(name),
    }))
    .filter(
      (entry): entry is { name: string; bytes: Uint8Array; format: ModelAssetFormat } =>
        Boolean(entry.format) &&
        !entry.name.endsWith("/") &&
        !entry.name.replace(/\\/g, "/").includes("/"),
    )
    .sort((left, right) => {
      const priorityDelta =
        MODEL_PREVIEW_PRIORITY.indexOf(left.format) - MODEL_PREVIEW_PRIORITY.indexOf(right.format);
      if (priorityDelta !== 0) return priorityDelta;
      return left.name.localeCompare(right.name);
    });

  const [candidate] = candidates;
  return candidate
    ? {
        format: candidate.format,
        bytes: candidate.bytes,
      }
    : null;
}

function modelFormatFromAsset(asset: Asset): ModelAssetFormat {
  if (asset.format && isModelPreviewFormat(asset.format)) return asset.format;
  return modelFormatFromFileName(asset.fileName ?? "") ?? "glb";
}

function modelFormatFromFileName(fileName: string): ModelAssetFormat | null {
  const extension = extensionOf(fileName);
  if (extension === "zip") return "zip";
  if (isModelPreviewFormat(extension)) return extension;
  return null;
}

function isModelPreviewFormat(value: string): value is ModelAssetFormat {
  return MODEL_PREVIEW_FORMATS.has(value as ModelAssetFormat);
}
