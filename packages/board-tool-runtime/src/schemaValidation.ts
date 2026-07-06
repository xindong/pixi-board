import type { JSONSchema } from "@pixi-board/board-plugin-sdk";

export function validateSchema(schema: JSONSchema, value: unknown, label: string): void {
  const type = schema.type;
  if (type === "object") {
    validateObjectSchema(schema, value, label);
    return;
  }
  if (type === "array") {
    validateArraySchema(schema, value, label);
    return;
  }
  if (type === "string" && typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`${label} must be a finite number`);
  }
  if (type === "boolean" && typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
}

function validateObjectSchema(schema: JSONSchema, value: unknown, label: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (typeof key === "string" && record[key] === undefined) {
      throw new Error(`${label}.${key} is required`);
    }
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) {
      if (!(key in properties)) {
        throw new Error(`${label}.${key} is not supported`);
      }
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (record[key] !== undefined && isRecord(propertySchema)) {
      validateEnum(propertySchema, record[key], `${label}.${key}`);
      validateSchema(propertySchema, record[key], `${label}.${key}`);
    }
  }
}

function validateArraySchema(schema: JSONSchema, value: unknown, label: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  if (typeof schema.minItems === "number" && value.length < schema.minItems) {
    throw new Error(`${label} must contain at least ${schema.minItems} item(s)`);
  }
  if (isRecord(schema.items)) {
    value.forEach((item, index) => {
      validateSchema(schema.items as JSONSchema, item, `${label}[${index}]`);
    });
  }
}

function validateEnum(schema: JSONSchema, value: unknown, label: string): void {
  if (!Array.isArray(schema.enum)) return;
  if (!schema.enum.includes(value)) {
    throw new Error(`${label} must be one of ${schema.enum.join(", ")}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
