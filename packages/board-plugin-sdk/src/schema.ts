import type { JSONSchema } from "./types";

export const schema = {
  object(properties: Record<string, unknown>, options: { required?: string[]; additionalProperties?: boolean } = {}): JSONSchema {
    return {
      type: "object",
      additionalProperties: options.additionalProperties ?? false,
      required: options.required ?? [],
      properties,
    };
  },
  array(items: JSONSchema, options: { minItems?: number } = {}): JSONSchema {
    return {
      type: "array",
      items,
      ...(options.minItems !== undefined ? { minItems: options.minItems } : {}),
    };
  },
  string(description?: string): JSONSchema {
    return {
      type: "string",
      ...(description ? { description } : {}),
    };
  },
  number(description?: string): JSONSchema {
    return {
      type: "number",
      ...(description ? { description } : {}),
    };
  },
  boolean(description?: string): JSONSchema {
    return {
      type: "boolean",
      ...(description ? { description } : {}),
    };
  },
  enum<const T extends readonly (string | number | boolean)[]>(values: T, description?: string): JSONSchema {
    return {
      enum: [...values],
      ...(description ? { description } : {}),
    };
  },
  anyObject(): JSONSchema {
    return {
      type: "object",
      additionalProperties: true,
    };
  },
};
