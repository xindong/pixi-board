import { BoardToolbarController } from "./boardToolbarController";
import {
  createBrowserRuntimeAdapter,
  createTauriRuntimeAdapter,
  type WhiteboardRuntimeAdapter,
} from "./desktopRuntimeAdapter";
import type { BoardRepository } from "./storage/boardRepository";
import type { WhiteboardShellElements } from "./mainShell";
import { PluginManagerController } from "./pluginManagerController";
import { ProjectSessionController } from "./projectSessionController";
import { ProjectSwitcherController } from "./projectSwitcherController";
import { formatZoom, summarizeStatus, type AppStatus } from "./status";
import { createIcon } from "./ui/icons";
import { MediaWhiteboard } from "./whiteboard";

export type WhiteboardAppControllerOptions = {
  tauriRuntime: boolean;
  shell: WhiteboardShellElements;
};

export class WhiteboardAppController {
  private readonly tauriRuntime: boolean;
  private readonly shell: WhiteboardShellElements;
  private readonly toolbarController: BoardToolbarController;
  private readonly projectSwitcherController: ProjectSwitcherController;
  private readonly projectSession: ProjectSessionController;
  private readonly pluginManager: PluginManagerController;
  private runtime: WhiteboardRuntimeAdapter = createBrowserRuntimeAdapter();
  private whiteboard: MediaWhiteboard | null = null;
  private busy = false;

  constructor(options: WhiteboardAppControllerOptions) {
    this.tauriRuntime = options.tauriRuntime;
    this.shell = options.shell;
    this.shell.importLockIcon.replaceChildren(
      createIcon("loading", { className: "import-lock-spinner", size: 18 }),
    );
    this.projectSwitcherController = new ProjectSwitcherController({
      tauriRuntime: this.tauriRuntime,
      controls: {
        root: this.shell.projectSwitcher,
        trigger: this.shell.projectTrigger,
        triggerIcon: this.shell.projectTriggerIcon,
        current: this.shell.projectCurrent,
        menu: this.shell.projectMenu,
        list: this.shell.projectList,
        newButton: this.shell.projectNewButton,
      },
    });
    this.projectSession = new ProjectSessionController({
      getRuntime: () => this.runtime,
      projectSwitcher: this.projectSwitcherController,
      mountWhiteboard: (repository) => this.mountWhiteboard(repository),
      publishMcpBridge: () => this.publishCurrentMcpBridge(),
      setStatus: (status) => this.setStatus(status),
      setBusy: (busy) => this.setBusy(busy),
    });
    this.projectSwitcherController.setActions({
      onOpenProject: (project) => {
        void this.projectSession.openProject(project);
      },
      onCreateProject: () => {
        this.projectSession.createProject();
      },
      onRenameProject: (name) => {
        this.projectSession.renameCurrentProject(name);
      },
    });
    this.toolbarController = new BoardToolbarController({
      tauriRuntime: this.tauriRuntime,
      getWhiteboard: () => this.whiteboard,
      getCurrentProject: () => this.projectSession.getCurrentProject(),
      getScreenshotSaver: () => this.runtime.bridge?.saveBoardScreenshot ?? null,
      onBusyChange: (nextBusy) => this.setBusy(nextBusy),
      onStatus: (nextStatus) => this.setStatus(nextStatus),
      controls: {
        importButton: this.shell.importButton,
        screenshotButton: this.shell.screenshotButton,
      },
    });
    this.pluginManager = new PluginManagerController({
      tauriRuntime: this.tauriRuntime,
      getBridge: () => this.runtime.bridge,
      onOpen: () => this.projectSwitcherController.close(),
      controls: {
        trigger: this.shell.pluginMarketButton,
        overlay: this.shell.pluginMarketOverlay,
        dialog: this.shell.pluginMarketDialog,
        folderOpen: this.shell.pluginFolderOpen,
        refresh: this.shell.pluginManagerRefresh,
        list: this.shell.pluginManagerList,
        close: this.shell.pluginMarketClose,
        status: this.shell.pluginManagerStatus,
      },
    });
  }

  async bootstrap(): Promise<void> {
    this.setStatus("starting");
    this.setZoom(1);

    if (this.tauriRuntime) {
      await this.bootstrapTauriRuntime();
    } else {
      await this.bootstrapBrowserRuntime();
    }

    await this.attachMcpBridge();
    this.bindGlobalEvents();
    await this.attachFileDrops();
    this.setBusy(false);
  }

  failBootstrap(error: unknown): void {
    console.error(error);
    this.setStatus("failed");
    this.setBusy(false);
  }

  private async bootstrapTauriRuntime(): Promise<void> {
    this.runtime = await createTauriRuntimeAdapter();
    await this.projectSession.bootstrapTauriProject();
  }

  private async bootstrapBrowserRuntime(): Promise<void> {
    await this.projectSession.bootstrapBrowserProject();
  }

  private setStatus(nextStatus: AppStatus): void {
    this.shell.statusElement.textContent = summarizeStatus(nextStatus);
  }

  private setZoom(scale: number): void {
    this.shell.zoomElement.textContent = formatZoom(scale);
  }

  private setBusy(nextBusy: boolean): void {
    this.busy = nextBusy;
    this.toolbarController.setBusy(this.busy);
    this.projectSwitcherController.setBusy(this.busy);
  }

  private setImportingOverlay(importing: boolean): void {
    this.shell.importLockOverlay.hidden = !importing;
    this.shell.boardHost.classList.toggle("is-import-locked", importing);
  }

  private async mountWhiteboard(repository: BoardRepository): Promise<void> {
    this.whiteboard?.destroy();
    this.whiteboard = new MediaWhiteboard(this.shell.boardHost, {
      repository,
      pickImportPaths: this.runtime.pickImportPaths,
      onStatus: (status) => this.setStatus(status),
      onBusyChange: (busy) => this.setBusy(busy),
      onImportingChange: (importing) => this.setImportingOverlay(importing),
      onZoomChange: (scale) => this.setZoom(scale),
      tauriRuntime: this.tauriRuntime,
    });
    await this.whiteboard.init();
  }

  private async publishCurrentMcpBridge(): Promise<void> {
    const currentProject = this.projectSession.getCurrentProject();
    if (!this.runtime.bridge || !currentProject) return;
    try {
      await this.runtime.bridge.publishMcpBridge(currentProject.rootPath);
    } catch (error) {
      console.error(error);
    }
  }

  private async attachMcpBridge(): Promise<void> {
    if (!this.runtime.bridge) return;
    await this.runtime.bridge.listenForMcpWriteCommands(async (command) => {
      const currentProject = this.projectSession.getCurrentProject();
      if (!this.whiteboard || !currentProject) {
        throw new Error("No canvas is open in the desktop app");
      }
      if (command.projectRoot !== currentProject.rootPath) {
        throw new Error(`Desktop app has a different canvas open: ${currentProject.rootPath}`);
      }
      return this.whiteboard.handleMcpWriteCommand(command);
    });
    await this.publishCurrentMcpBridge();
  }

  private bindGlobalEvents(): void {
    window.addEventListener("pointerdown", () => {
      this.projectSwitcherController.close();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.pluginManager.close();
        this.projectSwitcherController.close();
      }
    });
  }

  private async attachFileDrops(): Promise<void> {
    if (!this.runtime.listenForDrops) return;
    await this.runtime.listenForDrops((paths) => {
      this.whiteboard?.importPaths(paths).catch((error) => {
        console.error(error);
        this.setStatus("failed");
      });
    });
  }
}
