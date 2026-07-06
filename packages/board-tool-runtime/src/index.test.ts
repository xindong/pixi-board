import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBoardToolRuntime } from "./index";
import type { BoardPlugin } from "@pixi-board/board-plugin-sdk";

const emptySchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

describe("BoardToolRegistry", () => {
  it("lists tools from registered plugins", async () => {
    const runtime = createBoardToolRuntime();
    await runtime.registerPlugin(pluginWithTool("one.echo"));

    assert.equal(runtime.listTools()[0]?.name, "one.echo");
  });

  it("rejects duplicate tool names", async () => {
    const runtime = createBoardToolRuntime();
    await runtime.registerPlugin(pluginWithTool("one.echo"));

    await assert.rejects(
      () => runtime.registerPlugin(pluginWithTool("one.echo", "@test/other")),
      /Tool already registered/,
    );
  });

  it("rejects missing tool dependencies", async () => {
    const runtime = createBoardToolRuntime();
    await assert.rejects(
      () =>
        runtime.registerPlugin({
          ...pluginWithTool("one.echo"),
          dependencies: { tools: ["missing.tool"] },
        }),
      /requires missing tool/,
    );
  });

  it("allows tools to call other tools through context", async () => {
    const runtime = createBoardToolRuntime();
    await runtime.registerPlugin(pluginWithTool("one.echo"));
    await runtime.registerPlugin({
      name: "@test/workflow",
      version: "0.1.0",
      dependencies: { tools: ["one.echo"] },
      register(api) {
        api.registerTool({
          name: "workflow.echo",
          description: "Call another tool",
          inputSchema: emptySchema,
          outputSchema: emptySchema,
          async run(_, ctx) {
            return ctx.tools.call("one.echo", {});
          },
        });
      },
    });

    assert.deepEqual(await runtime.callTool("workflow.echo", {}), { ok: true });
  });

  it("rejects undeclared cross-plugin tool calls", async () => {
    const runtime = createBoardToolRuntime();
    await runtime.registerPlugin(pluginWithTool("one.echo", "@test/one"));
    await runtime.registerPlugin({
      name: "@test/workflow",
      version: "0.1.0",
      register(api) {
        api.registerTool({
          name: "workflow.echo",
          description: "Call another tool without dependency",
          inputSchema: emptySchema,
          outputSchema: emptySchema,
          async run(_, ctx) {
            return ctx.tools.call("one.echo", {});
          },
        });
      },
    });

    await assert.rejects(
      () => runtime.callTool("workflow.echo", {}),
      /must declare dependency/,
    );
  });

  it("rejects circular tool calls", async () => {
    const runtime = createBoardToolRuntime();
    await runtime.registerPlugin({
      name: "@test/circle",
      version: "0.1.0",
      register(api) {
        api.registerTool({
          name: "circle.a",
          description: "A",
          inputSchema: emptySchema,
          outputSchema: emptySchema,
          async run(_, ctx) {
            return ctx.tools.call("circle.b", {});
          },
        });
        api.registerTool({
          name: "circle.b",
          description: "B",
          inputSchema: emptySchema,
          outputSchema: emptySchema,
          async run(_, ctx) {
            return ctx.tools.call("circle.a", {});
          },
        });
      },
    });

    await assert.rejects(
      () => runtime.callTool("circle.a", {}),
      /Circular board tool call detected/,
    );
  });

  it("gates host capabilities by plugin permissions", async () => {
    const runtime = createBoardToolRuntime({
      capabilities: {
        project: {
          async resolve(projectRoot) {
            return projectRoot;
          },
          async listKnown() {
            return [];
          },
          async readInfo(projectRoot) {
            return { projectRoot };
          },
          async readSnapshot(projectRoot) {
            return { projectRoot };
          },
          async listNodes() {
            return [];
          },
          async getNode() {
            return {};
          },
        },
      },
    });
    await runtime.registerPlugin({
      name: "@test/no-permission",
      version: "0.1.0",
      register(api) {
        api.registerTool({
          name: "project.info",
          description: "Read project info",
          inputSchema: emptySchema,
          outputSchema: emptySchema,
          async run(_, ctx) {
            return ctx.project.readInfo("/tmp/project");
          },
        });
      },
    });

    await assert.rejects(
      () => runtime.callTool("project.info", {}),
      /Plugin permission required: project:read/,
    );
  });
});

function pluginWithTool(name: string, pluginName = "@test/plugin"): BoardPlugin {
  return {
    name: pluginName,
    version: "0.1.0",
    register(api) {
      api.registerTool({
        name,
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
