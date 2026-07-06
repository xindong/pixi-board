# Contributing to Pixi Board

Thanks for your interest in contributing!

## Development setup

Prerequisites: Node.js >= 20, pnpm 10, and (for the desktop app) the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
pnpm install
pnpm test
pnpm build
```

Run the desktop app:

```sh
pnpm tauri dev
```

The board also boots in plain browser mode for frontend work without the Tauri runtime:

```sh
pnpm dev
```

Check the Rust side:

```sh
cd apps/desktop/src-tauri && cargo check
```

## Project layout

See the architecture notes in [README.md](README.md) and [docs/architecture.md](docs/architecture.md). The short version:

- `apps/desktop/` — the PixiJS 8 + Tauri 2 desktop application.
- `apps/mcp-server/` — the stdio MCP server (`@pixi-board/mcp`).
- `packages/board-domain/` — side-effect-free shared domain types and geometry.
- `packages/board-plugin-sdk/` — the SDK for building board plugins.
- `packages/board-plugin-canvas/` — the official plugin exposing core board tools.

## Making changes

- Keep changes focused; one concern per pull request.
- Add or update tests for behavior changes (`pnpm test` must pass).
- Match the boundaries described in the README — for example, PixiJS imports go through `apps/desktop/src/pixi.ts`, and Tauri access goes through the runtime adapter / `tauriBridge.ts`.
- For new board capabilities, prefer writing a plugin over extending the core (see [docs/plugin-development.md](docs/plugin-development.md)).

## Reporting issues

Please include your platform, reproduction steps, and whether you were running the desktop app, browser mode, or the MCP server.
