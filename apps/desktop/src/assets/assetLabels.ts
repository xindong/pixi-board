import type { Asset } from "@pixi-board/board-domain";

export function assetLabel(asset: Asset): string {
  if (asset.fileName) return asset.fileName;
  const title = asset.metadata?.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return asset.kind;
}
