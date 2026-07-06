# Pixi Board Performance Model

Pixi Board is optimized around large, media-heavy canvases where most document nodes are outside the viewport.

## Viewport Culling

`BoardScene` stores node bounds in RBush. Every viewport sync queries the visible world bounds plus padding, then asks `NodeViewRegistry` to retain only visible and selected nodes. Offscreen views are hidden immediately and disposed after a short delay if they stay offscreen.

## Texture Lifecycle

Assets render through lightweight derivatives when available. `BoardTextureCache` loads textures through Pixi assets, leases them to visible node views, and releases unmanaged textures after the final reference has been idle long enough. Async texture loads use per-view versions so stale loads cannot overwrite newer visual state.

## Frame Scheduling

`BoardFrameScheduler` batches high-frequency viewport and selection work into `requestAnimationFrame`. Repeated wheel, resize, or pointer events in the same frame trigger one scene sync instead of repeated culling and overlay redraws.

## Level Of Detail

`BoardLodPolicy` centralizes zoom-aware rendering decisions. The first policy keeps low-zoom interactions light by hiding labels and simplifying selection overlays. Future LOD work can add preview-quality selection, clustered placeholders, or tile-style rendering without changing the document model.

## Suggested Benchmarks

Use deterministic projects with 1k, 10k, and 50k nodes. For each size, record:

- pan and zoom responsiveness
- visible node view count
- texture lease count
- import completion behavior
- memory before and after offscreen disposal delay

The expected shape is that document size grows while active Pixi object count remains bounded by viewport density.
