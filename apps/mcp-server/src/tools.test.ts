import assert from "node:assert/strict";
import test from "node:test";
import type { BoardPlugin } from "@pixi-board/board-plugin-sdk";
import { createToolHost } from "./tools";

const emptySchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

test("toolDefinitions only expose board discovery and invocation tools", () => {
  const host = createToolHost({
    pluginLoader: async () => ({ plugins: [], errors: [], configPath: "/tmp/plugins.json", pluginRoot: "/tmp/plugins" }),
  });

  assert.deepEqual(host.toolDefinitions.map((tool) => tool.name), [
    "list_board_tools",
    "call_board_tool",
  ]);
});

test("list_board_tools exposes dynamically loaded plugin tools", async () => {
  const host = createToolHost({
    pluginLoader: async () => ({
      plugins: [pluginWithTool("demo.echo")],
      errors: [],
      configPath: "/tmp/plugins.json",
      pluginRoot: "/tmp/plugins",
    }),
  });

  const result = await host.callTool("list_board_tools", {});
  const record = asRecord(result);
  const tools = readTools(result);

  assert.ok(tools.some((tool) => tool.name === "demo.echo"));
  assert.deepEqual(record.pluginErrors, []);
});

test("list_board_tools returns plugin loader errors without crashing", async () => {
  const host = createToolHost({
    pluginLoader: async () => ({
      plugins: [],
      errors: [{ source: "/tmp/plugins/missing-plugin", message: "Cannot find plugin package" }],
      configPath: "/tmp/plugins.json",
      pluginRoot: "/tmp/plugins",
    }),
  });

  const result = await host.callTool("list_board_tools", {});
  const record = asRecord(result);

  assert.deepEqual(record.pluginErrors, [
    { source: "/tmp/plugins/missing-plugin", message: "Cannot find plugin package" },
  ]);
});

test("registration errors are returned as pluginErrors", async () => {
  const host = createToolHost({
    pluginLoader: async () => ({
      plugins: [
        {
          ...pluginWithTool("workflow.needs_canvas", "@test/workflow"),
          dependencies: { tools: ["canvas.create_nodes"] },
        },
      ],
      errors: [],
      configPath: "/tmp/plugins.json",
      pluginRoot: "/tmp/plugins",
    }),
  });

  const result = await host.callTool("list_board_tools", {});
  const record = asRecord(result);
  const pluginErrors = record.pluginErrors as Array<{ source: string; message: string }>;

  assert.equal(pluginErrors.length, 1);
  assert.equal(pluginErrors[0]?.source, "@test/workflow");
  assert.match(pluginErrors[0]?.message ?? "", /requires missing tool/);
});

test("call_board_tool rejects unknown board tools", async () => {
  const host = createToolHost({
    pluginLoader: async () => ({ plugins: [], errors: [], configPath: "/tmp/plugins.json", pluginRoot: "/tmp/plugins" }),
  });

  await assert.rejects(
    () => host.callTool("call_board_tool", {
      name: "missing.tool",
      input: {},
    }),
    /Unknown board tool/,
  );
});

test("call_board_tool invokes dynamically loaded plugin tools", async () => {
  const host = createToolHost({
    pluginLoader: async () => ({
      plugins: [pluginWithTool("demo.echo")],
      errors: [],
      configPath: "/tmp/plugins.json",
      pluginRoot: "/tmp/plugins",
    }),
  });

  const result = await host.callTool("call_board_tool", {
    name: "demo.echo",
    input: {},
  });

  assert.deepEqual(result, { ok: true });
});

test("tool host reuses one loaded runtime across calls", async () => {
  let loadCount = 0;
  const host = createToolHost({
    pluginLoader: async () => {
      loadCount += 1;
      return {
        plugins: [pluginWithTool("demo.echo")],
        errors: [],
        configPath: "/tmp/plugins.json",
        pluginRoot: "/tmp/plugins",
      };
    },
  });

  await host.callTool("list_board_tools", {});
  await host.callTool("call_board_tool", {
    name: "demo.echo",
    input: {},
  });

  assert.equal(loadCount, 1);
});

function pluginWithTool(toolName: string, pluginName = "@test/plugin"): BoardPlugin {
  return {
    name: pluginName,
    version: "0.1.0",
    register(api) {
      api.registerTool({
        name: toolName,
        description: "Echo",
        inputSchema: emptySchema,
        outputSchema: emptySchema,
        async run() {
          return { ok: true };
        },
      });
    },
  };
}

function readTools(value: unknown): Array<{ name: string; inputSchema?: unknown }> {
  const record = asRecord(value);
  assert.ok(Array.isArray(record.tools));
  return record.tools as Array<{ name: string; inputSchema?: unknown }>;
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
