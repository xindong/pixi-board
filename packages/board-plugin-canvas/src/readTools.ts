import {
  asRecord,
  defineTool,
  readString,
  schema,
  type BoardTool,
} from "@pixi-board/board-plugin-sdk";
import { readProjectRoot } from "./input";
import {
  anyOutputSchema,
  nodeFilterSchema,
  objectSchema,
  projectRootSchema,
} from "./schemas";

export const canvasReadTools: BoardTool[] = [
  defineTool({
    name: "canvas.get_project_list",
    description: "List known canvas projects from the host application project registry.",
    input: objectSchema({}, []),
    output: anyOutputSchema,
    async run(_, ctx) {
      return {
        projects: await ctx.project.listKnown(),
      };
    },
  }),
  defineTool({
    name: "canvas.get_board_snapshot",
    description: "Read a compact board snapshot through the host project capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
    }),
    output: anyOutputSchema,
    async run(input, ctx) {
      return ctx.project.readSnapshot(readProjectRoot(input));
    },
  }),
  defineTool({
    name: "canvas.list_nodes",
    description: "List compact board nodes, optionally filtered by bounds or keyword.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      filter: nodeFilterSchema,
    }),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return {
        nodes: await ctx.project.listNodes(readString(args, "projectRoot"), args.filter),
      };
    },
  }),
  defineTool({
    name: "canvas.get_node",
    description: "Read compact details for one board node through the host project capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      nodeId: schema.string("Node id"),
    }, ["projectRoot", "nodeId"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return {
        node: await ctx.project.getNode(readString(args, "projectRoot"), readString(args, "nodeId")),
      };
    },
  }),
  defineTool({
    name: "canvas.read_project_info",
    description: "Read compact project info, counts, viewport, and update timestamps through the host project capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
    }),
    output: anyOutputSchema,
    async run(input, ctx) {
      return ctx.project.readInfo(readProjectRoot(input));
    },
  }),
];
