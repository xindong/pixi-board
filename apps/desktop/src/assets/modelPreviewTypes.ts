import type { AssetMetadataUpdate, ModelAssetFormat } from "@pixi-board/board-domain";
import type { CanvasDerivativeExtension } from "./mediaPreview";

export type ModelPreviewResult = {
  extension: CanvasDerivativeExtension;
  bytes: number[];
  metadata: AssetMetadataUpdate;
};

export type ModelPreviewSource = {
  format: ModelAssetFormat;
  url: string;
  bytes?: Uint8Array;
};

export type ThreeNamespace = typeof import("three");
export type ThreeObject = InstanceType<ThreeNamespace["Object3D"]>;
export type ThreeBufferGeometry = import("three").BufferGeometry<import("three").NormalBufferAttributes>;
export type ThreePerspectiveCamera = InstanceType<ThreeNamespace["PerspectiveCamera"]>;
