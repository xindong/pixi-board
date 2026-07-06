# Pixi Board

A lightweight local media board built with PixiJS 8 and Tauri 2.

## Architecture

- `apps/desktop/` is the PixiJS 8 + Tauri 2 desktop application.
- `packages/board-domain/` is the side-effect-free shared domain package for board types, geometry, asset-derivative selection, and node names.
- `apps/desktop/src/main.ts` owns DOM shell bootstrapping and runtime detection.
- `apps/desktop/src/whiteboardAppController.ts` owns top-level desktop UI wiring: toolbar, project switching, plugin management, runtime adapter startup, file drops, and MCP bridge attachment.
- `apps/desktop/src/desktopRuntimeAdapter.ts` is the browser/Tauri runtime boundary. It creates repositories and exposes optional desktop capabilities without making board logic import Tauri eagerly.
- `apps/desktop/src/whiteboard.ts` is the board composition root. It wires repository, asset pipeline, viewport, scene, interaction flow, persistence, imports, selection UI, and MCP write commands.
- `apps/desktop/src/assets/assetPipeline.ts` is the import-time asset-preparation orchestrator. It delegates preview derivative work to `assetPreviewPipeline.ts` and the shared `assetPreviewJobRunner.ts` so imports and manual preview refresh share the same asset-level path and resource budget.
- `apps/desktop/src/assets/textLikePreviewPreparationStage.ts`, `previewPreparationStage.ts`, and `audioWaveformPreparationStage.ts` own derivative generation for text-like, visual/model, and audio assets.
- `apps/desktop/src/assets/mediaPreview.ts` owns reusable browser-side preview helpers, while `apps/desktop/src/assets/assetPreparationQueue.ts` owns concurrency limits and inflight de-duplication.
- `apps/desktop/src/assets/assetSizing.ts` and `apps/desktop/src/assets/assetNodeFactory.ts` separate asset sizing and node placement from the preparation pipeline.
- `apps/desktop/src/assets/assetImportManager.ts` owns background asset import/preparation events; `whiteboard.ts` consumes those events as frame-batched canvas patches.
- `apps/desktop/src/storage/boardRepository.ts` is the frontend repository boundary, with implementations split into `tauriBoardRepository.ts` and `browserBoardRepository.ts`.
- `apps/desktop/src/pixi.ts` is the single frontend boundary for PixiJS imports, which keeps renderer-library coupling explicit and localizes future bundle-strategy changes.
- `apps/desktop/src/board/boardStore.ts` owns document state and selection state.
- `apps/desktop/src/board/boardEditor.ts`, `boardCommands.ts`, and `boardHistory.ts` own document mutations, undo/redo, and command-level boundaries.
- `apps/desktop/src/board/boardPreviewService.ts` owns board-level preview refresh side effects: resolving the node asset, forcing asset preview preparation, updating the store, resizing document previews when needed, and refreshing the visible node.
- `apps/desktop/src/board/boardMutationApplier.ts` is the mutation commit boundary that keeps store, scene patches, selection refresh, and persistence scheduling in sync.
- `apps/desktop/src/board/boardViewport.ts` owns zoom/pan math and screen-to-world transforms.
- `apps/desktop/src/board/boardScene.ts` owns Pixi application lifecycle, spatial index, virtualized node views, and overlay rendering.
- `apps/desktop/src/board/boardScenePatch.ts` defines incremental scene updates for added, removed, updated, and asset-changed nodes.
- `apps/desktop/src/board/boardInteractionController.ts` owns pointer, wheel, and keyboard input, and turns them into editor mutations.
- `apps/desktop/src/board/nodeView.ts` owns Pixi display objects for a single media node.
- `apps/desktop/src/board/textureCache.ts` owns asset texture loading, reference counting, delayed unload, and placeholders.
- `apps/desktop/src/runtime/runtimeEnvironment.ts` is the runtime detection boundary that keeps browser-mode startup free of eager Tauri imports.
- `apps/desktop/src/tauriBridge.ts` is the typed desktop-only boundary for Tauri commands.
- `apps/desktop/src-tauri/src/lib.rs` is the Tauri command layer.
- `apps/desktop/src-tauri/src/project_store.rs` is the higher-level project coordinator for board snapshots.
- `apps/desktop/src-tauri/src/asset_store/` owns asset-catalog reads/writes, imports, derivative persistence, and asset-path resolution.
- `apps/desktop/src-tauri/src/project_files.rs` owns project-local path safety and atomic file writes.

## Performance Model

The board treats the document as data and Pixi objects as a viewport cache. RBush finds nodes near the current viewport, only those nodes get `NodeView` instances, and offscreen views are hidden immediately. If they stay offscreen for a short delay, their view is destroyed and their texture reference is released so GPU memory can be reclaimed.

Images and videos now enter the board through an asset pipeline that generates lighter preview variants before the board scene uses them. Originals stay in the project store for later export or high-fidelity workflows, while the board stays on smaller textures during normal interaction.

Metadata hydration now has its own update path, so existing derivatives are not rewritten just to fill in missing dimensions or duration. That keeps the preparation stages closer to a true staged pipeline: generate derivatives only when missing, otherwise update catalog metadata in place.

Project persistence now writes schema-versioned board and asset catalog files, giving future migrations an explicit place to land instead of relying on ad hoc JSON shape changes.

The board also boots in plain browser mode now, which keeps Pixi scene verification and editor work decoupled from the Tauri runtime during day-to-day frontend development.

Desktop-only repository wiring and file-dialog logic now load lazily too, so browser mode stays focused on the Pixi/editor path instead of eagerly pulling in Tauri APIs.

Model poster generation loads Three.js lazily, keeping the normal board startup path focused on Pixi and only paying the model-preview cost when a model asset actually appears.

See `docs/architecture.md` and `docs/performance.md` for the renderer/cache invariants, scene sync model, and large-board validation checklist.

## Development

```sh
pnpm install
pnpm test
pnpm build
cd apps/desktop/src-tauri && cargo check
```

Run the desktop app with:

```sh
pnpm tauri dev
```

## MCP Server

Pixi Board provides a stdio MCP server as the npm package `@pixi-board/mcp`.

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

The MCP server exposes `list_board_tools` and `call_board_tool`. Use `list_board_tools` to discover registered board tools, then invoke them through `call_board_tool`.

Canvas board tools accept `projectRoot: "active"` for the current Pixi Board project, or an absolute project path. Read operations load project files directly. Write operations require the Pixi Board desktop app to be running with the target project open.

`canvas.create_nodes` always creates nodes from local source files. For text, Markdown, or HTML nodes, write the content to a `.txt`, `.md`, or `.html` file first, then pass that file path.

Board capabilities load from local plugin zip packages under `~/.pixi-board/plugins`. The official plugin sources live in `packages/board-plugin-*`; generated zip artifacts are installed into the plugin root, not maintained as source. The MCP config at `~/.pixi-board/mcp/plugins.json` points at that plugin root, stores plugin-scoped environment variables, and preserves the drag-and-drop plugin order from the desktop plugin manager. Add a plugin zip file to the plugin root, then refresh or restart the MCP process to reload it.

## Plugins

Board tools are provided by plugins. `packages/board-plugin-canvas` is the official plugin that exposes core board read/write tools, and `packages/board-plugin-sdk` is the SDK for building your own. See `docs/plugin-development.md` for a step-by-step guide to writing, packaging, and installing a plugin.

Plugins run as local code with the permissions they declare. Only install plugin zips from sources you trust.

## License

Apache-2.0. See `LICENSE`.
