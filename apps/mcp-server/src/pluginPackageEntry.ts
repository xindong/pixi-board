import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { BoardPlugin } from "@pixi-board/board-plugin-sdk";

export async function importBoardPlugin(packageRoot: string, source: string): Promise<BoardPlugin> {
  const entryPath = await resolvePackageEntry(packageRoot);
  return readPluginExport(await import(pathToFileURL(entryPath).href), source);
}

async function resolvePackageEntry(packageRoot: string): Promise<string> {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    exports?: unknown;
    module?: unknown;
    main?: unknown;
  };
  const entry = readExportEntry(packageJson.exports) ?? stringValue(packageJson.module) ?? stringValue(packageJson.main) ?? "dist/index.js";
  return path.join(packageRoot, entry);
}

function readPluginExport(module: Record<string, unknown>, source: string): BoardPlugin {
  const plugin = module.plugin ?? module.default;
  if (!isBoardPlugin(plugin)) {
    throw new Error(`Plugin source ${source} does not export a BoardPlugin as "plugin" or default`);
  }
  return plugin;
}

function isBoardPlugin(value: unknown): value is BoardPlugin {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && typeof record.version === "string" && typeof record.register === "function";
}

function readExportEntry(exportsField: unknown): string | undefined {
  if (typeof exportsField === "string") return exportsField;
  if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) return undefined;
  const record = exportsField as Record<string, unknown>;
  const rootExport = record["."] ?? record;
  if (typeof rootExport === "string") return rootExport;
  if (!rootExport || typeof rootExport !== "object" || Array.isArray(rootExport)) return undefined;
  const rootRecord = rootExport as Record<string, unknown>;
  return stringValue(rootRecord.import) ?? stringValue(rootRecord.default);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
