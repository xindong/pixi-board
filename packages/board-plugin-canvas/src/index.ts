import { definePlugin, type BoardTool } from "@pixi-board/board-plugin-sdk";
import { canvasAssetTools } from "./assetTools";
import { canvasReadTools } from "./readTools";
import { canvasWriteTools } from "./writeTools";

export const canvasTools: BoardTool[] = [
  ...canvasReadTools,
  ...canvasWriteTools,
  ...canvasAssetTools,
];

export const canvasPlugin = definePlugin({
  name: "pixi-board-plugin-canvas",
  version: "0.2.0",
  permissions: ["project:read", "board:read", "board:write", "assets:read", "assets:write"],
  tools: canvasTools,
});

export const plugin = canvasPlugin;
