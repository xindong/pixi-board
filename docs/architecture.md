# Pixi Board Architecture

Pixi Board treats the board document as the source of truth and the Pixi scene as a cache of the current viewport. This keeps document mutation, renderer lifecycle, and desktop persistence separate enough to evolve independently.

## Core Invariants

- Runtime detection happens once at `main.ts`; `WhiteboardAppController` passes runtime capability flags down instead of lower-level board code probing globals.
- `desktopRuntimeAdapter.ts` is the browser/Tauri boundary for repository creation, file dialogs, drag/drop, and MCP bridge access.
- `BoardRepository` is the persistence and asset boundary. Board services depend on the interface, not on Tauri commands.
- Board data lives in `BoardStore`; document mutations enter through `BoardEditor` commands.
- Pixi display objects are viewport-owned cache entries, not durable document state.
- `BoardScene` owns the Pixi application, RBush spatial index, overlay drawing, and scene synchronization.
- `NodeViewRegistry` owns visible node views and delayed offscreen disposal.
- `BoardTextureCache` owns texture loading, lease counts, and delayed GPU-memory release.
- Persistence is coordinated by `BoardPersistenceController`, separate from input handling and rendering.
- MCP writes are adapted through `McpBoardCommandAdapter` so external automation still uses the same editor and scene paths.

## Sync Model

The scene has three synchronization modes:

- Load/reload: rebuild the full spatial index and recreate visible views.
- Data patch: apply a `BoardScenePatch` for added, removed, updated, or asset-changed nodes.
- Viewport frame: coalesce pan, zoom, resize, and selection refresh work through `BoardFrameScheduler`.

This keeps the common interaction path incremental while preserving a simple full-rebuild fallback for project load and resource reload.

## UI Controllers

`WhiteboardAppController` is the app shell coordinator. It wires project switching, toolbar actions, plugin management, runtime adapter startup, file drops, and the desktop MCP bridge.

`ProjectSessionController` owns the current project identity and project-list refresh flow. It asks the runtime adapter to create a repository when a project becomes active, then hands that repository to the whiteboard mount path.

`MediaWhiteboard` is the board composition root. It wires repository, asset pipeline, editor, scene, viewport, input, persistence, imports, MCP commands, and selection UI. Feature logic lives in focused controllers:

- `ImportWorkflow` handles placeholder nodes, background asset preparation, completion, failure, and save timing.
- `SelectionUiController` handles selection panel, context menu, media playback controls, and node-name editing.
- `BoardInteractionController` handles keyboard, pointer, wheel, and tool routing.

## Asset Pipeline

`AssetPreviewPipeline` is the shared asset-level preview path. It runs text-like previews, visual/model previews, and audio waveform stages with an optional preparation context such as `force`, priority, and node-sized preview bounds. The stages own derivative generation and write through `BoardRepository`; they do not know about nodes, selection state, or Pixi views.

`AssetPreviewJobRunner` is the shared scheduling boundary for preview generation. `MediaWhiteboard` creates one runner and injects it into import preparation and board-level refresh, so both flows share the same resource budget. The runner keeps preview generation single-concurrency by default, prioritizes user-triggered refresh over background import preparation, yields before each stage, and deduplicates queued jobs with the same asset and context.

`AssetPipeline` is the import-time orchestrator. It coordinates background preparation through `AssetPreparationQueue`, then delegates preview derivative work to `AssetPreviewPipeline`.

`BoardPreviewService` is the board-level refresh boundary used by UI and MCP writes. It resolves the selected node and asset, asks `AssetPreviewPipeline` for a forced refresh, updates the editor/store, adjusts document node height when a text or Markdown preview grows, and refreshes the visible node. User-triggered media preview refresh passes the node bounds into generation so image and video derivatives are not regenerated at a larger size than the current board view needs. Audio preview refresh updates the visible preview derivative without forcing waveform regeneration. `BoardWriteService` remains responsible for persistence after the board-level refresh returns. File import and generating-node install prepare assets through `AssetPipeline`; only node-level follow-up such as document preview height fitting goes through `BoardPreviewService`.

## Media Runtime

Video nodes keep rendering their lightweight preview derivative until playback is explicitly committed. `VideoRuntimePool` prepares original-video runtimes ahead of playback, reuses in-flight preparation for repeated clicks, limits concurrent video runtime creation, and evicts idle ready runtimes. `MediaRuntimeRegistry` remains the board-facing API for activation and teardown, while the pool owns video-specific resource pressure. Preview refresh never owns or replaces playback runtime state; active video textures are protected by the node texture binder runtime guard.
