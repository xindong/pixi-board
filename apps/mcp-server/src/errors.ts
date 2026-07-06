export class McpUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpUserError";
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
