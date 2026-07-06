import { schema, type JSONSchema } from "@pixi-board/board-plugin-sdk";
import {
  ASSET_KIND_VALUES,
  MODEL_FORMAT_VALUES,
  NODE_TYPE_VALUES,
} from "./input";

export const PROJECT_ROOT_DESCRIPTION = 'Canvas project root absolute path, or "active" for the current canvas';
export const anyOutputSchema = schema.anyObject();

export function objectSchema(properties: Record<string, unknown>, required = ["projectRoot"]): JSONSchema {
  return schema.object(properties, { required });
}

export const projectRootSchema = schema.string(PROJECT_ROOT_DESCRIPTION);

export const nodeFilterSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    type: { type: "string", enum: NODE_TYPE_VALUES },
    keyword: { type: "string" },
    name: { type: "string" },
    text: { type: "string" },
    bounds: {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        minX: { type: "number" },
        minY: { type: "number" },
        maxX: { type: "number" },
        maxY: { type: "number" },
      },
    },
  },
};

export const createNodesSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    additionalProperties: true,
    properties: {
      path: { type: "string" },
      kind: {
        type: "string",
        description: "Optional compatibility hint. Use generating to create a lightweight placeholder without a path; otherwise the host importer determines the actual asset kind from the file.",
        enum: ASSET_KIND_VALUES,
      },
      width: { type: "number" },
      height: { type: "number" },
      options: {
        type: "object",
        description: "Renderer parameters only. Do not put text, markdown, or html document content here.",
        additionalProperties: true,
      },
      name: { type: "string" },
    },
  },
};

export const updateNodesSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    additionalProperties: true,
    required: ["id"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      options: {
        type: "object",
        description: "Renderer parameters only. Do not put text, markdown, or html document content here.",
        additionalProperties: true,
      },
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      rotation: { type: "number" },
      zIndex: { type: "number" },
      locked: { type: "boolean" },
    },
  },
};

export const updateAssetsSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    additionalProperties: true,
    required: ["id"],
    properties: {
      id: { type: "string" },
      metadata: { type: "object", additionalProperties: true },
      width: { type: "number" },
      height: { type: "number" },
      duration: { type: "number" },
      format: {
        type: "string",
        enum: MODEL_FORMAT_VALUES,
      },
    },
  },
};
