import type { ProjectInfo } from "@pixi-board/board-domain";
import path from "node:path";
import { resolveAppRoot, type ProjectOptions } from "./appRoot";
import { isBridgeAvailable } from "./bridgeAvailability";
import { toProjectInfo } from "./dto";
import { McpUserError } from "./errors";
import { readKnownProjectRoots, readLastProject, realpathForProject } from "./projectFiles";

const ACTIVE_PROJECT = "active";

export type KnownProject = ProjectInfo & {
  bridgeAvailable: boolean;
};

export async function resolveProjectRoot(projectRoot: unknown, options?: ProjectOptions): Promise<string> {
  if (typeof projectRoot !== "string" || projectRoot.trim() === "") {
    throw new McpUserError('projectRoot must be a non-empty string or "active"');
  }

  if (projectRoot.trim() === ACTIVE_PROJECT) {
    return resolveActiveProjectRoot(options);
  }

  return realpathForProject(projectRoot);
}

export async function listKnownProjects(options?: ProjectOptions): Promise<KnownProject[]> {
  const appRoot = resolveAppRoot(options);
  const roots = await readKnownProjectRoots(appRoot);
  roots.sort((left, right) => projectDisplayName(left).localeCompare(projectDisplayName(right), undefined, {
    sensitivity: "accent",
  }));

  const bridgeAvailability = await Promise.all(
    roots.map(async (root) => ({
      root,
      bridgeAvailable: await isBridgeAvailable(root),
    })),
  );

  return bridgeAvailability.map(({ root, bridgeAvailable }) => ({
    ...toProjectInfo(root),
    bridgeAvailable,
  }));
}

export async function resolveActiveProjectRoot(options?: ProjectOptions): Promise<string> {
  const appRoot = resolveAppRoot(options);
  const root = await readLastProject(appRoot);
  if (!root) {
    throw new McpUserError("No active canvas project. Open a project in the desktop app first.");
  }
  return root;
}

function projectDisplayName(projectRoot: string): string {
  return path.basename(projectRoot).toLowerCase();
}
