import type { McpWriteCommand, McpWriteCommandResult } from "@pixi-board/mcp-protocol";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { McpUserError, errorMessage } from "./errors";
import { resolveProjectFiles } from "./reader";

type BridgeEndpoint = {
  version: 1;
  host: string;
  port: number;
  token: string;
  updatedAt: number;
};

type BridgeResponse =
  | { ok: true; data: McpWriteCommandResult }
  | { ok: false; error: string };

const BRIDGE_FILE = ".canvas-mcp-bridge.json";
const CONNECT_TIMEOUT_MS = 1_500;
const RESPONSE_TIMEOUT_MS = 30_000;

export async function sendWriteCommand(command: McpWriteCommand): Promise<McpWriteCommandResult> {
  const files = await resolveProjectFiles(command.projectRoot);
  const endpoint = await readBridgeEndpoint(files.root);
  const response = await sendJsonLine(endpoint, {
    token: endpoint.token,
    request: {
      ...command,
      projectRoot: files.root,
    },
  });
  if (!response.ok) {
    throw new McpUserError(response.error);
  }
  return response.data;
}

async function readBridgeEndpoint(projectRoot: string): Promise<BridgeEndpoint> {
  const bridgePath = path.join(projectRoot, BRIDGE_FILE);
  let value: unknown;
  try {
    value = JSON.parse(await fs.readFile(bridgePath, "utf8"));
  } catch (error) {
    throw new McpUserError(
      `Desktop app is not available for writes: cannot read ${BRIDGE_FILE} in ${projectRoot}. Start the desktop app and open this project. Details: ${errorMessage(error)}`,
    );
  }
  if (!isEndpoint(value)) {
    throw new McpUserError(`Desktop app bridge file is invalid: ${bridgePath}`);
  }
  return value;
}

function sendJsonLine(endpoint: BridgeEndpoint, payload: unknown): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
    let buffer = "";
    let settled = false;
    const connectTimer = setTimeout(() => {
      socket.destroy();
      reject(new McpUserError("Desktop app is not available for writes: bridge connection timed out"));
    }, CONNECT_TIMEOUT_MS);
    const responseTimer = setTimeout(() => {
      socket.destroy();
      reject(new McpUserError("Desktop app did not finish the write command before the timeout"));
    }, RESPONSE_TIMEOUT_MS);

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      clearTimeout(responseTimer);
      fn();
    };

    socket.setEncoding("utf8");
    socket.on("connect", () => {
      clearTimeout(connectTimer);
      socket.write(`${JSON.stringify(payload)}\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      settle(() => {
        socket.end();
        try {
          const parsed = JSON.parse(line);
          if (isBridgeResponse(parsed)) {
            resolve(parsed);
          } else {
            reject(new McpUserError("Desktop app returned an invalid bridge response"));
          }
        } catch (error) {
          reject(new McpUserError(`Desktop app returned invalid JSON: ${errorMessage(error)}`));
        }
      });
    });
    socket.on("error", (error) => {
      settle(() => {
        reject(
          new McpUserError(
            `Desktop app is not available for writes: failed to connect to bridge ${endpoint.host}:${endpoint.port}. Details: ${error.message}`,
          ),
        );
      });
    });
    socket.on("close", () => {
      if (settled) return;
      settle(() => {
        reject(new McpUserError("Desktop app bridge closed before returning a write result"));
      });
    });
  });
}

function isEndpoint(value: unknown): value is BridgeEndpoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const endpoint = value as Partial<BridgeEndpoint>;
  return (
    endpoint.version === 1 &&
    endpoint.host === "127.0.0.1" &&
    typeof endpoint.port === "number" &&
    Number.isInteger(endpoint.port) &&
    endpoint.port > 0 &&
    typeof endpoint.token === "string" &&
    endpoint.token.length > 0 &&
    typeof endpoint.updatedAt === "number"
  );
}

function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Partial<BridgeResponse>;
  if (response.ok === true) return typeof response.data === "object" && response.data !== null;
  if (response.ok === false) return typeof response.error === "string";
  return false;
}
