import type { Asset } from "@pixi-board/board-domain";

export function mergeAssetsById(assets: Asset[]): Asset[] {
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}
