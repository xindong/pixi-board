import {
  asRecord,
  defineTool,
  readString,
  schema,
  type BoardTool,
} from "@pixi-board/board-plugin-sdk";
import {
  anyOutputSchema,
  objectSchema,
  projectRootSchema,
} from "./schemas";

export const canvasAssetTools: BoardTool[] = [
  defineTool({
    name: "canvas.get_origin_asset_by_node",
    description: "Return original asset information for a file-backed board node through the host asset capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      nodeId: schema.string("Board node id"),
    }, ["projectRoot", "nodeId"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return ctx.assets.getOriginByNode(readString(args, "projectRoot"), readString(args, "nodeId"));
    },
  }),
  defineTool({
    name: "canvas.get_asset",
    description: "Return compact asset details including original, derivatives, and metadata through the host asset capability.",
    input: objectSchema({
      projectRoot: projectRootSchema,
      assetId: schema.string("Asset id"),
    }, ["projectRoot", "assetId"]),
    output: anyOutputSchema,
    async run(input, ctx) {
      const args = asRecord(input);
      return {
        asset: await ctx.assets.get(readString(args, "projectRoot"), readString(args, "assetId")),
      };
    },
  }),
];
