import type { BoardPluginManagerPlugin } from "./tauriPlugins";
import { PluginSortController, type PluginSortPlacement } from "./pluginSortController";

export type PluginManagerListViewOptions = {
  list: HTMLElement;
  onOrderChange: (plugins: BoardPluginManagerPlugin[]) => void;
  onSaveEnv: (
    plugin: BoardPluginManagerPlugin,
    env: Record<string, string>,
    statusLine: HTMLElement,
  ) => void;
};

export class PluginManagerListView {
  private readonly list: HTMLElement;
  private readonly onOrderChange: PluginManagerListViewOptions["onOrderChange"];
  private readonly onSaveEnv: PluginManagerListViewOptions["onSaveEnv"];
  private readonly sorting: PluginSortController;
  private plugins: BoardPluginManagerPlugin[] = [];

  constructor(options: PluginManagerListViewOptions) {
    this.list = options.list;
    this.onOrderChange = options.onOrderChange;
    this.onSaveEnv = options.onSaveEnv;
    this.sorting = new PluginSortController({
      list: this.list,
      onMove: (movingId, targetId, placement) => this.movePlugin(movingId, targetId, placement),
    });
  }

  setPlugins(plugins: BoardPluginManagerPlugin[]): void {
    this.plugins = plugins;
    this.render();
  }

  setBusy(busy: boolean, tauriRuntime: boolean): void {
    this.list.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button").forEach((control) => {
      control.disabled = busy || !tauriRuntime;
    });
  }

  private render(): void {
    if (this.plugins.length === 0) {
      const empty = document.createElement("div");
      empty.className = "plugin-empty";
      empty.textContent = "插件目录为空";
      this.list.replaceChildren(empty);
      return;
    }

    this.list.replaceChildren(...this.plugins.map((plugin) => this.renderPluginCard(plugin)));
  }

  private renderPluginCard(plugin: BoardPluginManagerPlugin): HTMLElement {
    const card = document.createElement("article");
    card.className = "plugin-card plugin-card-draggable";
    card.dataset.state = "enabled";
    card.dataset.pluginId = plugin.id;

    const header = document.createElement("div");
    header.className = "plugin-card-header";
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "plugin-drag-handle";
    handle.title = "拖动排序";
    handle.setAttribute("aria-label", "拖动排序");
    handle.textContent = "::";
    handle.addEventListener("pointerdown", (event) => this.sorting.begin(event, plugin.id));

    const main = document.createElement("div");
    main.className = "plugin-card-main";
    const name = document.createElement("span");
    name.className = "plugin-card-name";
    name.textContent = plugin.version ? `${plugin.name}@${plugin.version}` : plugin.name;
    const details = document.createElement("span");
    details.className = "plugin-card-package";
    details.textContent = plugin.id;
    main.append(name, details);

    const status = document.createElement("span");
    status.className = "plugin-card-status";
    status.textContent = "zip";
    header.append(handle, main, status);
    card.append(header);

    if (plugin.environmentVariables.length > 0) {
      card.append(this.renderEnvForm(plugin));
    }

    return card;
  }

  private renderEnvForm(plugin: BoardPluginManagerPlugin): HTMLFormElement {
    const form = document.createElement("form");
    form.className = "plugin-env-form";
    const statusLine = document.createElement("span");
    statusLine.className = "plugin-env-status";

    for (const variable of plugin.environmentVariables) {
      const label = document.createElement("label");
      label.className = "plugin-env-label";
      label.textContent = variable.name;
      if (variable.description) {
        label.title = variable.description;
      }
      const row = document.createElement("div");
      row.className = "plugin-env-row";
      const input = document.createElement("input");
      input.className = "plugin-env-input";
      input.name = variable.name;
      input.type = variable.secret ? "password" : "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = plugin.env[variable.name] ?? "";
      const save = document.createElement("button");
      save.className = "plugin-env-save";
      save.type = "submit";
      save.textContent = "保存";
      row.append(input, save);
      form.append(label, row);
    }

    form.append(statusLine);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const env = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
      this.onSaveEnv(plugin, env, statusLine);
    });

    return form;
  }

  private movePlugin(movingId: string, targetId: string, placement: PluginSortPlacement): void {
    const movingIndex = this.plugins.findIndex((plugin) => plugin.id === movingId);
    const targetIndex = this.plugins.findIndex((plugin) => plugin.id === targetId);
    if (movingIndex < 0 || targetIndex < 0) return;
    const nextPlugins = [...this.plugins];
    const [moving] = nextPlugins.splice(movingIndex, 1);
    if (!moving) return;
    const nextTargetIndex = nextPlugins.findIndex((plugin) => plugin.id === targetId);
    nextPlugins.splice(placement === "after" ? nextTargetIndex + 1 : nextTargetIndex, 0, moving);
    this.plugins = nextPlugins;
    this.render();
    this.onOrderChange(nextPlugins);
  }
}
