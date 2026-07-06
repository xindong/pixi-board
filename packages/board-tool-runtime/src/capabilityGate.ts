import type { PluginPermission } from "@pixi-board/board-plugin-sdk";
import { PluginPermissionError, PluginUserError } from "@pixi-board/board-plugin-sdk";

export function permissionGate<T extends object>(
  capability: T | undefined,
  permission: PluginPermission,
  permissions: Set<PluginPermission>,
  label: string,
): T {
  if (!permissions.has(permission)) {
    return missingCapabilityProxy(permission) as T;
  }
  if (!capability) {
    return unavailableCapabilityProxy(label) as T;
  }
  return capability;
}

export function permissionGateMethod<T extends object, K extends keyof T & string>(
  capability: T | undefined,
  method: K,
  permission: PluginPermission,
  permissions: Set<PluginPermission>,
  label: string,
): T[K] {
  if (!permissions.has(permission)) {
    return (() => {
      throw new PluginPermissionError(permission);
    }) as T[K];
  }
  if (!capability || typeof capability[method] !== "function") {
    return (() => {
      throw new PluginUserError(`Host capability is unavailable: ${label}.${method}`);
    }) as T[K];
  }
  return capability[method].bind(capability) as T[K];
}

function missingCapabilityProxy(permission: PluginPermission): object {
  return new Proxy({}, {
    get() {
      return () => {
        throw new PluginPermissionError(permission);
      };
    },
  });
}

function unavailableCapabilityProxy(label: string): object {
  return new Proxy({}, {
    get(_, property) {
      return () => {
        throw new PluginUserError(`Host capability is unavailable: ${label}.${String(property)}`);
      };
    },
  });
}
