import { AssetImportManager } from "./assets/assetImportManager";
import { AssetNodeFactory } from "./assets/assetNodeFactory";
import { AssetPipeline } from "./assets/assetPipeline";
import { AssetPreviewJobRunner } from "./assets/assetPreviewJobRunner";
import { AssetImportSessionCoordinator } from "./board/assetImportSessionCoordinator";
import { BoardEditor } from "./board/boardEditor";
import { BoardFileActions } from "./board/boardFileActions";
import { BoardFrameScheduler } from "./board/boardFrameScheduler";
import { BoardLoadService } from "./board/boardLoadService";
import { BoardMutationApplier } from "./board/boardMutationApplier";
import { BoardPersistenceController } from "./board/boardPersistenceController";
import { BoardScene } from "./board/boardScene";
import { BoardStore } from "./board/boardStore";
import { BoardViewport } from "./board/boardViewport";
import { BoardWriteService } from "./board/boardWriteService";
import { ImportWorkflow } from "./board/importWorkflow";
import { BoardInteractionController } from "./board/boardInteractionController";
import { McpBoardCommandAdapter } from "./board/mcpBoardCommandAdapter";
import { SelectionUiController } from "./board/selectionUiController";
import type { BoardRepository } from "./storage/boardRepository";
import type { AppStatus } from "./status";
import type { McpWriteCommand, McpWriteCommandResult } from "@pixi-board/mcp-protocol";

type WhiteboardOptions = {
  repository: BoardRepository;
  pickImportPaths?: () => Promise<string[]>;
  onStatus: (status: AppStatus) => void;
  onBusyChange: (busy: boolean) => void;
  onImportingChange?: (importing: boolean) => void;
  onZoomChange: (scale: number) => void;
  tauriRuntime: boolean;
};

export class MediaWhiteboard {
  private readonly root: HTMLElement;
  private readonly options: WhiteboardOptions;
  private readonly repository: BoardRepository;
  private readonly assets: AssetPipeline;
  private readonly assetPreviewJobs: AssetPreviewJobRunner;
  private readonly assetImports: AssetImportManager;
  private readonly importSessions: AssetImportSessionCoordinator;
  private readonly nodeFactory: AssetNodeFactory;
  private readonly store = new BoardStore();
  private readonly editor = new BoardEditor(this.store);
  private readonly viewport = new BoardViewport();
  private readonly scene: BoardScene;
  private readonly frameScheduler: BoardFrameScheduler;
  private readonly persistence: BoardPersistenceController;
  private readonly mutationApplier: BoardMutationApplier;
  private readonly fileActions: BoardFileActions;
  private readonly loader: BoardLoadService;
  private readonly interactions: BoardInteractionController;
  private readonly importWorkflow: ImportWorkflow;
  private readonly writes: BoardWriteService;
  private readonly mcpCommands: McpBoardCommandAdapter;
  private readonly selectionUi: SelectionUiController;
  private importOverlayDepth = 0;

