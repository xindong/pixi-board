import type { ProjectInfo } from "@pixi-board/board-domain";
import type { AppStatus } from "./status";
import { createIcon } from "./ui/icons";
import type { MediaWhiteboard } from "./whiteboard";

type BoardToolbarControllerOptions = {
  tauriRuntime: boolean;
  getWhiteboard: () => MediaWhiteboard | null;
  getCurrentProject: () => ProjectInfo | null;
  getScreenshotSaver: () => ((projectRoot: string, dataUrl: string) => Promise<unknown>) | null;
  onBusyChange: (busy: boolean) => void;
  onStatus: (status: AppStatus) => void;
  controls: {
    importButton: HTMLButtonElement;
    screenshotButton: HTMLButtonElement;
  };
};

export class BoardToolbarController {
  private readonly tauriRuntime: boolean;
  private readonly getWhiteboard: () => MediaWhiteboard | null;
  private readonly getCurrentProject: () => ProjectInfo | null;
  private readonly getScreenshotSaver: () => ((projectRoot: string, dataUrl: string) => Promise<unknown>) | null;
  private readonly onBusyChange: (busy: boolean) => void;
  private readonly onStatus: (status: AppStatus) => void;
  private readonly importButton: HTMLButtonElement;
  private readonly screenshotButton: HTMLButtonElement;

  constructor(options: BoardToolbarControllerOptions) {
    this.tauriRuntime = options.tauriRuntime;
    this.getWhiteboard = options.getWhiteboard;
    this.getCurrentProject = options.getCurrentProject;
    this.getScreenshotSaver = options.getScreenshotSaver;
    this.onBusyChange = options.onBusyChange;
    this.onStatus = options.onStatus;
    this.importButton = options.controls.importButton;
    this.screenshotButton = options.controls.screenshotButton;

    this.installIcons();
    this.bindEvents();
  }

  setBusy(busy: boolean): void {
    const disabled = busy || !this.tauriRuntime || !this.getCurrentProject();
    this.importButton.disabled = disabled;
    this.screenshotButton.disabled = disabled;
    this.importButton.setAttribute("aria-busy", String(busy));
    this.screenshotButton.setAttribute("aria-busy", String(busy));
  }

  private installIcons(): void {
    this.importButton.replaceChildren(createIcon("upload", { size: 17 }));
    this.screenshotButton.replaceChildren(createIcon("camera", { size: 17 }));
  }

  private bindEvents(): void {
    this.importButton.addEventListener("click", () => {
      this.getWhiteboard()
        ?.importFromDialog()
        .catch((error) => {
          console.error(error);
          this.onStatus("failed");
        });
    });

    this.screenshotButton.addEventListener("click", () => {
      const saveScreenshot = this.getScreenshotSaver();
      const whiteboard = this.getWhiteboard();
      const currentProject = this.getCurrentProject();
      if (!saveScreenshot || !whiteboard || !currentProject) return;

      this.onBusyChange(true);
      this.onStatus("screenshotting");
      whiteboard
        .captureVisibleArea()
        .then((dataUrl) => saveScreenshot(currentProject.rootPath, dataUrl))
        .then(() => this.onStatus("screenshotSaved"))
        .catch((error) => {
          console.error(error);
          this.onStatus("screenshotFailed");
        })
        .finally(() => this.onBusyChange(false));
    });
  }
}
