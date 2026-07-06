#!/usr/bin/env node
// Stage and publish @pixi-board/mcp. The published package is a single
// self-contained bundle, so workspace dependencies are stripped from the
// manifest instead of being rewritten to unpublished versions.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = path.join(repoRoot, "apps", "mcp-server");
const stagingRoot = path.join(packageRoot, "publish-staging");

const source = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
await readFile(path.join(packageRoot, "dist", "index.js"));

const manifest = {
  name: source.name,
  version: source.version,
  license: source.license,
  private: false,
  type: source.type,
  bin: source.bin,
  files: ["dist", "README.md", "package.json"],
  engines: source.engines,
};

await rm(stagingRoot, { force: true, recursive: true });
await mkdir(stagingRoot, { recursive: true });
await writeFile(path.join(stagingRoot, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
await cp(path.join(packageRoot, "dist"), path.join(stagingRoot, "dist"), { recursive: true });
await cp(path.join(packageRoot, "README.md"), path.join(stagingRoot, "README.md"));

const args = ["publish", "--access", "public", ...process.argv.slice(2)];
const child = spawn("npm", args, { cwd: stagingRoot, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
