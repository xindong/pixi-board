import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";

const BRIDGE_FILE = ".canvas-mcp-bridge.json";
const BRIDGE_CONNECT_TIMEOUT_MS = 250;

type BridgeEndpoint = {
  version: number;
  host: string;
  port: number;
  token: string;
  updatedAt: number;
};

export async function isBridgeAvailable(projectRoot: string): Promise<boolean> {
  const bridgePath = path.join(projectRoot, BRIDGE_FILE);
  let value: unknown;
  try {
    value = JSON.parse(await fs.readFile(bridgePath, "utf8"));
  } catch {
    return false;
  }
  if (!isEndpoint(value)) return false;
  return canConnectToBridge(value.host, value.port);
}

function canConnectToBridge(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => settle(false), BRIDGE_CONNECT_TIMEOUT_MS);

    socket.once("connect", () => {
      clearTimeout(timer);
      settle(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      settle(false);
    });
    socket.once("close", () => {
      clearTimeout(timer);
      settle(false);
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
