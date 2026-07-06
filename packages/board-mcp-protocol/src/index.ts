import type {
  Asset,
  AssetKind,
  AssetMetadataUpdate,
  BoardNode,
  BoardNodeUpdateInput,
} from "@pixi-board/board-domain";

export type McpCreateNodeInput = {
  path?: string;
  kind?: AssetKind;
  width?: number;
  height?: number;
  options?: Record<string, unknown>;
  name?: string;
};

export type McpUpdateNodeInput = BoardNodeUpdateInput;

export type McpUpdateAssetInput = AssetMetadataUpdate & {
  id: string;
};

export type McpCreateNodesCommand = {
  kind: "create_nodes";
  projectRoot: string;
  nodes: McpCreateNodeInput[];
};

export type McpUpdateNodesCommand = {
  kind: "update_nodes";
  projectRoot: string;
  updates: McpUpdateNodeInput[];
};

export type McpUpdateAssetsCommand = {
  kind: "update_assets";
  projectRoot: string;
  assets: McpUpdateAssetInput[];
};

export type McpRefreshNodePreviewCommand = {
  kind: "refresh_node_preview";
  projectRoot: string;
  nodeId: string;
};

export type McpGeneratingNodeInstallCommand = {
  kind: "generating_node_install";
  projectRoot: string;
  nodeId: string;
  path: string;
};

export type McpWriteCommand =
  | McpCreateNodesCommand
  | McpUpdateNodesCommand
  | McpUpdateAssetsCommand
  | McpRefreshNodePreviewCommand
  | McpGeneratingNodeInstallCommand;

export type McpWriteCommandResult = {
  nodes: BoardNode[];
  assets?: Asset[];
};
