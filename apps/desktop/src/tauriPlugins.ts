import { invoke } from "@tauri-apps/api/core";

export type BoardPluginManagerConfig = {
  configPath: string;
  pluginRoot: string;
  pluginOrder: string[];
  plugins: BoardPluginManagerPlugin[];
};

export type BoardPluginManagerPlugin = {
  id: string;
  name: string;
  version?: string;
  path: string;
  kind: "zip";
  environmentVariables: BoardPluginEnvironmentVariable[];
  env: Record<string, string>;
};

export type BoardPluginEnvironmentVariable = {
  name: string;
  description?: string;
  required: boolean;
  secret: boolean;
};

export type PluginManagerBridge = {
  loadPluginManagerConfig(): Promise<BoardPluginManagerConfig>;
  savePluginEnv(pluginName: string, env: Record<string, string>): Promise<BoardPluginManagerConfig>;
  refreshPluginsAndRestartMcp(pluginOrder: string[]): Promise<BoardPluginManagerConfig>;
  revealPluginFolder(): Promise<void>;
};

export async function loadPluginManagerConfig(): Promise<BoardPluginManagerConfig> {
  return invoke<BoardPluginManagerConfig>("load_plugin_manager_config");
}

export async function savePluginEnv(
  pluginName: string,
  env: Record<string, string>,
): Promise<BoardPluginManagerConfig> {
  return invoke<BoardPluginManagerConfig>("save_plugin_env", { pluginName, env });
}

export async function refreshPluginsAndRestartMcp(
  pluginOrder: string[],
): Promise<BoardPluginManagerConfig> {
  return invoke<BoardPluginManagerConfig>("refresh_plugins_and_restart_mcp", { pluginOrder });
}

export async function revealPluginFolder(): Promise<void> {
  await invoke("reveal_plugin_folder");
}
