import { promises as fs } from "node:fs";
import path from "node:path";
import { McpUserError } from "./errors";

const LAST_PROJECT_FILE = ".last-canvas";
const KNOWN_PROJECTS_FILE = ".known-canvas-projects.json";

export async function readKnownProjectRoots(appRoot: string): Promise<string[]> {
  const registryPath = path.join(appRoot, KNOWN_PROJECTS_FILE);
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(await fs.readFile(registryPath, "utf8"));
  } catch (error) {
    if (!isMissing(error)) {
      await writeKnownProjectRoots(registryPath, []);
    }
    return [];
  }

  if (!Array.isArray(parsed)) {
    await writeKnownProjectRoots(registryPath, []);
    return [];
  }

  const validRoots: string[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "string" || entry.trim() === "") continue;
    try {
      const root = await fs.realpath(entry);
      if (await isCanvasProject(root)) {
        validRoots.push(root);
      }
    } catch {
      // Ignore stale entries and lazily clean them below.
    }
  }

  const dedupedRoots = dedupeProjectRoots(validRoots);
  const rawRoots = parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  if (!sameProjectLists(rawRoots, dedupedRoots)) {
    await writeKnownProjectRoots(registryPath, dedupedRoots);
  }

  return dedupedRoots;
}

export async function readLastProject(appRoot: string): Promise<string | null> {
  const lastProjectPath = path.join(appRoot, LAST_PROJECT_FILE);
  let stored: string;
  try {
    stored = await fs.readFile(lastProjectPath, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }

  const candidate = stored.trim();
  if (!candidate) return null;
  try {
    const root = await fs.realpath(candidate);
    return (await isCanvasProject(root)) ? root : null;
  } catch {
    return null;
  }
}

export async function realpathForProject(projectRoot: string): Promise<string> {
  try {
    const root = await fs.realpath(projectRoot);
    const stat = await fs.stat(root);
    if (!stat.isDirectory()) {
      throw new McpUserError(`projectRoot is not a directory: ${projectRoot}`);
    }
    if (!(await isCanvasProject(root))) {
      throw new McpUserError(`invalid canvas project: ${projectRoot}`);
    }
    return root;
  } catch (error) {
    if (error instanceof McpUserError) throw error;
    throw new McpUserError(`Cannot access projectRoot ${projectRoot}: ${String(error)}`);
  }
}

async function writeKnownProjectRoots(registryPath: string, roots: string[]): Promise<void> {
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(`${registryPath}.tmp`, `${JSON.stringify(roots, null, 2)}\n`, "utf8");
  await fs.rename(`${registryPath}.tmp`, registryPath);
}

async function isCanvasProject(projectRoot: string): Promise<boolean> {
  try {
    const [board, assets] = await Promise.all([
      fs.stat(path.join(projectRoot, "board.json")),
      fs.stat(path.join(projectRoot, "assets.json")),
    ]);
    return board.isFile() && assets.isFile();
  } catch {
    return false;
  }
}

function dedupeProjectRoots(roots: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const root of roots) {
    const key = normalizeRootKey(root);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(root);
  }
  return deduped;
}

function sameProjectLists(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => normalizeRootKey(value) === normalizeRootKey(right[index]));
}

function normalizeRootKey(root: string): string {
  return process.platform === "win32" ? root.toLowerCase() : root;
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
