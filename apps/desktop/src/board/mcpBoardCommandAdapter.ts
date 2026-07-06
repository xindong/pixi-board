import type { McpWriteCommand, McpWriteCommandResult } from "@pixi-board/mcp-protocol";
import type { BoardWriteService } from "./boardWriteService";

type McpBoardCommandAdapterOptions = {
  writes: BoardWriteService;
};

export class McpBoardCommandAdapter {
  private readonly writes: BoardWriteService;

  constructor(options: McpBoardCommandAdapterOptions) {
    this.writes = options.writes;
  }

  handle(command: McpWriteCommand): Promise<McpWriteCommandResult> {
    switch (command.kind) {
      case "create_nodes":
        return this.writes.createNodes(command.nodes);
      case "update_nodes":
        return this.writes.updateNodes(command.updates);
      case "update_assets":
        return this.writes.updateAssets(command.assets);
      case "refresh_node_preview":
        return this.writes.refreshNodePreview(command.nodeId);
      case "generating_node_install":
        return this.writes.installGeneratingNode(command.nodeId, command.path);
    }
  }
}
