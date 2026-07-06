import type {
  McpCreateNodeInput,
  McpUpdateAssetInput,
  McpUpdateNodeInput,
  McpWriteCommand,
} from "@pixi-board/mcp-protocol";
import type { BoardWriteResultDto, HostCapabilities } from "./capabilityTypes";
import { toAssetDto, toNodeDto } from "./dto";
import { loadProject } from "./reader";
import { sendWriteCommand } from "./writerClient";

export function createBoardCapabilities(): HostCapabilities["board"] {
  return {
    async createNodes(projectRoot, nodes) {
      return sendBoardWrite({
        kind: "create_nodes",
        projectRoot,
        nodes: nodes as McpCreateNodeInput[],
      });
    },
    async updateNodes(projectRoot, updates) {
      return sendBoardWrite({
        kind: "update_nodes",
        projectRoot,
        updates: updates as McpUpdateNodeInput[],
      });
    },
    async updateAssets(projectRoot, assets) {
      return sendBoardWrite({
        kind: "update_assets",
        projectRoot,
        assets: assets as McpUpdateAssetInput[],
      });
    },
    async refreshNodePreview(projectRoot, nodeId) {
      return sendBoardWrite({
        kind: "refresh_node_preview",
        projectRoot,
        nodeId,
      });
    },
    async installGeneratingNode(projectRoot, nodeId, filePath) {
      return sendBoardWrite({
        kind: "generating_node_install",
        projectRoot,
        nodeId,
        path: filePath,
      });
    },
  };
}

export async function sendBoardWrite(command: McpWriteCommand): Promise<BoardWriteResultDto> {
  const result = await sendWriteCommand(command);
  const project = await loadProject(command.projectRoot);
  return {
    nodes: result.nodes.map(toNodeDto),
    assets: (result.assets ?? []).map((asset) => toAssetDto(project.root, asset)),
  };
}
