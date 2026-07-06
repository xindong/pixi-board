#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const packageRootArg = process.argv[2];
if (!packageRootArg) {
  throw new Error("Usage: node scripts/pack-board-plugin.mjs <package-root>");
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.resolve(process.cwd(), packageRootArg);
const sourcePackageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const packageName = sourcePackageJson.name;
if (typeof packageName !== "string" || !packageName.startsWith("pixi-board-plugin-")) {
  throw new Error(`Expected a board plugin package name, got ${String(packageName)}`);
}

const distEntry = path.join(packageRoot, "dist", "index.js");
await readFile(distEntry);

const outputRoot = path.join(repoRoot, "plugin-packages", "board");
const outputPath = path.join(outputRoot, `${packageName}.zip`);
const tempRoot = await mkdtemp(path.join(os.tmpdir(), `${packageName}-`));
const tempPackageRoot = path.join(tempRoot, packageName);

try {
  await mkdir(path.join(tempPackageRoot, "dist"), { recursive: true });
  await copyFile(path.join(packageRoot, "dist", "index.js"), path.join(tempPackageRoot, "dist", "index.js"));
  await copyOptionalFile(path.join(packageRoot, "dist", "index.d.ts"), path.join(tempPackageRoot, "dist", "index.d.ts"));
  await writeFile(
    path.join(tempPackageRoot, "package.json"),
    `${JSON.stringify(buildPackageManifest(sourcePackageJson), null, 2)}\n`,
    "utf8",
  );
  await mkdir(outputRoot, { recursive: true });
  await rm(outputPath, { force: true });
  await execFile("zip", ["-qr", outputPath, packageName], { cwd: tempRoot });
  console.log(outputPath);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function copyFile(source, destination) {
  const bytes = await readFile(source);
  await writeFile(destination, bytes);
}

async function copyOptionalFile(source, destination) {
  try {
    await copyFile(source, destination);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

function buildPackageManifest(source) {
  const dependencies = filterPublishableDependencies(source.dependencies);
  return {
    name: source.name,
    version: source.version,
    private: false,
    type: "module",
    exports: {
      ".": {
        ...(source.exports?.["."]?.types ? { types: source.exports["."].types } : {}),
        import: "./dist/index.js",
      },
    },
    files: ["dist", "package.json"],
    ...(dependencies ? { dependencies } : {}),
    ...(source.pixiBoardPlugin ? { pixiBoardPlugin: source.pixiBoardPlugin } : {}),
  };
}

function filterPublishableDependencies(dependencies) {
  const entries = Object.entries(dependencies ?? {})
    .filter(([, version]) => typeof version === "string" && !version.startsWith("workspace:"));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function execFile(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function isMissing(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}
