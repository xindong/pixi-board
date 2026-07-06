import { schema } from "./schema";
import type { BoardPlugin, BoardTool, DefinePluginInput, DefineToolInput } from "./types";

export function definePlugin(input: DefinePluginInput): BoardPlugin {
  const tools = input.tools ?? [];
  return {
    ...input,
    register(api) {
      for (const tool of tools) {
        api.registerTool(tool);
      }
      return input.register?.(api);
    },
  };
}

export function defineTool<I = unknown, O = unknown>(input: DefineToolInput<I, O>): BoardTool<I, O> {
  return {
    ...input,
    inputSchema: input.inputSchema ?? input.input ?? schema.object({}),
    outputSchema: input.outputSchema ?? input.output ?? schema.object({}, { additionalProperties: true }),
  };
}