  constructor(root: HTMLElement, options: WhiteboardOptions) {
    this.root = root;
    this.options = options;
    this.repository = options.repository;
    this.assetPreviewJobs = new AssetPreviewJobRunner();
    this.assets = new AssetPipeline(this.repository, {
      previewRunner: this.assetPreviewJobs,
    });
    this.nodeFactory = new AssetNodeFactory({
      getNextZIndex: () => this.store.nextZIndex(),
    });
    this.assetImports = new AssetImportManager({
      assetPipeline: this.assets,
      repository: this.repository,
    });
    this.scene = new BoardScene({
      resolveAssetUrl: this.repository.resolveAssetUrl.bind(this.repository),
      onNodePointerDown: () => {},
    });
    this.frameScheduler = new BoardFrameScheduler({
      scene: this.scene,
      store: this.store,
      viewport: this.viewport,
    });
    this.persistence = new BoardPersistenceController({
      getNodes: () => this.store.getNodes(),
      getViewport: () => this.viewport.snapshot(),
      onStatus: options.onStatus,
      repository: this.repository,
    });
    this.mutationApplier = new BoardMutationApplier({
      persistence: this.persistence,
      scene: this.scene,
      store: this.store,
      viewport: this.viewport,
    });
    this.fileActions = new BoardFileActions({
      onStatus: options.onStatus,
      repository: this.repository,
      store: this.store,
    });
    this.loader = new BoardLoadService({
      assets: this.assets,
      editor: this.editor,
      emitZoom: () => this.emitZoom(),
      onStatus: options.onStatus,
      repository: this.repository,
      scene: this.scene,
      setBusy: (busy, status) => this.setBusy(busy, status),
      store: this.store,
      syncViewportNow: () => this.syncViewportNow(),
      viewport: this.viewport,
    });
    this.importSessions = new AssetImportSessionCoordinator({
      editor: this.editor,
      store: this.store,
      onTransientChange: (mutation) =>
        this.mutationApplier.apply(mutation, { scheduleSave: false }),
    });
    this.writes = new BoardWriteService({
      assetImports: this.assetImports,
      editor: this.editor,
      nodeFactory: this.nodeFactory,
      onMutation: (mutation, mutationOptions) =>
        this.mutationApplier.apply(mutation, mutationOptions),
      onStatus: options.onStatus,
      previewRunner: this.assetPreviewJobs,
      persistence: this.persistence,
      repository: this.repository,
      scene: this.scene,
      setBusy: (busy, status) => this.setBusy(busy, status),
      setImportOverlay: (active) => this.setImportOverlay(active),
      store: this.store,
      viewport: this.viewport,
    });
    this.interactions = new BoardInteractionController({
      editor: this.editor,
      frameScheduler: this.frameScheduler,
      onDeleteSelection: () => this.writes.deleteSelectedNodes(),
      onNodeDoubleClick: (nodeId) => this.selectionUi.startNodeNameEdit(nodeId),
      onMutation: (mutation) => this.mutationApplier.apply(mutation),
      onViewportChange: () => this.handleViewportChange(),
      scene: this.scene,
      store: this.store,
      viewport: this.viewport,
    });
    this.scene.setNodePointerDownHandler(this.interactions.handleNodePointerDown);
    this.scene.selection.setResizeHandlePointerDownHandler(
      this.interactions.handleResizeHandlePointerDown,
    );

    this.importWorkflow = new ImportWorkflow({
      assetImports: this.assetImports,
      editor: this.editor,
      importSessions: this.importSessions,
      nodeFactory: this.nodeFactory,
      onMutation: (mutation, mutationOptions) =>
        this.mutationApplier.apply(mutation, mutationOptions),
      onStatus: options.onStatus,
      persistence: this.persistence,
      scene: this.scene,
      setBusy: (busy, status) => this.setBusy(busy, status),
      setImportOverlay: (active) => this.setImportOverlay(active),
      store: this.store,
      viewport: this.viewport,
    });
    this.mcpCommands = new McpBoardCommandAdapter({
      writes: this.writes,
    });
    this.selectionUi = new SelectionUiController({
      downloadNode: (node) => this.fileActions.downloadNode(node),
      editor: this.editor,
      onMutation: (mutation) => this.mutationApplier.apply(mutation),
      onReload: () => this.reloadBoard(),
      refreshNodePreview: (nodeId) => this.writes.refreshNodePreviewFromUi(nodeId),
      onStatus: options.onStatus,
      onViewportWheel: this.interactions.handleViewportWheel,
      revealAsset: (assetId) => this.fileActions.revealAsset(assetId),
      revealProject: () => this.fileActions.revealProject(),
      root: this.root,
      scene: this.scene,
      store: this.store,
      syncViewportNow: () => this.syncViewportNow(),
      tauriRuntime: options.tauriRuntime,
      viewport: this.viewport,
    });
    this.scene.selection.setChangeHandler((selection) =>
      this.selectionUi.handleSelectionChange(selection),
    );
  }

  async init(): Promise<void> {
    await this.scene.init(this.root);
    this.viewport.center({
      width: this.root.clientWidth,
      height: this.root.clientHeight,
    });
    this.syncViewportNow();
    this.emitZoom();
    this.selectionUi.attach();
    this.interactions.attach();
    await this.loader.load();
  }

  destroy(): void {
    if (this.importOverlayDepth > 0) {
      this.importOverlayDepth = 0;
      this.options.onImportingChange?.(false);
    }
    this.importSessions.abortAll();
    this.persistence.destroy();
    this.selectionUi.detach();
    this.selectionUi.destroy();
    this.interactions.detach();
    this.frameScheduler.destroy();
    this.scene.destroy();
  }

  async importFromDialog(): Promise<void> {
    if (!this.options.pickImportPaths) {
      throw new Error("Import dialog is unavailable in the current runtime");
    }

    const paths = await this.options.pickImportPaths();
    await this.importPaths(paths);
  }

  importPaths(paths: string[]): Promise<void> {
    return this.importWorkflow.importPaths(paths);
  }

  handleMcpWriteCommand(command: McpWriteCommand): Promise<McpWriteCommandResult> {
    return this.mcpCommands.handle(command);
  }

  captureVisibleArea(): Promise<string> {
    return this.scene.captureVisibleAreaDataUrl();
  }

  private async reloadBoard(): Promise<void> {
    this.selectionUi.hideTransientUi();
    await this.loader.load({ reloadResources: true });
  }

  private handleViewportChange(): void {
    this.emitZoom();
    this.selectionUi.positionNameEditor();
    this.persistence.scheduleViewportSave();
  }

  private emitZoom(): void {
    this.options.onZoomChange(this.viewport.scale);
  }

  private syncViewportNow(): void {
    this.scene.applyViewport(this.viewport);
    this.scene.syncViewport(this.store, this.viewport);
  }

  private setBusy(busy: boolean, status?: AppStatus): void {
    this.options.onBusyChange(busy);
    if (status) {
      this.options.onStatus(status);
    }
  }

  private setImportOverlay(active: boolean): void {
    const previousActive = this.importOverlayDepth > 0;
    this.importOverlayDepth = Math.max(0, this.importOverlayDepth + (active ? 1 : -1));
    const nextActive = this.importOverlayDepth > 0;
    if (previousActive !== nextActive) {
      this.options.onImportingChange?.(nextActive);
    }
  }
}
