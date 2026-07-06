import type {
  Asset,
  BoardNode,
  BoardNodeUpdateInput,
} from "@pixi-board/board-domain";
import { AssetImportManager } from "../assets/assetImportManager";
import { AssetNodeFactory } from "../assets/assetNodeFactory";
import type { AssetPreviewJobRunner } from "../assets/assetPreviewJobRunner";
import type { BoardRepository } from "../storage/boardRepository";
import type { AppStatus } from "../status";
import { BoardAssetUpdateService } from "./boardAssetUpdateService";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import { BoardGeneratingNodeService } from "./boardGeneratingNodeService";
import { BoardNodeCreationService } from "./boardNodeCreationService";
import { BoardNodeDeletionService } from "./boardNodeDeletionService";
import type { BoardPersistenceController } from "./boardPersistenceController";
import { BoardPreviewService } from "./boardPreviewService";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type {
  BoardCreateNodeInput,
  BoardUpdateAssetInput,
  BoardWriteResult,
} from "./boardWriteTypes";
import { mergeAssetsById } from "./boardWriteResults";
import { persistBoardWrite } from "./boardWritePersistence";
import type { BoardViewport } from "./boardViewport";

type BoardWriteServiceOptions = {
  assetImports: AssetImportManager;
  editor: BoardEditor;
  nodeFactory: AssetNodeFactory;
  onMutation: (mutation: BoardMutation | null, options?: { scheduleSave?: boolean }) => void;
  onStatus: (status: AppStatus) => void;
  previewRunner?: AssetPreviewJobRunner;
  persistence: BoardPersistenceController;
  repository: BoardRepository;
  scene: BoardScene;
  store: BoardStore;
  viewport: BoardViewport;
  setBusy: (busy: boolean, status?: AppStatus) => void;
  setImportOverlay: (active: boolean) => void;
};

export class BoardWriteService {
  private readonly assetUpdates: BoardAssetUpdateService;
  private readonly generatingNodes: BoardGeneratingNodeService;
  private readonly nodeCreation: BoardNodeCreationService;
  private readonly editor: BoardEditor;
  private readonly nodeDeletion: BoardNodeDeletionService;
  private readonly onMutation: BoardWriteServiceOptions["onMutation"];
  private readonly onStatus: BoardWriteServiceOptions["onStatus"];
  private readonly persistence: BoardPersistenceController;
  private readonly previews: BoardPreviewService;
  private readonly store: BoardStore;
  private readonly setBusy: BoardWriteServiceOptions["setBusy"];
  private readonly setImportOverlay: BoardWriteServiceOptions["setImportOverlay"];

  constructor(options: BoardWriteServiceOptions) {
    this.nodeCreation = new BoardNodeCreationService({
      assetImports: options.assetImports,
      editor: options.editor,
      nodeFactory: options.nodeFactory,
      scene: options.scene,
      store: options.store,
      viewport: options.viewport,
    });
    this.editor = options.editor;
    this.assetUpdates = new BoardAssetUpdateService({
      editor: this.editor,
      repository: options.repository,
      scene: options.scene,
      store: options.store,
      viewport: options.viewport,
    });
    this.nodeDeletion = new BoardNodeDeletionService({
      editor: options.editor,
      onMutation: options.onMutation,
      onStatus: options.onStatus,
      persistence: options.persistence,
      repository: options.repository,
      setBusy: options.setBusy,
      store: options.store,
    });
    this.onMutation = options.onMutation;
    this.onStatus = options.onStatus;
    this.persistence = options.persistence;
    this.store = options.store;
    this.previews = new BoardPreviewService({
      editor: this.editor,
      onMutation: this.onMutation,
      previewRunner: options.previewRunner,
      repository: options.repository,
      scene: options.scene,
      store: this.store,
      viewport: options.viewport,
    });
    this.generatingNodes = new BoardGeneratingNodeService({
      assetImports: options.assetImports,
      editor: this.editor,
      onMutation: this.onMutation,
      store: this.store,
      previews: this.previews,
    });
    this.setBusy = options.setBusy;
    this.setImportOverlay = options.setImportOverlay;
  }

  async createNodes(nodes: BoardCreateNodeInput[]): Promise<BoardWriteResult> {
    const showImportOverlay = nodes.length > 1;
    if (showImportOverlay) {
      this.setImportOverlay(true);
    }
    this.setBusy(true, "importing");
    try {
      const created = await this.nodeCreation.createNodesFromInputs(nodes);
      if (created.length > 0) {
        const mutation = this.editor.insertNodes(created, {
          label: "Create file nodes",
          selectInserted: false,
        });
        this.onMutation(mutation);
      }
      const refreshedAssets = await this.previews.refreshCreatedNodePreviews(created);
      const createdAssets = created
        .map((node) => this.store.getAsset(node.assetId))
        .filter((asset): asset is Asset => Boolean(asset));

      await persistBoardWrite(this.persistence);
      return { nodes: created, assets: mergeAssetsById([...createdAssets, ...refreshedAssets]) };
    } finally {
      this.setBusy(false);
      if (showImportOverlay) {
        this.setImportOverlay(false);
      }
    }
  }

  async updateNodes(updates: BoardNodeUpdateInput[]): Promise<BoardWriteResult> {
    const mutation = this.editor.updateNodes(updates);
    if (!mutation) {
      return { nodes: [] };
    }
    this.onMutation(mutation);
    await persistBoardWrite(this.persistence);
    return {
      nodes: updates
        .map((update) => this.store.getNode(update.id))
        .filter((node): node is BoardNode => Boolean(node)),
    };
  }

  async updateAssets(updates: BoardUpdateAssetInput[]): Promise<BoardWriteResult> {
    const updatedAssets = await this.assetUpdates.updateAssets(updates);
    await persistBoardWrite(this.persistence);
    return {
      nodes: [],
      assets: updatedAssets,
    };
  }

  async refreshNodePreview(nodeId: string): Promise<BoardWriteResult> {
    const result = await this.previews.refreshNodePreview(nodeId);
    await persistBoardWrite(this.persistence);
    return result;
  }

  async refreshNodePreviewFromUi(nodeId: string): Promise<void> {
    this.setBusy(true, "saving");
    try {
      await this.previews.refreshNodePreview(nodeId);
      await persistBoardWrite(this.persistence);
      this.onStatus("saved");
    } catch (error) {
      console.error(error);
      this.onStatus("saveFailed");
    } finally {
      this.setBusy(false);
    }
  }

  deleteSelectedNodes(): boolean {
    return this.nodeDeletion.deleteSelectedNodes();
  }

  async installGeneratingNode(nodeId: string, path: string): Promise<BoardWriteResult> {
    const result = await this.generatingNodes.install(nodeId, path);
    await persistBoardWrite(this.persistence);
    return result;
  }

}
