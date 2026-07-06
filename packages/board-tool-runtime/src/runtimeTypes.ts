import type { PluginContext } from "@pixi-board/board-plugin-sdk";

export type BoardHostCapabilities = Partial<Omit<PluginContext, "tools" | "env" | "signal">>;

export type BoardToolRuntimeOptions = {
  capabilities?: BoardHostCapabilities;
  envByPlugin?: Record<string, Record<string, string | undefined>>;
  signal?: AbortSignal;
};
