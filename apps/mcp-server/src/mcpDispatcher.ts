import { callTool, toolDefinitions } from "./tools";
import { readObject, type JsonRpcRequest } from "./jsonRpc";

const serverInfo = {
  name: "canvas-mcp-server",
  version: "0.1.0",
};

export async function dispatchMcpRequest(request: JsonRpcRequest): Promise<unknown> {
  switch (request.method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo,
      };
    case "tools/list":
      return {
        tools: toolDefinitions,
      };
    case "tools/call": {
      const params = readObject(request.params);
      const name = params.name;
      if (typeof name !== "string") {
        throw new Error("tools/call params.name must be a string");
      }
      const result = await callTool(name, params.arguments ?? {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
    case "ping":
      return {};
    default:
      throw new Error(`Unsupported method: ${request.method ?? "missing"}`);
  }
}
