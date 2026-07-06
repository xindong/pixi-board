import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { AssetImportManager } from "../assets/assetImportManager";
import { AssetNodeFactory } from "../assets/assetNodeFactory";
import { createId } from "../utils";
import type { BoardEditor } from "./boardEditor";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardCreateNodeInput } from "./boardWriteTypes";
import type { BoardViewport } from "./boardViewport";

type BoardNodeCreationServiceOptions = {
  assetImports: AssetImportManager;
  editor: BoardEditor;
  nodeFactory: AssetNodeFactory;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
};

export class BoardNodeCreationService {
  private readonly assetImports: AssetImportManager;
  private readonly editor: BoardEditor;
  private readonly nodeFactory: AssetNodeFactory;
  private readonly scene: BoardScene;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;

  constructor(options: BoardNodeCreationServiceOptions) {
    this.assetImports = options.assetImports;
    this.editor = options.editor;
    this.nodeFactory = options.nodeFactory;
    this.scene = options.scene;
    this.store = options.store;
    this.viewport = options.viewport;
  }

  async createNodesFromInputs(inputs: BoardCreateNodeInput[]): Promise<BoardNode[]> {
    if (inputs.length === 0) return [];

    const assetsByPlacement = new Map<number, Asset>();
    const filePlacements = inputs
      .map((placement, index) => ({ placement, index }))
      .filter(({ placement }) => placement.kind !== "generating");
    if (filePlacements.length > 0) {
      const preparedAssets = await this.assetImports.importAndPrepareAssets(
        filePlacements.map(({ placement }) => requiredPath(placement)),
      );
      preparedAssets.forEach((asset, index) => {
        assetsByPlacement.set(filePlacements[index].index, asset);
      });
      this.editor.upsertAssets(preparedAssets);
    }

    const generatingAssets: Asset[] = [];
    for (const [index, placement] of inputs.entries()) {
      if (placement.kind !== "generating") continue;
      const asset = createGeneratingAsset(placement.name);
      assetsByPlacement.set(index, asset);
      generatingAssets.push(asset);
    }
    if (generatingAssets.length > 0) {
      this.editor.upsertAssets(generatingAssets);
    }

    const preparedAssets = inputs
      .map((_, index) => assetsByPlacement.get(index))
      .filter((asset): asset is Asset => Boolean(asset));

    return this.nodeFactory
      .createNodes(preparedAssets, {
        center: this.placementCenter(),
        existingNodes: this.store.getNodes(),
        nodes: inputs,
      })
      .map((node, index) => {
        const placement = inputs[index];
        return {
          ...node,
          name: placement.name ?? node.name,
          options: placement.options ?? node.options,
          width: placement.width ?? node.width,
          height: placement.height ?? node.height,
        };
      });
  }

  private placementCenter(): { x: number; y: number } {
    const screen = this.scene.screen;
    return this.viewport.screenToWorld({
      x: screen.width / 2,
      y: screen.height / 2,
    });
  }
}

function requiredPath(placement: BoardCreateNodeInput): string {
  if (typeof placement.path === "string" && placement.path.trim()) {
    return placement.path;
  }
  throw new Error("File node placement is missing a path");
}

function createGeneratingAsset(name: string | undefined): Asset {
  const now = Date.now();
  return {
    id: createId("asset"),
    kind: "generating",
    metadata: {
      title: name,
    },
    createdAt: now,
    updatedAt: now,
  };
}
