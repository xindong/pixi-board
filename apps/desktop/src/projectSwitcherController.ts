import type { ProjectInfo } from "@pixi-board/board-domain";
import { createIcon } from "./ui/icons";

type ProjectSwitcherControllerOptions = {
  tauriRuntime: boolean;
  controls: {
    root: HTMLElement;
    trigger: HTMLButtonElement;
    triggerIcon: HTMLElement;
    current: HTMLElement;
    menu: HTMLElement;
    list: HTMLElement;
    newButton: HTMLButtonElement;
  };
};

type ProjectSwitcherActions = {
  onOpenProject: (project: ProjectInfo) => void;
  onCreateProject: () => void;
  onRenameProject: (name: string) => void;
};

export class ProjectSwitcherController {
  private readonly tauriRuntime: boolean;
  private readonly root: HTMLElement;
  private readonly trigger: HTMLButtonElement;
  private readonly current: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly list: HTMLElement;
  private readonly newButton: HTMLButtonElement;
  private actions: ProjectSwitcherActions = {
    onOpenProject: () => {},
    onCreateProject: () => {},
    onRenameProject: () => {},
  };
  private currentProject: ProjectInfo | null = null;
  private projects: ProjectInfo[] = [];
  private renamingProjectRoot: string | null = null;

  constructor(options: ProjectSwitcherControllerOptions) {
    this.tauriRuntime = options.tauriRuntime;
    this.root = options.controls.root;
    this.trigger = options.controls.trigger;
    this.current = options.controls.current;
    this.menu = options.controls.menu;
    this.list = options.controls.list;
    this.newButton = options.controls.newButton;

    options.controls.triggerIcon.replaceChildren(createIcon("chevronDown", { size: 14, strokeWidth: 2.2 }));
    this.newButton.prepend(createIcon("plus", { size: 14 }));
    this.bindEvents();
  }

  setActions(actions: ProjectSwitcherActions): void {
    this.actions = actions;
  }

  setProjects(projects: ProjectInfo[], currentProject: ProjectInfo | null): void {
    this.projects = projects;
    this.currentProject = currentProject;
    this.renamingProjectRoot = null;
    this.render();
  }

  setBusy(busy: boolean): void {
    const disabled = busy || !this.tauriRuntime;
    this.trigger.disabled = disabled;
    this.newButton.disabled = disabled;
  }

  close(): void {
    this.setOpen(false);
  }

  private bindEvents(): void {
    this.root.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    this.trigger.addEventListener("click", () => {
      if (!this.tauriRuntime) return;
      this.setOpen(this.menu.hidden);
    });

    this.newButton.addEventListener("click", () => {
      this.renamingProjectRoot = null;
      this.actions.onCreateProject();
    });
  }

  private setOpen(open: boolean): void {
    this.menu.hidden = !open;
    this.trigger.setAttribute("aria-expanded", String(open));
    if (!open) {
      this.renamingProjectRoot = null;
    }
  }

  private render(): void {
    this.current.textContent = this.currentProject?.name ?? (this.tauriRuntime ? "未打开画布" : "Browser");
    this.list.replaceChildren(...this.projects.map((project) => this.renderProjectItem(project)));
  }

  private renderProjectItem(project: ProjectInfo): HTMLElement {
    const item = document.createElement("div");
    item.className = "project-item";
    const active = project.rootPath === this.currentProject?.rootPath;
    item.dataset.active = String(active);

    if (active && this.renamingProjectRoot === project.rootPath) {
      item.append(this.renderRenameForm(project));
      return item;
    }

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "project-item-open";
    openButton.textContent = project.name;
    openButton.addEventListener("click", () => {
      if (project.rootPath === this.currentProject?.rootPath) {
        this.close();
        return;
      }
      this.close();
      this.actions.onOpenProject(project);
    });

    item.append(openButton);
    if (active) {
      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.className = "project-item-edit";
      renameButton.title = "重命名";
      renameButton.setAttribute("aria-label", "重命名当前画布");
      renameButton.replaceChildren(createIcon("pencil", { size: 14 }));
      renameButton.addEventListener("click", () => {
        this.renamingProjectRoot = project.rootPath;
        this.render();
      });
      item.append(renameButton);
    }

    return item;
  }

  private renderRenameForm(project: ProjectInfo): HTMLFormElement {
    const form = document.createElement("form");
    form.className = "project-item-rename";
    const input = document.createElement("input");
    input.className = "project-item-input";
    input.value = project.name;
    input.maxLength = 64;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "project-item-action project-item-save";
    submit.title = "保存";
    submit.setAttribute("aria-label", "保存画布名称");
    submit.replaceChildren(createIcon("save", { size: 14 }));

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (!name || name === this.currentProject?.name) {
        this.renamingProjectRoot = null;
        this.render();
        return;
      }
      this.actions.onRenameProject(name);
    });

    form.append(input, submit);
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    return form;
  }
}
