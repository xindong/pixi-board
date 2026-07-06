import type {
  Asset,
  AssetKind,
  AssetMetadataUpdate,
  BoardNode,
} from "@pixi-board/board-domain";

export type BoardCreateNodeInput = {
  path?: string;
  kind?: AssetKind;
  width?: number;
  height?: number;
  options?: Record<string, unknown>;
  name?: string;
};

export type BoardUpdateAssetInput = AssetMetadataUpdate & {
  id: string;
};

export type BoardWriteResult = {
  nodes: BoardNode[];
  assets?: Asset[];
};
