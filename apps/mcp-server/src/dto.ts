import {
  displayNodeName,
  nodeBounds,
  type Asset,
  type BoardNode,
  type BoardSnapshot,
  type ProjectInfo,
} from "@pixi-board/board-domain";
import path from "node:path";

export type McpNodeDto = {
  id: string;
  type: BoardNode["type"];
  name?: string;
  displayName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  assetId: string;
  options?: Record<string, unknown>;
};

export type McpAssetDto = {
  id: string;
  kind: Asset["kind"];
  fileName?: string;
  mimeType?: string;
  size?: number;
  original?: {
    localPath: string;
    absolutePath: string;
    sourceUrl?: string;
    webLink?: string;
  };
  derivatives: Array<{
    variant: string;
    localPath: string;
    absolutePath: string;
    extension: string;
    updatedAt: number;
  }>;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
    hash?: string;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
  };
};

export function toNodeDto(node: BoardNode): McpNodeDto {
  const bounds = nodeBounds(node);
  const base: McpNodeDto = {
    id: node.id,
    type: node.type,
    name: node.name,
    displayName: displayNodeName(node.name),
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    zIndex: node.zIndex,
    locked: node.locked ?? false,
    assetId: node.assetId,
    options: node.options,
    bounds: {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    },
  };

  return {
    ...base,
  };
}

export function toAssetDto(projectRoot: string, asset: Asset): McpAssetDto {
  return {
    id: asset.id,
    kind: asset.kind,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    size: asset.size,
    original: asset.localPath
      ? {
          localPath: asset.localPath,
          absolutePath: path.resolve(projectRoot, asset.localPath),
          sourceUrl: asset.sourceUrl,
          webLink: asset.webLink,
        }
      : undefined,
    derivatives: Object.entries(asset.derivatives ?? {}).map(([variant, derivative]) => ({
      variant,
      localPath: derivative.localPath,
      absolutePath: path.resolve(projectRoot, derivative.localPath),
      extension: derivative.extension,
      updatedAt: derivative.updatedAt,
    })),
    metadata: {
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      format: asset.format,
      hash: asset.hash,
      metadata: asset.metadata,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    },
  };
}

export function toProjectInfo(projectRoot: string): ProjectInfo {
  return {
    name: path.basename(projectRoot),
    rootPath: projectRoot,
    boardPath: path.join(projectRoot, "board.json"),
    assetsPath: path.join(projectRoot, "assets.json"),
  };
}

export function toSnapshotDto(projectRoot: string, snapshot: BoardSnapshot) {
  return {
    project: toProjectInfo(projectRoot),
    viewport: snapshot.viewport ?? null,
    nodes: snapshot.nodes.map(toNodeDto),
    assets: snapshot.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.size,
      metadata: asset.metadata,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      updatedAt: asset.updatedAt,
    })),
  };
}

export function nodeAsset(node: BoardNode, assets: Asset[]): Asset | undefined {
  return assets.find((asset) => asset.id === node.assetId);
}
