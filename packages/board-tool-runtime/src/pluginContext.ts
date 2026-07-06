import type {
  BoardPlugin,
  BoardToolContext,
  PluginPermission,
  ToolCapability,
} from "@pixi-board/board-plugin-sdk";
import { permissionGate, permissionGateMethod } from "./capabilityGate";
import { createPluginEnv } from "./pluginEnv";
import type { BoardHostCapabilities } from "./runtimeTypes";

export type CreatePluginContextInput = {
  plugin: BoardPlugin;
  capabilities?: BoardHostCapabilities;
  env: Record<string, string | undefined>;
  signal?: AbortSignal;
  callTool: ToolCapability["call"];
};

export function createPluginContext(input: CreatePluginContextInput): BoardToolContext {
  const { plugin, capabilities, env, signal, callTool } = input;
  const permissions = new Set<PluginPermission>(plugin.permissions ?? []);
  return {
    project: permissionGate(capabilities?.project, "project:read", permissions, "project"),
    board: {
      createNodes: permissionGateMethod(capabilities?.board, "createNodes", "board:write", permissions, "board"),
      updateNodes: permissionGateMethod(capabilities?.board, "updateNodes", "board:write", permissions, "board"),
      updateAssets: permissionGateMethod(capabilities?.board, "updateAssets", "board:write", permissions, "board"),
      refreshNodePreview: permissionGateMethod(
        capabilities?.board,
        "refreshNodePreview",
        "board:write",
        permissions,
        "board",
      ),
      installGeneratingNode: permissionGateMethod(
        capabilities?.board,
        "installGeneratingNode",
        "board:write",
        permissions,
        "board",
      ),
    },
    assets: {
      get: permissionGateMethod(capabilities?.assets, "get", "assets:read", permissions, "assets"),
      getOriginByNode: permissionGateMethod(
        capabilities?.assets,
        "getOriginByNode",
        "assets:read",
        permissions,
        "assets",
      ),
      importLocalFile: permissionGateMethod(
        capabilities?.assets,
        "importLocalFile",
        "assets:write",
        permissions,
        "assets",
      ),
      materializeArtifact: permissionGateMethod(
        capabilities?.assets,
        "materializeArtifact",
        "assets:write",
        permissions,
        "assets",
      ),
    },
    selection: permissionGate(capabilities?.selection, "selection:read", permissions, "selection"),
    viewport: permissionGate(capabilities?.viewport, "viewport:read", permissions, "viewport"),
    jobs: permissionGate(capabilities?.jobs, "jobs:write", permissions, "jobs"),
    storage: {
      get: permissionGateMethod(capabilities?.storage, "get", "storage:read", permissions, "storage"),
      set: permissionGateMethod(capabilities?.storage, "set", "storage:write", permissions, "storage"),
      delete: permissionGateMethod(capabilities?.storage, "delete", "storage:write", permissions, "storage"),
    },
    tools: {
      call: callTool,
    },
    env: createPluginEnv(plugin.name, env),
    signal,
  };
}
