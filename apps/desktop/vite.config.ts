import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/three/") || id.includes("GLTFLoader")) return "vendor-three";
          if (id.includes("/pixi.js/")) return "vendor-pixi";
          if (id.includes("/@tauri-apps/")) return "vendor-tauri";
          if (id.includes("/rbush/")) return "vendor-spatial";
          return undefined;
        },
      },
    },
  },
  clearScreen: false,
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: 5173,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
