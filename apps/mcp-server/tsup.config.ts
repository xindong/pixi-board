import { defineConfig } from "tsup";

// The published npm package ships one self-contained bundle with no runtime
// dependencies, so workspace packages must be inlined here.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  noExternal: [/^@pixi-board\//],
});
