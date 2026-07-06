import type {
  BoardPlugin,
  BoardPluginApi,
  BoardTool,
  BoardToolContext,
  BoardToolManifest,
  ToolCapability,
} from "@pixi-board/board-plugin-sdk";
import { createPluginContext } from "./pluginContext";
import { validateSchema } from "./schemaValidation";
import type { BoardToolRuntimeOptions } from "./runtimeTypes";

export type { BoardHostCapabilities, BoardToolRuntimeOptions } from "./runtimeTypes";

type RegisteredTool = {
  tool: BoardTool;
  plugin: BoardPlugin;
  pluginName: string;
  pluginVersion: string;
};

export class BoardToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly plugins = new Map<string, BoardPlugin>();
  private readonly capabilities: BoardToolRuntimeOptions["capabilities"];
  private readonly envByPlugin: Record<string, Record<string, string | undefined>>;
  private readonly signal?: AbortSignal;

  constructor(options: BoardToolRuntimeOptions = {}) {
    this.capabilities = options.capabilities ?? {};
    this.envByPlugin = options.envByPlugin ?? {};
    this.signal = options.signal;
  }

  async registerPlugin(plugin: BoardPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }

    for (const dependency of plugin.dependencies?.plugins ?? []) {
      if (!this.plugins.has(dependency)) {
        throw new Error(`Plugin ${plugin.name} requires missing plugin: ${dependency}`);
      }
    }
    for (const dependency of plugin.dependencies?.tools ?? []) {
      if (!this.tools.has(dependency)) {
        throw new Error(`Plugin ${plugin.name} requires missing tool: ${dependency}`);
      }
    }

    const staged: BoardTool[] = [];
    const api: BoardPluginApi = {
      registerTool: (tool) => {
        if (this.tools.has(tool.name) || staged.some((entry) => entry.name === tool.name)) {
          throw new Error(`Tool already registered: ${tool.name}`);
        }
        staged.push(tool);
      },
    };

    await plugin.register(api);
    for (const tool of staged) {
      this.tools.set(tool.name, {
        tool,
        plugin,
        pluginName: plugin.name,
        pluginVersion: plugin.version,
      });
    }
    this.plugins.set(plugin.name, plugin);
    if (plugin.setup) {
      await plugin.setup(this.createContextForPlugin(plugin));
    }
  }

  listTools(): BoardToolManifest[] {
    return [...this.tools.values()].map(({ tool, pluginName, pluginVersion }) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      kind: tool.kind ?? "plugin",
      pluginName,
      pluginVersion,
    }));
  }

  async callTool(name: string, input: unknown): Promise<unknown> {
    return this.callToolWithStack(name, input, []);
  }

  private async callToolWithStack(name: string, input: unknown, callStack: string[]): Promise<unknown> {
    const registered = this.tools.get(name);
    if (!registered) {
      throw new Error(`Unknown board tool: ${name}`);
    }
    if (callStack.includes(name)) {
      throw new Error(`Circular board tool call detected: ${[...callStack, name].join(" -> ")}`);
    }
    validateSchema(registered.tool.inputSchema, input, "input");
    return registered.tool.run(input, this.createContextForTool(registered, [...callStack, name]));
  }

  async teardown(): Promise<void> {
    for (const plugin of [...this.plugins.values()].reverse()) {
      if (plugin.teardown) {
        await plugin.teardown(this.createContextForPlugin(plugin));
      }
    }
  }

  private createContextForTool(registered: RegisteredTool, callStack: string[]): BoardToolContext {
    return this.createContextForPlugin(registered.plugin, callStack);
  }

  private createContextForPlugin(plugin: BoardPlugin, callStack: string[] = []): BoardToolContext {
    const callTool: ToolCapability["call"] = async <I, O>(name: string, input: I): Promise<O> => {
      this.assertToolDependency(plugin, name);
      return this.callToolWithStack(name, input, callStack) as Promise<O>;
    };
    return createPluginContext({
      plugin,
      capabilities: this.capabilities,
      env: this.envByPlugin[plugin.name] ?? {},
      signal: this.signal,
      callTool,
    });
  }

  private assertToolDependency(plugin: BoardPlugin, toolName: string): void {
    const target = this.tools.get(toolName);
    if (!target) {
      throw new Error(`Unknown board tool: ${toolName}`);
    }
    if (target.pluginName === plugin.name) return;
    const dependencies = plugin.dependencies ?? {};
    if (dependencies.tools?.includes(toolName)) return;
    if (dependencies.plugins?.includes(target.pluginName)) return;
    throw new Error(`Plugin ${plugin.name} must declare dependency before calling tool: ${toolName}`);
  }
}

export function createBoardToolRuntime(options: BoardToolRuntimeOptions = {}): BoardToolRegistry {
  return new BoardToolRegistry(options);
}
