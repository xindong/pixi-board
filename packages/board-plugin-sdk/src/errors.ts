import type { PluginPermission } from "./types";

export class PluginUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginUserError";
  }
}

export class PluginSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginSystemError";
  }
}

export class PluginPermissionError extends PluginUserError {
  constructor(permission: PluginPermission) {
    super(`Plugin permission required: ${permission}`);
    this.name = "PluginPermissionError";
  }
}
