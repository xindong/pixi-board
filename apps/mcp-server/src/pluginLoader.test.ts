import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { loadBoardPlugins, readOrCreateConfig } from "./pluginLoader";

const execFileAsync = promisify(execFile);

test("readOrCreateConfig creates a local plugin manager config when missing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "board-plugin-config-"));
  const configPath = path.join(dir, "plugins.json");

  const config = await readOrCreateConfig(configPath);
  const text = await readFile(configPath, "utf8");

  assert.match(config.pluginRoot, /\.pixi-board\/plugins$/);
  assert.deepEqual(config.pluginOrder, []);
  assert.deepEqual(config.envByPlugin, {});
  assert.deepEqual(JSON.parse(text), config);
});

test("loadBoardPlugins scans plugin zip packages from pluginRoot", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "board-plugin-root-"));
  const configPath = path.join(dir, "plugins.json");
  const pluginRoot = path.join(dir, "plugins");
  await writePluginZip(pluginRoot, "local-plugin.zip", "@test/local");
  await writeFile(configPath, JSON.stringify({ pluginRoot, envByPlugin: {} }), "utf8");

  const result = await loadBoardPlugins({ configPath });

  assert.equal(result.pluginRoot, pluginRoot);
  assert.deepEqual(result.errors, []);
  assert.equal(result.plugins[0]?.name, "@test/local");
});

test("loadBoardPlugins applies plugin env entries by plugin name", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "board-plugin-env-"));
  const configPath = path.join(dir, "plugins.json");
  const pluginRoot = path.join(dir, "plugins");
  const previous = process.env.EXAMPLE_API_KEY;
  delete process.env.EXAMPLE_API_KEY;
  await writePluginZip(pluginRoot, "pixi-board-plugin-example.zip", "pixi-board-plugin-example");
  await writeFile(
    configPath,
    JSON.stringify({
      pluginRoot,
      envByPlugin: {
        "pixi-board-plugin-example": {
          EXAMPLE_API_KEY: "example_test_key",
        },
      },
    }),
    "utf8",
  );

  try {
    const result = await loadBoardPlugins({ configPath });

    assert.deepEqual(result.errors, []);
    assert.equal(process.env.EXAMPLE_API_KEY, "example_test_key");
  } finally {
    if (previous === undefined) {
      delete process.env.EXAMPLE_API_KEY;
    } else {
      process.env.EXAMPLE_API_KEY = previous;
    }
  }
});

test("loadBoardPlugins honors pluginOrder from config", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "board-plugin-order-"));
  const configPath = path.join(dir, "plugins.json");
  const pluginRoot = path.join(dir, "plugins");
  await writePluginZip(pluginRoot, "plugin-a.zip", "plugin-a");
  await writePluginZip(pluginRoot, "plugin-b.zip", "plugin-b");
  await writeFile(
    configPath,
    JSON.stringify({
      pluginRoot,
      pluginOrder: ["plugin-b.zip", "plugin-a.zip"],
      envByPlugin: {},
    }),
    "utf8",
  );

  const result = await loadBoardPlugins({ configPath });

  assert.deepEqual(result.plugins.map((plugin) => plugin.name), ["plugin-b", "plugin-a"]);
});

test("loadBoardPlugins returns an error for zip packages without plugin exports", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "board-plugin-bad-"));
  const configPath = path.join(dir, "plugins.json");
  const pluginRoot = path.join(dir, "plugins");
  const packageRoot = path.join(pluginRoot, "bad-plugin");
  await mkdir(packageRoot, { recursive: true });
  await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ type: "module", main: "index.mjs" }), "utf8");
  await writeFile(path.join(packageRoot, "index.mjs"), "export const value = 1;\n", "utf8");
  await execFileAsync("zip", ["-qr", "bad-plugin.zip", "bad-plugin"], { cwd: pluginRoot });
  await writeFile(configPath, JSON.stringify({ pluginRoot, envByPlugin: {} }), "utf8");

  const result = await loadBoardPlugins({ configPath });

  assert.equal(result.plugins.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0]?.message ?? "", /does not export a BoardPlugin/);
});

async function writePluginZip(pluginRoot: string, zipName: string, name: string): Promise<void> {
  const packageName = zipName.replace(/\.zip$/i, "");
  const packageRoot = path.join(pluginRoot, packageName);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({ type: "module", exports: { ".": { import: "./index.mjs" } } }),
    "utf8",
  );
  await writeFile(path.join(packageRoot, "index.mjs"), localPluginSource(name), "utf8");
  await execFileAsync("zip", ["-qr", zipName, packageName], { cwd: pluginRoot });
}

function localPluginSource(name: string): string {
  return `
    export const plugin = {
      name: ${JSON.stringify(name)},
      version: "0.1.0",
      register(api) {
        api.registerTool({
          name: ${JSON.stringify(`${name}.echo`)},
          description: "Echo",
          inputSchema: { type: "object", additionalProperties: false, properties: {} },
          outputSchema: { type: "object", additionalProperties: false, properties: {} },
          async run() { return { ok: true }; }
        });
      }
    };
  `;
}
