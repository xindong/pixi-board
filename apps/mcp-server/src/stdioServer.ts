import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline";
import { errorMessage } from "./errors";
import { dispatchMcpRequest } from "./mcpDispatcher";
import type { JsonRpcRequest, JsonRpcResponse } from "./jsonRpc";

export function startStdioServer(): Interface {
  const rl = createInterface({
    input: stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", (line) => {
    void handleLine(line);
  });

  return rl;
}

async function handleLine(line: string): Promise<void> {
  if (!line.trim()) return;
  let request: JsonRpcRequest;
  try {
    request = JSON.parse(line) as JsonRpcRequest;
  } catch {
    writeResponse({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
    return;
  }

  if (request.id === undefined) {
    return;
  }

  try {
    const result = await dispatchMcpRequest(request);
    writeResponse({
      jsonrpc: "2.0",
      id: request.id ?? null,
      result,
    });
  } catch (error) {
    writeResponse({
      jsonrpc: "2.0",
      id: request.id ?? null,
      error: {
        code: -32000,
        message: errorMessage(error),
      },
    });
  }
}

function writeResponse(response: JsonRpcResponse): void {
  stdout.write(`${JSON.stringify(response)}\n`);
}
