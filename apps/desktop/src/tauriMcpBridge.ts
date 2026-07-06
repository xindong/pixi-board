import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { McpWriteCommand, McpWriteCommandResult } from "@pixi-board/mcp-protocol";
import { isTauriRuntime } from "./runtime/runtimeEnvironment";

export type McpWriteCommandEvent = {
  requestId: string;
  request: McpWriteCommand;
};

export async function publishMcpBridge(projectRoot: string): Promise<void> {
  await invoke("publish_mcp_bridge", { projectRoot });
}

export async function completeMcpWriteCommand(
  requestId: string,
  result: { ok: true; data: McpWriteCommandResult } | { ok: false; error: string },
): Promise<void> {
  await invoke("complete_mcp_write_command", {
    requestId,
    response: result.ok
      ? {
          ok: true,
          data: result.data,
        }
      : {
          ok: false,
          error: result.error,
        },
  });
}

export async function listenForMcpWriteCommands(
  onCommand: (command: McpWriteCommand) => Promise<McpWriteCommandResult>,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => {};

  return listen<McpWriteCommandEvent>("mcp-write-command", async (event) => {
    try {
      const data = await onCommand(event.payload.request);
      await completeMcpWriteCommand(event.payload.requestId, {
        ok: true,
        data,
      });
    } catch (error) {
      console.error(error);
      await completeMcpWriteCommand(event.payload.requestId, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
