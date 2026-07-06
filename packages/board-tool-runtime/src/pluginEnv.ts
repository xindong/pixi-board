import type { PluginEnvironmentCapability } from "@pixi-board/board-plugin-sdk";
import { PluginUserError } from "@pixi-board/board-plugin-sdk";

export function createPluginEnv(
  pluginName: string,
  env: Record<string, string | undefined>,
): PluginEnvironmentCapability {
  return {
    get(name) {
      return env[name] ?? process.env[name];
    },
    require(name) {
      const value = env[name] ?? process.env[name];
      if (typeof value !== "string" || value.trim() === "") {
        throw new PluginUserError(`Environment variable ${name} is required for plugin ${pluginName}`);
      }
      return value;
    },
  };
}
