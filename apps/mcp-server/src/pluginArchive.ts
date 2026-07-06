import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function extractPluginArchive(
  archivePath: string,
  archiveCacheRoot: string,
): Promise<string> {
  const archiveStat = await stat(archivePath);
  const cacheKey = createHash("sha256")
    .update(`${archivePath}:${archiveStat.size}:${archiveStat.mtimeMs}`)
    .digest("hex")
    .slice(0, 16);
  const extractRoot = path.join(archiveCacheRoot, cacheKey);
  const markerPath = path.join(extractRoot, ".pixi-board-plugin-extracted");

  if (!(await pathExists(markerPath))) {
    await rm(extractRoot, { force: true, recursive: true });
    await mkdir(extractRoot, { recursive: true });
    await execFileAsync("unzip", ["-oq", archivePath, "-d", extractRoot], {
      maxBuffer: 10 * 1024 * 1024,
    });
    await writeFile(markerPath, `${archivePath}\n`, "utf8");
  }

  return findPackageRoot(extractRoot);
}

async function findPackageRoot(root: string): Promise<string> {
  if (await pathExists(path.join(root, "package.json"))) {
    return root;
  }

  const entries = await readdir(root, { withFileTypes: true });
  const childPackageRoots: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const childRoot = path.join(root, entry.name);
    if (await pathExists(path.join(childRoot, "package.json"))) {
      childPackageRoots.push(childRoot);
    }
  }

  if (childPackageRoots.length === 1) {
    return childPackageRoots[0] as string;
  }

  throw new Error("Plugin archive must contain one package.json at its root or first directory level");
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
