import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type BoardPluginConfig = {
  pluginRoot: string;
  pluginOrder?: string[];
  envByPlugin?: Record<string, Record<string, string>>;
};

export async function readOrCreateConfig(configPath: string): Promise<BoardPluginConfig> {
  try {
    const text = await readFile(configPath, "utf8");
    return parseConfig(JSON.parse(text), configPath);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const config: BoardPluginConfig = {
    pluginRoot: defaultPluginRoot(),
    pluginOrder: [],
    envByPlugin: {},
  };
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function defaultConfigPath(): string {
  return path.join(os.homedir(), ".pixi-board", "mcp", "plugins.json");
}

function parseConfig(value: unknown, configPath: string): BoardPluginConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid plugin config at ${configPath}: expected an object`);
  }
  const record = value as Record<string, unknown>;
  const pluginRoot = stringValue(record.pluginRoot);
  if (!pluginRoot) {
    throw new Error(`Invalid plugin config at ${configPath}: pluginRoot must be a non-empty string`);
  }
  if (!path.isAbsolute(pluginRoot)) {
    throw new Error(`Invalid plugin config at ${configPath}: pluginRoot must be an absolute path`);
  }
  const envByPlugin = parseEnvByPlugin(record.envByPlugin, configPath);
  const pluginOrder = parsePluginOrder(record.pluginOrder, configPath);
  return {
    pluginRoot,
    ...(pluginOrder ? { pluginOrder } : {}),
    ...(envByPlugin ? { envByPlugin } : {}),
  };
}

function parsePluginOrder(value: unknown, configPath: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Invalid plugin config at ${configPath}: pluginOrder must be an array`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`Invalid plugin config at ${configPath}: pluginOrder[${index}] must be a non-empty string`);
    }
    return entry.trim();
  });
}

function parseEnvByPlugin(value: unknown, configPath: string): Record<string, Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid plugin config at ${configPath}: envByPlugin must be an object`);
  }
  const result: Record<string, Record<string, string>> = {};
  for (const [pluginName, env] of Object.entries(value)) {
    if (!env || typeof env !== "object" || Array.isArray(env)) {
      throw new Error(`Invalid plugin config at ${configPath}: envByPlugin.${pluginName} must be an object`);
    }
    result[pluginName] = {};
    for (const [key, envValue] of Object.entries(env)) {
      if (typeof envValue !== "string") {
        throw new Error(`Invalid plugin config at ${configPath}: envByPlugin.${pluginName}.${key} must be a string`);
      }
      result[pluginName][key] = envValue;
    }
  }
  return result;
}

function defaultPluginRoot(): string {
  return path.join(os.homedir(), ".pixi-board", "plugins");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
