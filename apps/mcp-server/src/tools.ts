import type { BoardToolManifest } from "@pixi-board/board-plugin-sdk";
import { createBoardToolRuntime, type BoardToolRegistry } from "@pixi-board/board-tool-runtime";
import { createMcpHostCapabilities } from "./capabilities";
import { loadBoardPlugins, type PluginLoadError } from "./pluginLoader";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

type ToolHost = {
  toolDefinitions: ToolDefinition[];
  callTool(name: string, input: unknown): Promise<unknown>;
};

type ToolHostOptions = {
  pluginLoader?: typeof loadBoardPlugins;
};

type RuntimeState = {
  runtime: BoardToolRegistry;
  pluginErrors: PluginLoadError[];
};

const fixedToolDefinitions: ToolDefinition[] = [
  {
    name: "list_board_tools",
    description: "List board tools currently registered by local plugins.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" },
        kind: {
          type: "string",
          enum: ["builtin", "plugin", "workflow"],
        },
      },
    },
  },
  {
    name: "call_board_tool",
    description: "Call one registered board tool by name with its input object.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "input"],
      properties: {
        name: { type: "string" },
        input: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
  },
];

let defaultHost: ToolHost | null = null;

export const toolDefinitions = fixedToolDefinitions;

export function callTool(name: string, input: unknown): Promise<unknown> {
  defaultHost ??= createToolHost();
  return defaultHost.callTool(name, input);
}

export function createToolHost(options: ToolHostOptions = {}): ToolHost {
  const pluginLoader = options.pluginLoader ?? loadBoardPlugins;
  let runtimeStatePromise: Promise<RuntimeState> | null = null;
  const getRuntimeState = () => {
    runtimeStatePromise ??= loadRuntime(pluginLoader);
    return runtimeStatePromise;
  };

  return {
    toolDefinitions: fixedToolDefinitions,
    async callTool(name, input) {
      switch (name) {
        case "list_board_tools": {
          const { runtime, pluginErrors } = await getRuntimeState();
          return listBoardTools(runtime, pluginErrors, input);
        }
        case "call_board_tool": {
          const { runtime } = await getRuntimeState();
          return callBoardTool(runtime, input);
        }
        default:
          throw new Error(`Unknown MCP tool: ${name}`);
      }
    },
  };
}

async function loadRuntime(
  pluginLoader: typeof loadBoardPlugins,
): Promise<RuntimeState> {
  const runtime = createBoardToolRuntime({
    capabilities: createMcpHostCapabilities(),
  });
  const pluginErrors: PluginLoadError[] = [];
  await registerPlugins(runtime, pluginErrors, pluginLoader);
  return { runtime, pluginErrors };
}

function listBoardTools(
  runtime: BoardToolRegistry,
  pluginErrors: PluginLoadError[],
  input: unknown,
): { tools: BoardToolManifest[]; pluginErrors: PluginLoadError[] } {
  const args = optionalRecord(input);
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
  const kind = typeof args.kind === "string" ? args.kind : "";
  const tools = runtime.listTools().filter((tool) => {
    if (kind && tool.kind !== kind) return false;
    if (!query) return true;
    return `${tool.name}\n${tool.description}\n${tool.pluginName}`.toLowerCase().includes(query);
  });
  return { tools, pluginErrors };
}

async function callBoardTool(runtime: BoardToolRegistry, input: unknown): Promise<unknown> {
  const args = asRecord(input);
  const name = args.name;
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("name must be a non-empty string");
  }
  return runtime.callTool(name, args.input ?? {});
}

function optionalRecord(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }
  return asRecord(input);
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object");
  }
  return input as Record<string, unknown>;
}

async function registerPlugins(
  runtime: BoardToolRegistry,
  pluginErrors: PluginLoadError[],
  pluginLoader: typeof loadBoardPlugins,
): Promise<void> {
  const result = await pluginLoader();
  pluginErrors.push(...result.errors);
  for (const plugin of result.plugins) {
    try {
      await runtime.registerPlugin(plugin);
    } catch (error) {
      pluginErrors.push({
        source: plugin.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
