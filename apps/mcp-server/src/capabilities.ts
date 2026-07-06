import { createAssetCapabilities } from "./assetCapabilities";
import { createBoardCapabilities } from "./boardCapabilities";
import type { HostCapabilities } from "./capabilityTypes";
import { createProjectCapabilities } from "./projectCapabilities";
import { loadProject } from "./reader";
import { createInMemoryJobs, createInMemoryStorage } from "./runtimeCapabilities";

export function createMcpHostCapabilities(): HostCapabilities {
  return {
    project: createProjectCapabilities(),
    board: createBoardCapabilities(),
    assets: createAssetCapabilities(),
    selection: {
      async get() {
        return [];
      },
    },
    viewport: {
      async get(projectRoot) {
        if (!projectRoot) return null;
        const project = await loadProject(projectRoot);
        return project.snapshot.viewport ?? null;
      },
    },
    jobs: createInMemoryJobs(),
    storage: createInMemoryStorage(),
  };
}
