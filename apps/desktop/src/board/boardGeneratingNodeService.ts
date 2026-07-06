import type { BoardNode } from "@pixi-board/board-domain";
import { AssetImportManager } from "../assets/assetImportManager";
import { suggestAssetNodeSize } from "../assets/assetSizing";
import { baseNameWithoutExtension } from "../utils";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardPreviewService } from "./boardPreviewService";
import type { BoardStore } from "./boardStore";
import { mergeAssetsById } from "./boardWriteResults";
import type { BoardWriteResult } from "./boardWriteTypes";

type BoardGeneratingNodeServiceOptions = {
  assetImports: AssetImportManager;
  editor: BoardEditor;
  onMutation: (mutation: BoardMutation | null, options?: { scheduleSave?: boolean }) => void;
  store: BoardStore;
  previews: BoardPreviewService;
};

export class BoardGeneratingNodeService {
  private readonly assetImports: AssetImportManager;
  private readonly editor: BoardEditor;
  private readonly onMutation: BoardGeneratingNodeServiceOptions["onMutation"];
  private readonly previews: BoardPreviewService;
  private readonly store: BoardStore;

  constructor(options: BoardGeneratingNodeServiceOptions) {
    this.assetImports = options.assetImports;
    this.editor = options.editor;
    this.onMutation = options.onMutation;
    this.previews = options.previews;
    this.store = options.store;
  }

  async install(nodeId: string, path: string): Promise<BoardWriteResult> {
    const node = this.store.getNode(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.type !== "generating") {
      throw new Error(`Node is not generating: ${nodeId}`);
    }

    const [asset] = await this.assetImports.importAndPrepareAssets([path]);
    if (!asset) {
      throw new Error(`No asset was imported from path: ${path}`);
    }

    const size = suggestAssetNodeSize(asset);
    const mutation = this.editor.replaceNodeAssetTransient(nodeId, {
      asset,
      width: size.width,
      height: size.height,
      name: asset.fileName ? baseNameWithoutExtension(asset.fileName) : node.name,
    });
    this.onMutation(mutation);

    const currentNodes = [this.store.getNode(nodeId)].filter(
      (current): current is BoardNode => Boolean(current),
    );
    const refreshedAssets = await this.previews.refreshCreatedNodePreviews(currentNodes);

    return {
      nodes: currentNodes,
      assets: mergeAssetsById([asset, ...refreshedAssets]),
    };
  }
}
