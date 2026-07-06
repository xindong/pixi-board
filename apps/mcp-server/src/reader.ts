import type { Asset, BoardNode, BoardSnapshot, BoardViewportSnapshot } from "@pixi-board/board-domain";
import { promises as fs } from "node:fs";
import path from "node:path";
import { McpUserError, errorMessage } from "./errors";
import { resolveProjectRoot } from "./projects";

type BoardFile = {
  schemaVersion?: number;
  updatedAt?: number;
  viewport?: BoardViewportSnapshot | null;
  nodes?: BoardNode[];
};

type AssetFile = {
  schemaVersion?: number;
  updatedAt?: number;
  assets?: Asset[];
};

export type ProjectFiles = {
  root: string;
  boardPath: string;
  assetsPath: string;
};

export type LoadedProject = ProjectFiles & {
  boardUpdatedAt: number | null;
  assetsUpdatedAt: number | null;
  snapshot: BoardSnapshot;
};

export async function resolveProjectFiles(projectRoot: unknown): Promise<ProjectFiles> {
  const root = await resolveProjectRoot(projectRoot);
  const boardPath = path.join(root, "board.json");
  const assetsPath = path.join(root, "assets.json");
  await assertReadableFile(boardPath, "board.json");
  await assertReadableFile(assetsPath, "assets.json");
  return { root, boardPath, assetsPath };
}

export async function loadProject(projectRoot: unknown): Promise<LoadedProject> {
  const files = await resolveProjectFiles(projectRoot);
  const [boardResult, assetsResult] = await Promise.all([
    readJsonFile(files.boardPath, "board.json"),
    readJsonFile(files.assetsPath, "assets.json"),
  ]);

  const board = parseBoardFile(boardResult.value, files.boardPath);
  const assets = parseAssetFile(assetsResult.value, files.assetsPath);
  return {
    ...files,
    boardUpdatedAt: board.updatedAt ?? boardResult.mtimeMs,
    assetsUpdatedAt: assets.updatedAt ?? assetsResult.mtimeMs,
    snapshot: {
      nodes: board.nodes,
      assets: assets.assets,
      viewport: board.viewport ?? null,
    },
  };
}

export function getNodeOrThrow(snapshot: BoardSnapshot, nodeId: unknown): BoardNode {
  if (typeof nodeId !== "string" || nodeId.trim() === "") {
    throw new McpUserError("nodeId must be a non-empty string");
  }
  const node = snapshot.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new McpUserError(`Node not found: ${nodeId}`);
  }
  return node;
}

export function getAssetOrThrow(snapshot: BoardSnapshot, assetId: unknown): Asset {
  if (typeof assetId !== "string" || assetId.trim() === "") {
    throw new McpUserError("assetId must be a non-empty string");
  }
  const asset = snapshot.assets.find((entry) => entry.id === assetId);
  if (!asset) {
    throw new McpUserError(`Asset not found: ${assetId}`);
  }
  return asset;
}

export function getOriginAssetForNode(snapshot: BoardSnapshot, nodeId: unknown): Asset {
  const node = getNodeOrThrow(snapshot, nodeId);
  const asset = getAssetOrThrow(snapshot, node.assetId);
  if (!asset.localPath) {
    throw new McpUserError(`Asset has no original file: ${asset.id}`);
  }
  return asset;
}

async function assertReadableFile(filePath: string, label: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw new McpUserError(`${label} is not a file: ${filePath}`);
    }
  } catch (error) {
    if (error instanceof McpUserError) throw error;
    throw new McpUserError(`Cannot read ${label} at ${filePath}: ${errorMessage(error)}`);
  }
}

async function readJsonFile(filePath: string, label: string): Promise<{ value: unknown; mtimeMs: number }> {
  let text: string;
  let mtimeMs = 0;
  try {
    const [content, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
    text = content;
    mtimeMs = Math.trunc(stat.mtimeMs);
  } catch (error) {
    throw new McpUserError(`Failed to read ${label} at ${filePath}: ${errorMessage(error)}`);
  }

  try {
    return { value: JSON.parse(text), mtimeMs };
  } catch (error) {
    throw new McpUserError(
      `Failed to parse ${label} at ${filePath}: ${errorMessage(error)}. The file may be mid-write; retry the read.`,
    );
  }
}

function parseBoardFile(value: unknown, filePath: string): Required<Pick<BoardFile, "nodes">> & BoardFile {
  if (!isRecord(value)) {
    throw new McpUserError(`Invalid board.json at ${filePath}: expected an object`);
  }
  if (!Array.isArray(value.nodes)) {
    throw new McpUserError(`Invalid board.json at ${filePath}: missing nodes array`);
  }
  return {
    schemaVersion: numberOrUndefined(value.schemaVersion),
    updatedAt: numberOrUndefined(value.updatedAt),
    viewport: parseViewport(value.viewport),
    nodes: value.nodes as BoardNode[],
  };
}

function parseAssetFile(value: unknown, filePath: string): Required<Pick<AssetFile, "assets">> & AssetFile {
  if (!isRecord(value)) {
    throw new McpUserError(`Invalid assets.json at ${filePath}: expected an object`);
  }
  if (!Array.isArray(value.assets)) {
    throw new McpUserError(`Invalid assets.json at ${filePath}: missing assets array`);
  }
  return {
    schemaVersion: numberOrUndefined(value.schemaVersion),
    updatedAt: numberOrUndefined(value.updatedAt),
    assets: value.assets as Asset[],
  };
}

function parseViewport(value: unknown): BoardViewportSnapshot | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.scale !== "number" || !isRecord(value.offset)) {
    return null;
  }
  if (typeof value.offset.x !== "number" || typeof value.offset.y !== "number") {
    return null;
  }
  return {
    scale: value.scale,
    offset: {
      x: value.offset.x,
      y: value.offset.y,
    },
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
