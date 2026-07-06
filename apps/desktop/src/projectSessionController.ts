import type { ProjectInfo } from "@pixi-board/board-domain";
import type { WhiteboardRuntimeAdapter } from "./desktopRuntimeAdapter";
import type { ProjectSwitcherController } from "./projectSwitcherController";
import type { BoardRepository } from "./storage/boardRepository";
import type { AppStatus } from "./status";

type ProjectSessionControllerOptions = {
  getRuntime: () => WhiteboardRuntimeAdapter;
  projectSwitcher: ProjectSwitcherController;
  mountWhiteboard: (repository: BoardRepository) => Promise<void>;
  publishMcpBridge: () => Promise<void>;
  setStatus: (status: AppStatus) => void;
  setBusy: (busy: boolean) => void;
};

export class ProjectSessionController {
  private readonly options: ProjectSessionControllerOptions;
  private currentProject: ProjectInfo | null = null;

  constructor(options: ProjectSessionControllerOptions) {
    this.options = options;
  }

  getCurrentProject(): ProjectInfo | null {
    return this.currentProject;
  }

  async bootstrapTauriProject(): Promise<void> {
    const bridge = this.requireBridge();
    const project = await bridge.openInitialProject();
    await this.refreshProjectList(project?.rootPath);
    if (project) {
      await this.activateProject(project);
    } else {
      this.currentProject = null;
      this.options.projectSwitcher.setProjects([], this.currentProject);
      this.options.setStatus("noProject");
    }
  }

  async bootstrapBrowserProject(): Promise<void> {
    this.currentProject = {
      name: "Browser",
      rootPath: "browser",
      boardPath: "",
      assetsPath: "",
    };
    this.options.projectSwitcher.setProjects([this.currentProject], this.currentProject);
    this.options.setStatus("browser");
    await this.options.mountWhiteboard(this.options.getRuntime().initialRepository);
    this.options.setStatus("browser");
  }

  async openProject(project: ProjectInfo): Promise<void> {
    const bridge = this.options.getRuntime().bridge;
    if (!bridge) return;
    this.options.setBusy(true);
    try {
      const opened = await bridge.createOrOpenProject(project.rootPath);
      await this.refreshProjectList(opened.rootPath);
      await this.activateProject(opened);
    } catch (error) {
      console.error(error);
      this.options.setStatus("failed");
    } finally {
      this.options.setBusy(false);
    }
  }

  async createProject(): Promise<void> {
    const bridge = this.options.getRuntime().bridge;
    if (!bridge) return;
    this.options.setBusy(true);
    try {
      const project = await bridge.createCanvasProject();
      if (!project) {
        this.options.setStatus(this.currentProject ? "ready" : "noProject");
        return;
      }
      await this.refreshProjectList(project.rootPath);
      await this.activateProject(project);
      this.options.projectSwitcher.close();
    } catch (error) {
      console.error(error);
      this.options.setStatus("failed");
    } finally {
      this.options.setBusy(false);
    }
  }

  async renameCurrentProject(name: string): Promise<void> {
    const bridge = this.options.getRuntime().bridge;
    if (!bridge) return;
    this.options.setBusy(true);
    try {
      const renamedProject = await bridge.renameCurrentProject(name);
      await this.refreshProjectList(renamedProject.rootPath);
      const repository = this.options.getRuntime().createRepository(renamedProject.rootPath);
      await this.options.mountWhiteboard(repository);
      await this.options.publishMcpBridge();
      this.options.setStatus("ready");
    } catch (error) {
      console.error(error);
      this.options.setStatus("failed");
    } finally {
      this.options.setBusy(false);
    }
  }

  private async refreshProjectList(selectedRootPath?: string): Promise<void> {
    const bridge = this.options.getRuntime().bridge;
    if (!bridge) return;
    const projects = await bridge.listCanvasProjects();
    this.currentProject =
      projects.find((project) => project.rootPath === selectedRootPath) ??
      projects[0] ??
      null;
    this.options.projectSwitcher.setProjects(projects, this.currentProject);
  }

  private async activateProject(project: ProjectInfo): Promise<void> {
    this.currentProject = project;
    const repository = this.options.getRuntime().createRepository(project.rootPath);
    await this.options.mountWhiteboard(repository);
    await this.options.publishMcpBridge();
    this.options.setStatus("ready");
    this.options.setBusy(false);
  }

  private requireBridge(): NonNullable<WhiteboardRuntimeAdapter["bridge"]> {
    const bridge = this.options.getRuntime().bridge;
    if (!bridge) {
      throw new Error("Tauri bridge is not available");
    }
    return bridge;
  }
}
