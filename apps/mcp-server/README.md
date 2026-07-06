# Pixi Board MCP

`@pixi-board/mcp` is the stdio MCP server for Pixi Board. It exposes board tool discovery and invocation so local agent CLIs can use board capabilities registered by local plugin packages.

## Usage

Run the server with `npx`:

```sh
npx -y @pixi-board/mcp@latest
```

Codex configuration:

```toml
[mcp_servers.canvas]
command = "npx"
args = ["-y", "@pixi-board/mcp@latest"]
```

Claude Code and opencode can use the same stdio command:

```sh
npx -y @pixi-board/mcp@latest
```

## Board Tools

The MCP server exposes two fixed MCP tools:

- `list_board_tools`
- `call_board_tool`

Call `list_board_tools` to discover concrete capabilities, then call one with:

```json
{
  "name": "canvas.list_nodes",
  "input": {
    "projectRoot": "active"
  }
}
```

## Plugins

Board capabilities are loaded from local plugin zip files. The default config path is:

```text
~/.pixi-board/mcp/plugins.json
```

Override it with `BOARD_PLUGINS_CONFIG=/absolute/path/plugins.json`.

If the file does not exist, the MCP server creates:

```json
{
  "pluginRoot": "/Users/you/.pixi-board/plugins",
  "pluginOrder": [],
  "envByPlugin": {}
}
```

Put plugin zip files in `pluginRoot` to enable tools. Official plugin sources live in `packages/board-plugin-*`; generated zip artifacts are installed into this directory and should not become a second source tree.

```text
~/.pixi-board/plugins/
  pixi-board-plugin-canvas.zip
  pixi-board-plugin-example.zip
```

Each plugin zip should contain one package at its root or first directory level. The package should export a `BoardPlugin` as `plugin` or default. The loader resolves the entry from `package.json` using `exports.import`, `exports.default`, `module`, `main`, then `dist/index.js`.

Plugin environment variables live under the plugin name:

```json
{
  "pluginRoot": "/Users/you/.pixi-board/plugins",
  "pluginOrder": [
    "pixi-board-plugin-canvas.zip",
    "pixi-board-plugin-example.zip"
  ],
  "envByPlugin": {
    "pixi-board-plugin-example": {
      "EXAMPLE_API_KEY": "..."
    }
  }
}
```

The desktop plugin manager can reorder `pluginOrder` by drag and drop. The MCP server lazy-loads local plugins on the first board tool request in a process, then reuses that runtime for later calls. Refresh or restart the MCP process after changing plugin zips, plugin order, or plugin environment variables. New plugin acquisition can be implemented independently; `@pixi-board/mcp` only cares about the local plugin root.

## Project Roots

Canvas tools accept a `projectRoot` argument. Use `"active"` for the current Pixi Board project, or pass an absolute path to a Pixi Board project directory.

Read tools can load project files directly. Write tools such as `canvas.create_nodes`, `canvas.update_nodes`, and `canvas.update_assets` require the Pixi Board desktop app to be running with the target project open.

`canvas.create_nodes` creates nodes from local source files, except `kind: "generating"` which creates a lightweight placeholder without a path. For text, Markdown, or HTML nodes, write the content to a `.txt`, `.md`, or `.html` file first and pass that file path. Do not pass `x` or `y`; the desktop canvas chooses placement and returns the created node coordinates.

## Writing Plugins

See `docs/plugin-development.md` in the repository root for a walkthrough of building, packaging, and installing your own board plugin.
