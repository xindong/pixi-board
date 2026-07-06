import type { BoardToolRuntimeOptions } from "@pixi-board/board-tool-runtime";
import type { McpAssetDto, McpNodeDto } from "./dto";

export type HostCapabilities = NonNullable<BoardToolRuntimeOptions["capabilities"]>;

export type BoardWriteResultDto = {
  nodes: McpNodeDto[];
  assets: McpAssetDto[];
};
