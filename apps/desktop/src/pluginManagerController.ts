import { createIcon } from "./ui/icons";
import type { BoardPluginManagerPlugin, PluginManagerBridge } from "./tauriPlugins";
import { PluginManagerListView } from "./pluginManagerListView";

type PluginManagerControllerOptions = {
  tauriRuntime: boolean;
  getBridge: () => PluginManagerBridge | null;
  onOpen?: () => void;
  controls: {
    trigger: HTMLButtonElement;
    overlay: HTMLElement;
    dialog: HTMLElement;
    folderOpen: HTMLButtonElement;
    refresh: HTMLButtonElement;
    list: HTMLElement;
    close: HTMLButtonElement;
    status: HTMLElement;
  };
};

export class PluginManagerController {
  private readonly tauriRuntime: boolean;
  private readonly getBridge: () => PluginManagerBridge | null;
  private readonly onOpen?: () => void;
  private readonly trigger: HTMLButtonElement;
  private readonly overlay: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly folderOpen: HTMLButtonElement;
  private readonly refresh: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly listView: PluginManagerListView;
  private configLoaded = false;
  private plugins: BoardPluginManagerPlugin[] = [];

  constructor(options: PluginManagerControllerOptions) {
    this.tauriRuntime = options.tauriRuntime;
    this.getBridge = options.getBridge;
    this.onOpen = options.onOpen;
    this.trigger = options.controls.trigger;
    this.overlay = options.controls.overlay;
    this.dialog = options.controls.dialog;
    this.folderOpen = options.controls.folderOpen;
    this.refresh = options.controls.refresh;
    this.closeButton = options.controls.close;
    this.status = options.controls.status;
    this.listView = new PluginManagerListView({
      list: options.controls.list,
      onOrderChange: (plugins) => {
        this.plugins = plugins;
      },
      onSaveEnv: (plugin, env, statusLine) => this.savePluginEnv(plugin, env, statusLine),
    });

    this.installIcons();
    this.bindEvents();
  }

  close(): void {
    this.setOpen(false);
  }

  private installIcons(): void {
    this.trigger.replaceChildren(createIcon("store", { size: 17 }));
    this.folderOpen.replaceChildren(createIcon("folderOpen", { size: 15 }));
    this.refresh.replaceChildren(createIcon("refresh", { size: 15 }));
    this.closeButton.replaceChildren(createIcon("x", { size: 16 }));
  }

  private bindEvents(): void {
    this.trigger.addEventListener("click", () => {
      this.onOpen?.();
      this.setOpen(this.overlay.hidden);
    });

    this.closeButton.addEventListener("click", () => this.close());

    this.overlay.addEventListener("pointerdown", (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });

    this.dialog.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    this.folderOpen.addEventListener("click", () => {
      const bridge = this.getBridge();
      if (!bridge) {
        this.status.textContent = "仅桌面版可打开";
        return;
      }
      bridge.revealPluginFolder().catch((error) => {
        console.error(error);
        this.status.textContent = "打开失败";
      });
    });

    this.refresh.addEventListener("click", () => {
      const bridge = this.getBridge();
      if (!bridge) {
        this.status.textContent = "仅桌面版可刷新";
        return;
      }
      this.setBusy(true);
      this.status.textContent = "刷新中";
      bridge
        .refreshPluginsAndRestartMcp(this.plugins.map((plugin) => plugin.id))
        .then((config) => {
          this.configLoaded = true;
          this.plugins = config.plugins;
          this.listView.setPlugins(this.plugins);
          this.status.textContent = "已刷新，MCP 已重启";
        })
        .catch((error) => {
          console.error(error);
          this.status.textContent = "刷新失败";
        })
        .finally(() => this.setBusy(false));
    });
  }

  private setOpen(open: boolean): void {
    this.overlay.hidden = !open;
    this.trigger.classList.toggle("is-active", open);
    this.trigger.setAttribute("aria-expanded", String(open));
    if (open && !this.configLoaded) {
      void this.loadConfig();
    }
  }

  private setBusy(configBusy: boolean): void {
    this.refresh.disabled = configBusy || !this.tauriRuntime;
    this.folderOpen.disabled = configBusy || !this.tauriRuntime;
    this.listView.setBusy(configBusy, this.tauriRuntime);
  }

  private async loadConfig(): Promise<void> {
    const bridge = this.getBridge();
    if (!bridge) {
      this.status.textContent = this.tauriRuntime ? "配置未就绪" : "仅桌面版可配置";
      this.setBusy(false);
      return;
    }
    this.setBusy(true);
    this.status.textContent = "读取中";
    try {
      const config = await bridge.loadPluginManagerConfig();
      this.configLoaded = true;
      this.plugins = config.plugins;
      this.listView.setPlugins(this.plugins);
      this.status.textContent = "";
    } catch (error) {
      console.error(error);
      this.status.textContent = "读取失败";
    } finally {
      this.setBusy(false);
    }
  }

  private savePluginEnv(
    plugin: BoardPluginManagerPlugin,
    env: Record<string, string>,
    statusLine: HTMLElement,
  ): void {
    const bridge = this.getBridge();
    if (!bridge) {
      statusLine.textContent = "仅桌面版可配置";
      return;
    }
    this.setBusy(true);
    statusLine.textContent = "保存中";
    bridge
      .savePluginEnv(plugin.name, env)
      .then((config) => {
        this.configLoaded = true;
        this.plugins = config.plugins;
        this.listView.setPlugins(this.plugins);
        this.status.textContent = "已保存";
      })
      .catch((error) => {
        console.error(error);
        statusLine.textContent = "保存失败";
      })
      .finally(() => this.setBusy(false));
  }
}
