import os from "node:os";
import path from "node:path";
import { McpUserError } from "./errors";

const APP_IDENTIFIER = "com.xindong.pixi-board";

export type ProjectOptions = {
  appRoot?: string;
};

export function resolveAppRoot(options?: ProjectOptions): string {
  if (options?.appRoot) {
    return path.resolve(options.appRoot);
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_IDENTIFIER);
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new McpUserError("APPDATA is not set; cannot resolve the desktop app project root");
    }
    return path.join(appData, APP_IDENTIFIER);
  }

  const baseDir = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(baseDir, APP_IDENTIFIER);
}
