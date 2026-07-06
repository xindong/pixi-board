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
