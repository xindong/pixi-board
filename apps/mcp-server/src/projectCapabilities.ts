import type { HostCapabilities } from "./capabilityTypes";
import { toNodeDto, toSnapshotDto } from "./dto";
import { filterNodes } from "./filter";
import { listKnownProjects, resolveProjectRoot } from "./projects";
import { getNodeOrThrow, loadProject } from "./reader";

export function createProjectCapabilities(): HostCapabilities["project"] {
  return {
    resolve(projectRoot) {
      return resolveProjectRoot(projectRoot);
    },
    async listKnown() {
      return listKnownProjects();
    },
    async readInfo(projectRoot) {
      const project = await loadProject(projectRoot);
      return {
        projectRoot: project.root,
        boardPath: project.boardPath,
        assetsPath: project.assetsPath,
        nodeCount: project.snapshot.nodes.length,
        assetCount: project.snapshot.assets.length,
        viewport: project.snapshot.viewport ?? null,
        updatedAt: Math.max(project.boardUpdatedAt ?? 0, project.assetsUpdatedAt ?? 0),
        boardUpdatedAt: project.boardUpdatedAt,
        assetsUpdatedAt: project.assetsUpdatedAt,
      };
    },
    async readSnapshot(projectRoot) {
      const project = await loadProject(projectRoot);
      return toSnapshotDto(project.root, project.snapshot);
    },
    async listNodes(projectRoot, filter) {
      const project = await loadProject(projectRoot);
      return filterNodes(project.snapshot.nodes, filter).map(toNodeDto);
    },
    async getNode(projectRoot, nodeId) {
      const project = await loadProject(projectRoot);
      return toNodeDto(getNodeOrThrow(project.snapshot, nodeId));
    },
  };
}
