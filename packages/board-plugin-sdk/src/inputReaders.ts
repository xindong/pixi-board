import { PluginUserError } from "./errors";

export function asRecord(input: unknown, label = "input"): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PluginUserError(`${label} must be an object`);
  }
  return input as Record<string, unknown>;
}

export function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new PluginUserError(`${key} must be a non-empty string`);
  }
  return value;
}

export function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new PluginUserError(`${key} must be a non-empty string`);
  }
  return value;
}

export function readOptionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PluginUserError(`${key} must be a finite number`);
  }
  return value;
}

export function readOptionalEnum<const T extends readonly (string | number | boolean)[]>(
  input: Record<string, unknown>,
  key: string,
  values: T,
): T[number] | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (!(values as readonly unknown[]).includes(value)) {
    throw new PluginUserError(`${key} must be one of ${values.join(", ")}`);
  }
  return value as T[number];
}
