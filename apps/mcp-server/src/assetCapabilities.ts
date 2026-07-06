import path from "node:path";
import type { HostCapabilities } from "./capabilityTypes";
import { sendBoardWrite } from "./boardCapabilities";
import { toAssetDto, toNodeDto } from "./dto";
import { McpUserError } from "./errors";
import { getAssetOrThrow, getNodeOrThrow, getOriginAssetForNode, loadProject } from "./reader";
import { resolveProjectRoot } from "./projects";

export function createAssetCapabilities(): HostCapabilities["assets"] {
  return {
    async get(projectRoot, assetId) {
      const project = await loadProject(projectRoot);
      return toAssetDto(project.root, getAssetOrThrow(project.snapshot, assetId));
    },
    async getOriginByNode(projectRoot, nodeId) {
      const project = await loadProject(projectRoot);
      const node = getNodeOrThrow(project.snapshot, nodeId);
      const asset = getOriginAssetForNode(project.snapshot, nodeId);
      return {
        node: toNodeDto(node),
        asset: {
          ...toAssetDto(project.root, asset),
          accessibleUrl: asset.webLink ?? asset.sourceUrl ?? null,
        },
      };
    },
    async importLocalFile(projectRoot, filePath) {
      const result = await sendBoardWrite({
        kind: "create_nodes",
        projectRoot,
        nodes: [{ path: filePath }],
      });
      return result.assets?.[0] ?? null;
    },
    async materializeArtifact(projectRoot, artifact) {
      if (typeof artifact === "string" && artifact.trim()) {
        return path.resolve(await resolveProjectRoot(projectRoot), artifact);
      }
      if (artifact && typeof artifact === "object" && !Array.isArray(artifact)) {
        const record = artifact as Record<string, unknown>;
        if (typeof record.path === "string" && record.path.trim()) {
          return path.resolve(await resolveProjectRoot(projectRoot), record.path);
        }
      }
      throw new McpUserError("assets.materializeArtifact requires a local path artifact");
    },
  };
}
