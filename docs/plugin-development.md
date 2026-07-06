# Writing a Board Plugin

Board tools — the capabilities exposed through the MCP server's `list_board_tools` / `call_board_tool` and used by the desktop app — are provided by plugins. This guide walks through building, packaging, and installing one.

A plugin is an npm package that exports a `BoardPlugin` object (as the `plugin` named export or the default export). At load time the runtime calls `register(api)`, and each registered tool becomes callable by name.

## 1. Create the package

The simplest path is to develop inside a checkout of this repository so you can use the workspace SDK directly. Create a package under `packages/` (or keep out-of-tree plugins under `third-party/`, which the workspace does not scan):

```text
packages/pixi-board-plugin-hello/
  package.json
  tsup.config.ts
  src/index.ts
```

`package.json`:

```json
{
  "name": "pixi-board-plugin-hello",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "src", "package.json"],
  "scripts": {
    "build": "tsup",
    "pack:zip": "node ../../scripts/pack-board-plugin.mjs .",
    "prepack": "pnpm build"
  },
  "dependencies": {
    "@pixi-board/board-plugin-sdk": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.5.0",
    "typescript": "^5.9.3"
  }
}
```

The packaging script requires the package name to start with `pixi-board-plugin-`.

`tsup.config.ts`:

```ts
import { defineConfig } from "tsup";

// Plugin zips are extracted without node_modules, so workspace packages
// must be bundled into the plugin entry.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: true,
  noExternal: [/^@pixi-board\//],
});
```

Plugin zips must be self-contained: the runtime extracts them to a cache directory with no `node_modules`, so every workspace package your plugin imports has to be bundled into `dist/index.js`. That is what `noExternal` does above; keep it in sync with the packages you import.

## 2. Define the plugin and its tools

`src/index.ts`:

```ts
import { definePlugin, defineTool, schema } from "@pixi-board/board-plugin-sdk";

const listNodeNames = defineTool({
  name: "hello.list_node_names",
  description: "List the names of all nodes in a board project.",
  input: schema.object(
    { projectRoot: schema.string("Project root, or \"active\" for the current project.") },
    { required: ["projectRoot"] },
  ),
  output: schema.object({ names: schema.array(schema.string()) }),
  async run(input: { projectRoot: string }, ctx) {
    const nodes = await ctx.project.listNodes(input.projectRoot);
    const names = nodes.map((node) => (node as { name?: string }).name ?? "(unnamed)");
    return { names };
  },
});

export const plugin = definePlugin({
  name: "pixi-board-plugin-hello",
  version: "0.1.0",
  permissions: ["project:read"],
  tools: [listNodeNames],
});
```

Conventions:

- Namespace tool names with a plugin prefix (`hello.list_node_names`), the way the official plugin uses `canvas.*`.
- `input` / `output` are JSON Schemas; the `schema` helpers build strict object schemas (`additionalProperties: false`).
- Declare only the `permissions` you use: `project:read`, `board:read`, `board:write`, `assets:read`, `assets:write`, `selection:read`, `viewport:read`, `jobs:write`, `storage:read`, `storage:write`.

## 3. Use the plugin context

`run(input, ctx)` receives a `PluginContext` with the capabilities behind those permissions:

- `ctx.project` — resolve project roots, read board snapshots, list and get nodes.
- `ctx.board` — create/update nodes and assets, refresh previews, install results into generating nodes. Write operations require the desktop app to be running with the target project open.
- `ctx.assets` — read asset records, import local files, materialize artifacts to disk.
- `ctx.selection` / `ctx.viewport` — the current selection and viewport.
- `ctx.jobs` — create progress jobs the desktop UI can display (`create`, `updateProgress`, `complete`, `fail`).
- `ctx.storage` — plugin-scoped persistent key/value storage.
- `ctx.tools` — call other registered board tools by name.
- `ctx.env` — read plugin-scoped environment variables (`get` / `require`).
- `ctx.signal` — an `AbortSignal` for cancellation; pass it to long-running requests.

## 4. Environment variables

If your plugin needs configuration such as an API key, declare it so the desktop plugin manager can prompt for and store it:

```json
{
  "pixiBoardPlugin": {
    "environmentVariables": [
      { "name": "HELLO_API_KEY", "description": "API key for the Hello service.", "required": true, "secret": true }
    ]
  }
}
```

Values are stored per plugin under `envByPlugin` in `~/.pixi-board/mcp/plugins.json` and read at runtime through `ctx.env`.

## 5. Build, package, install

```sh
pnpm install
pnpm --filter pixi-board-plugin-hello build
pnpm --filter pixi-board-plugin-hello pack:zip
```

`pack:zip` writes `plugin-packages/board/pixi-board-plugin-hello.zip`. Copy it into the plugin root:

```sh
cp plugin-packages/board/pixi-board-plugin-hello.zip ~/.pixi-board/plugins/
```

Then refresh plugins in the desktop plugin manager, or restart the MCP process. Verify with `list_board_tools` — your `hello.list_node_names` tool should appear.

## Security note

Plugins are local code executed with your user's privileges; the permission list is a contract, not a sandbox. Only install plugin zips from sources you trust.
