export type AppStatus =
  | "starting"
  | "ready"
  | "browser"
  | "noProject"
  | "loading"
  | "loaded"
  | "importing"
  | "imported"
  | "downloading"
  | "downloaded"
  | "downloadFailed"
  | "screenshotting"
  | "screenshotSaved"
  | "screenshotFailed"
  | "saving"
  | "saved"
  | "saveFailed"
  | "failed";

const STATUS_LABELS: Record<AppStatus, string> = {
  starting: "启动中",
  ready: "就绪",
  browser: "浏览模式",
  noProject: "未打开画布",
  loading: "加载中",
  loaded: "加载完成",
  importing: "导入中",
  imported: "导入完成",
  downloading: "下载中",
  downloaded: "下载成功",
  downloadFailed: "下载失败",
  screenshotting: "截图中",
  screenshotSaved: "截图已保存",
  screenshotFailed: "截图失败",
  saving: "保存中",
  saved: "保存完成",
  saveFailed: "保存失败",
  failed: "操作失败",
};

export function summarizeStatus(status: AppStatus): string {
  return STATUS_LABELS[status];
}

export function formatZoom(scale: number): string {
  const percent = Math.round(Math.min(1.5, Math.max(0.02, scale)) * 100);
  return `${percent}%`;
}
