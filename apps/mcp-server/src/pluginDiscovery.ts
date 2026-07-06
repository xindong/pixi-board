import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { extractPluginArchive } from "./pluginArchive";
import { errorMessage, type PluginLoadError } from "./pluginErrors";

export type PluginSource = {
  label: string;
  packageRoot: string;
};

export async function discoverPluginSources(
  pluginRoot: string,
  archiveCacheRoot: string,
  errors: PluginLoadError[],
): Promise<PluginSource[]> {
  await mkdir(pluginRoot, { recursive: true });
  const entries = await readdir(pluginRoot, { withFileTypes: true });
  const sources: PluginSource[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith(".")) continue;
    const sourcePath = path.join(pluginRoot, entry.name);
    try {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".zip")) {
        sources.push({
          label: sourcePath,
          packageRoot: await extractPluginArchive(sourcePath, archiveCacheRoot),
        });
      }
    } catch (error) {
      errors.push({
        source: sourcePath,
        message: errorMessage(error),
      });
    }
  }

  return sources;
}

export function sortPluginSources(sources: PluginSource[], pluginOrder: string[]): PluginSource[] {
  const order = new Map(pluginOrder.map((id, index) => [id, index]));
  return [...sources].sort((left, right) => {
    const leftOrder = order.get(path.basename(left.label));
    const rightOrder = order.get(path.basename(right.label));
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return path.basename(left.label).localeCompare(path.basename(right.label));
  });
}
