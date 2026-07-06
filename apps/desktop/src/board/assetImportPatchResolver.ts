import type { Asset } from "@pixi-board/board-domain";
import { suggestAssetNodeSize } from "../assets/assetSizing";
import type { BoardStore, NodeAssetReplacement } from "./boardStore";
import type { ImportPatch } from "./assetImportPatchQueue";

export type ImportPatchResolution = {
  replacements: Array<{ nodeId: string; replacement: NodeAssetReplacement }>;
  removals: string[];
};

export function resolveImportPatches(
  patches: ImportPatch[],
  options: {
    isSessionActive: (sessionId: number) => boolean;
    store: BoardStore;
  },
): ImportPatchResolution {
  const removals = new Set<string>();
  const replacements = new Map<string, Asset>();

  for (const patch of patches) {
    if (!options.isSessionActive(patch.sessionId)) continue;
    if (patch.kind === "remove") {
      removals.add(patch.nodeId);
      replacements.delete(patch.nodeId);
    } else if (!removals.has(patch.nodeId)) {
      replacements.set(patch.nodeId, patch.asset);
    }
  }

  return {
    removals: [...removals],
    replacements: [...replacements.entries()]
      .map(([nodeId, asset]) => {
        const node = options.store.getNode(nodeId);
        if (!node) return null;
        const size = suggestAssetNodeSize(asset);
        return {
          nodeId,
          replacement: {
            asset,
            width: size.width,
            height: size.height,
            name: asset.fileName ? undefined : node.name,
            locked: false,
          },
        };
      })
      .filter((replacement): replacement is NonNullable<typeof replacement> =>
        Boolean(replacement),
      ),
  };
}
