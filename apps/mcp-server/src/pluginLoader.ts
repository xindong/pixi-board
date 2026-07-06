import os from "node:os";
import path from "node:path";
import type { BoardPlugin } from "@pixi-board/board-plugin-sdk";
import { defaultConfigPath, readOrCreateConfig } from "./pluginConfig";
import {
  discoverPluginSources,
  sortPluginSources,
} from "./pluginDiscovery";
import { errorMessage, type PluginLoadError } from "./pluginErrors";
import { importBoardPlugin } from "./pluginPackageEntry";

export { readOrCreateConfig, type BoardPluginConfig } from "./pluginConfig";
export type { PluginLoadError } from "./pluginErrors";

export type LoadBoardPluginsResult = {
  plugins: BoardPlugin[];
  errors: PluginLoadError[];
  configPath: string;
  pluginRoot: string;
};

type LoadOptions = {
  configPath?: string;
  pluginRoot?: string;
  archiveCacheRoot?: string;
  env?: NodeJS.ProcessEnv;
};

export async function loadBoardPlugins(options: LoadOptions = {}): Promise<LoadBoardPluginsResult> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? env.BOARD_PLUGINS_CONFIG ?? defaultConfigPath();
  const config = await readOrCreateConfig(configPath);
  const pluginRoot = options.pluginRoot ?? env.BOARD_PLUGIN_ROOT ?? config.pluginRoot;
  const archiveCacheRoot = options.archiveCacheRoot ?? defaultArchiveCacheRoot();
  const plugins: BoardPlugin[] = [];
  const errors: PluginLoadError[] = [];

  const sources = sortPluginSources(
    await discoverPluginSources(pluginRoot, archiveCacheRoot, errors),
    config.pluginOrder ?? [],
  );
  for (const source of sources) {
    try {
      const plugin = await importBoardPlugin(source.packageRoot, source.label);
      applyPluginEnv(config.envByPlugin?.[plugin.name]);
      plugins.push(plugin);
    } catch (error) {
      errors.push({
        source: source.label,
        message: errorMessage(error),
      });
    }
  }

  return { plugins, errors, configPath, pluginRoot };
}

function applyPluginEnv(env: Record<string, string> | undefined): void {
  if (!env) return;
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function defaultArchiveCacheRoot(): string {
  return path.join(os.homedir(), ".pixi-board", "mcp", "plugin-archives");
}
