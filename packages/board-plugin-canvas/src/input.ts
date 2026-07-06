import {
  asRecord,
  PluginUserError,
  readString,
} from "@pixi-board/board-plugin-sdk";

export const ASSET_KIND_VALUES = ["image", "video", "audio", "model", "text", "markdown", "html", "importing", "generating"] as const;
export const NODE_TYPE_VALUES = ASSET_KIND_VALUES;
export const MODEL_FORMAT_VALUES = [
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
] as const;

export function readProjectRoot(input: unknown): string {
  return readString(asRecord(input), "projectRoot");
}

export function readCreateNodes(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PluginUserError("nodes must be a non-empty array");
  }
  return value.map((entry, index) => {
    const node = asRecord(entry, `nodes[${index}]`);
    if (node.x !== undefined || node.y !== undefined) {
      throw new PluginUserError(`nodes[${index}].x/y is not supported; the host canvas chooses placement`);
    }
    if (node.kind !== undefined && !isAssetKind(node.kind)) {
      throw new PluginUserError(`nodes[${index}].kind must be one of ${ASSET_KIND_VALUES.join(", ")}`);
    }
    const kind = node.kind;
    const hasPath = typeof node.path === "string" && node.path.trim() !== "";
    if (kind === "generating") {
      if (node.path !== undefined && !hasPath) {
        throw new PluginUserError(`nodes[${index}].path must be a non-empty string when provided`);
      }
    } else if (!hasPath) {
      throw new PluginUserError(`nodes[${index}].path must be a non-empty string unless kind is generating`);
    }
    if (node.metadata !== undefined) {
      throw new PluginUserError(`nodes[${index}].metadata is not supported; write content to a source file and pass path`);
    }
    if (node.text !== undefined) {
      throw new PluginUserError(`nodes[${index}].text is not supported; write content to a source file and pass path`);
    }
    if (node.options !== undefined) {
      asRecord(node.options, `nodes[${index}].options`);
    }
    return node;
  });
}

export function readAssetUpdates(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PluginUserError("assets must be a non-empty array");
  }
  return value.map((entry, index) => {
    const update = asRecord(entry, `assets[${index}]`);
    readString(update, "id");
    readOptionalFiniteNumber(update, "width", `assets[${index}]`);
    readOptionalFiniteNumber(update, "height", `assets[${index}]`);
    readOptionalFiniteNumber(update, "duration", `assets[${index}]`);
    if (update.format !== undefined && !MODEL_FORMAT_VALUES.includes(update.format as (typeof MODEL_FORMAT_VALUES)[number])) {
      throw new PluginUserError(`assets[${index}].format must be a supported model format`);
    }
    if (update.metadata !== undefined) {
      const metadata = asRecord(update.metadata, `assets[${index}].metadata`);
      assertNoContentMetadata(metadata, `assets[${index}].metadata`);
    }
    return update;
  });
}

export function readUpdates(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PluginUserError("updates must be a non-empty array");
  }
  return value.map((entry, index) => {
    const update = asRecord(entry, `updates[${index}]`);
    readString(update, "id");
    if ("text" in update) {
      throw new PluginUserError(`updates[${index}].text is not supported; edit the source file instead`);
    }
    readOptionalFiniteNumber(update, "x", `updates[${index}]`);
    readOptionalFiniteNumber(update, "y", `updates[${index}]`);
    readOptionalFiniteNumber(update, "width", `updates[${index}]`);
    readOptionalFiniteNumber(update, "height", `updates[${index}]`);
    readOptionalFiniteNumber(update, "rotation", `updates[${index}]`);
    readOptionalFiniteNumber(update, "zIndex", `updates[${index}]`);
    if (update.options !== undefined) {
      asRecord(update.options, `updates[${index}].options`);
    }
    return update;
  });
}

function isAssetKind(value: unknown): value is (typeof ASSET_KIND_VALUES)[number] {
  return typeof value === "string" && ASSET_KIND_VALUES.includes(value as (typeof ASSET_KIND_VALUES)[number]);
}

function assertNoContentMetadata(metadata: Record<string, unknown>, label: string): void {
  for (const key of ["html", "markdown", "text", "content"]) {
    if (metadata[key] !== undefined) {
      throw new PluginUserError(`${label}.${key} is not supported; edit the source file instead`);
    }
  }
}

function readOptionalFiniteNumber(input: Record<string, unknown>, key: string, label: string): void {
  const value = input[key];
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new PluginUserError(`${label}.${key} must be a finite number`);
  }
}
