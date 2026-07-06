import {
  asRecord,
  defineTool,
  readString,
  schema,
  type BoardTool,
} from "@pixi-board/board-plugin-sdk";
import {
  readAssetUpdates,
  readCreateNodes,
  readUpdates,
} from "./input";
import {
  anyOutputSchema,
  createNodesSchema,
  objectSchema,
  projectRootSchema,
  updateAssetsSchema,
  updateNodesSchema,
} from "./schemas";

export const canvasWriteTools: BoardTool[] = [
  defineTool({
    name: "canvas.create_nodes",
    description: "Create asset-driven BoardNode entries from local files through the host board capability. Pass a file path unless kind is generating. Write text, markdown, or html content to a source file first and pass that path. Do not provide x/y; the host canvas chooses placement and returns the created node coordinates.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      nodes: createNodesSchema,
    }, ["projectRoot", "nodes"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return ctx.board.createNodes(readString(args, "projectRoot"), readCreateNodes(args.nodes));
    },
  }),
  defineTool({
    name: "canvas.generating_node_install",
    description: "Replace an existing generating placeholder node with a real local file asset through the host board capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      nodeId: schema.string("Generating board node id"),
      path: schema.string("Local file path to install into the generating node"),
    }, ["projectRoot", "nodeId", "path"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return ctx.board.installGeneratingNode(
        readString(args, "projectRoot"),
        readString(args, "nodeId"),
        readString(args, "path"),
      );
    },
  }),
  defineTool({
    name: "canvas.update_nodes",
    description: "Merge node geometry, name, and node option updates through the host board capability. Do not send text, markdown, or html content here; edit the source file for content changes.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      updates: updateNodesSchema,
    }, ["projectRoot", "updates"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return ctx.board.updateNodes(readString(args, "projectRoot"), readUpdates(args.updates));
    },
  }),
  defineTool({
    name: "canvas.update_assets",
    description: "Replace asset metadata and media dimensions through the host board capability. Do not use this to write text, markdown, or html content; edit the source file instead.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      assets: updateAssetsSchema,
    }, ["projectRoot", "assets"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return ctx.board.updateAssets(readString(args, "projectRoot"), readAssetUpdates(args.assets));
    },
  }),
  defineTool({
    name: "canvas.refresh_node_preview",
    description: "Regenerate a text, markdown, or html node preview from its source file through the host board capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      nodeId: schema.string("Text, markdown, or html board node id"),
    }, ["projectRoot", "nodeId"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return ctx.board.refreshNodePreview(readString(args, "projectRoot"), readString(args, "nodeId"));
    },
  }),
];
