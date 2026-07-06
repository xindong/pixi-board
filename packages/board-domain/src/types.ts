export type AssetKind =
  | "image"
  | "video"
  | "audio"
  | "model"
  | "text"
  | "markdown"
  | "html"
  | "importing"
  | "generating";
export type BoardNodeType = AssetKind;
export type FileAssetKind = Extract<AssetKind, "image" | "video" | "audio" | "model">;
export type AssetVariant = "original" | "preview" | "waveform";
export type AssetDerivativeVariant = "preview" | "derived" | "waveform";
export type ModelAssetFormat =
  | "glb"
  | "gltf"
  | "obj"
  | "fbx"
  | "stl"
  | "ply"
  | "dae"
  | "3mf"
  | "3ds"
  | "vrml"
  | "wrl"
  | "zip";

export type AssetDerivative = {
  localPath: string;
  extension: string;
  createdAt: number;
  updatedAt: number;
};

export type AssetDerivatives = Partial<Record<AssetDerivativeVariant, AssetDerivative>>;

export type BoardNode = {
  id: string;
  type: BoardNodeType;
  name?: string;
  assetId: string;
  options?: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked?: boolean;
};

export type Asset = {
  id: string;
  kind: AssetKind;
  localPath?: string;
  derivatives?: AssetDerivatives;
  metadata?: Record<string, unknown>;
  mimeType?: string;
  fileName?: string;
  size?: number;
  hash?: string;
  sourceUrl?: string;
  ossFileId?: string;
  webLink?: string;
  width?: number;
  height?: number;
  duration?: number;
  format?: ModelAssetFormat;
  createdAt: number;
  updatedAt: number;
};

export type BoardSnapshot = {
  nodes: BoardNode[];
  assets: Asset[];
  viewport?: BoardViewportSnapshot | null;
};

export type BoardViewportSnapshot = {
  scale: number;
  offset: {
    x: number;
    y: number;
  };
};

export type ProjectInfo = {
  name: string;
  rootPath: string;
  boardPath: string;
  assetsPath: string;
};

export type AssetMetadataUpdate = {
  width?: number;
  height?: number;
  duration?: number;
  format?: ModelAssetFormat;
  metadata?: Record<string, unknown>;
};

export type BoardNodeUpdateInput = {
  id: string;
  name?: string;
  options?: Record<string, unknown>;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  locked?: boolean;
};
