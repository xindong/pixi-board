export type WhiteboardShellElements = {
  boardHost: HTMLElement;
  importButton: HTMLButtonElement;
  screenshotButton: HTMLButtonElement;
  pluginMarketButton: HTMLButtonElement;
  statusElement: HTMLElement;
  zoomElement: HTMLElement;
  projectSwitcher: HTMLElement;
  projectTrigger: HTMLButtonElement;
  projectTriggerIcon: HTMLElement;
  projectCurrent: HTMLElement;
  projectMenu: HTMLElement;
  projectList: HTMLElement;
  projectNewButton: HTMLButtonElement;
  importLockOverlay: HTMLElement;
  importLockIcon: HTMLElement;
  pluginMarketOverlay: HTMLElement;
  pluginMarketDialog: HTMLElement;
  pluginFolderOpen: HTMLButtonElement;
  pluginManagerRefresh: HTMLButtonElement;
  pluginManagerList: HTMLElement;
  pluginMarketClose: HTMLButtonElement;
  pluginManagerStatus: HTMLElement;
};

export function mountWhiteboardShell(appElement: HTMLElement): WhiteboardShellElements {
  appElement.innerHTML = `
  <main class="shell">
    <section class="board-host" data-board-host>
      <nav class="tool-rail" aria-label="Canvas tools">
        <button class="tool-button" type="button" title="导入" aria-label="导入" data-import-button></button>
        <button class="tool-button" type="button" title="截图" aria-label="截图" data-screenshot-button></button>
        <button class="tool-button" type="button" title="插件管理" aria-label="插件管理" aria-haspopup="dialog" data-plugin-market-button></button>
      </nav>
      <div class="project-switcher" data-project-switcher>
        <button class="project-trigger" type="button" aria-haspopup="menu" aria-expanded="false" data-project-trigger>
          <span class="project-current-name" data-project-current>画布</span>
          <span class="project-trigger-icon" aria-hidden="true" data-project-trigger-icon></span>
        </button>
        <div class="project-menu" hidden data-project-menu>
          <div class="project-list" role="menu" data-project-list></div>
          <div class="project-actions">
            <button class="project-action" type="button" data-project-new>新建画布</button>
          </div>
        </div>
      </div>
      <div class="status-bar" aria-live="polite">
        <span class="status" data-status>启动中</span>
        <span class="zoom-status" data-zoom>100%</span>
      </div>
      <div class="import-lock-overlay" hidden data-import-lock aria-live="polite" aria-busy="true">
        <div class="import-lock-panel" role="status">
          <span class="import-lock-icon" aria-hidden="true" data-import-lock-icon></span>
          <span class="import-lock-copy">
            <span class="import-lock-title">正在导入资源</span>
            <span class="import-lock-subtitle">预览生成中，画布暂时锁定</span>
          </span>
        </div>
      </div>
      <div class="plugin-market-overlay" hidden data-plugin-market-overlay>
        <section class="plugin-market-dialog" role="dialog" aria-modal="true" aria-labelledby="plugin-market-title" data-plugin-market-dialog>
          <header class="plugin-market-header">
            <span class="plugin-market-kicker">Board Plugins</span>
            <div class="plugin-market-actions">
              <button class="plugin-market-folder" type="button" title="打开插件文件夹" aria-label="打开插件文件夹" data-plugin-folder-open></button>
              <button class="plugin-market-refresh" type="button" title="刷新并重启 MCP" aria-label="刷新并重启 MCP" data-plugin-manager-refresh></button>
              <button class="plugin-market-close" type="button" title="关闭" aria-label="关闭插件管理" data-plugin-market-close></button>
            </div>
          </header>
          <div class="plugin-market-title-row">
            <h2 id="plugin-market-title">插件管理</h2>
            <p>MCP 只加载本地插件目录第一层的 zip 插件包。</p>
          </div>
          <div class="plugin-market-list" aria-label="插件列表" data-plugin-manager-list></div>
          <span class="plugin-manager-status" data-plugin-manager-status></span>
        </section>
      </div>
    </section>
  </main>
`;

  return {
    boardHost: queryRequired<HTMLElement>(appElement, "[data-board-host]"),
    importButton: queryRequired<HTMLButtonElement>(appElement, "[data-import-button]"),
    screenshotButton: queryRequired<HTMLButtonElement>(appElement, "[data-screenshot-button]"),
    pluginMarketButton: queryRequired<HTMLButtonElement>(appElement, "[data-plugin-market-button]"),
    statusElement: queryRequired<HTMLElement>(appElement, "[data-status]"),
    zoomElement: queryRequired<HTMLElement>(appElement, "[data-zoom]"),
    projectSwitcher: queryRequired<HTMLElement>(appElement, "[data-project-switcher]"),
    projectTrigger: queryRequired<HTMLButtonElement>(appElement, "[data-project-trigger]"),
    projectTriggerIcon: queryRequired<HTMLElement>(appElement, "[data-project-trigger-icon]"),
    projectCurrent: queryRequired<HTMLElement>(appElement, "[data-project-current]"),
    projectMenu: queryRequired<HTMLElement>(appElement, "[data-project-menu]"),
    projectList: queryRequired<HTMLElement>(appElement, "[data-project-list]"),
    projectNewButton: queryRequired<HTMLButtonElement>(appElement, "[data-project-new]"),
    importLockOverlay: queryRequired<HTMLElement>(appElement, "[data-import-lock]"),
    importLockIcon: queryRequired<HTMLElement>(appElement, "[data-import-lock-icon]"),
    pluginMarketOverlay: queryRequired<HTMLElement>(appElement, "[data-plugin-market-overlay]"),
    pluginMarketDialog: queryRequired<HTMLElement>(appElement, "[data-plugin-market-dialog]"),
    pluginFolderOpen: queryRequired<HTMLButtonElement>(appElement, "[data-plugin-folder-open]"),
    pluginManagerRefresh: queryRequired<HTMLButtonElement>(appElement, "[data-plugin-manager-refresh]"),
    pluginManagerList: queryRequired<HTMLElement>(appElement, "[data-plugin-manager-list]"),
    pluginMarketClose: queryRequired<HTMLButtonElement>(appElement, "[data-plugin-market-close]"),
    pluginManagerStatus: queryRequired<HTMLElement>(appElement, "[data-plugin-manager-status]"),
  };
}

function queryRequired<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Whiteboard shell is missing ${selector}`);
  }
  return element;
}
