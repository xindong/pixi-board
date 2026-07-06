import type { PluginContext } from "@pixi-board/board-plugin-sdk";

export function createInMemoryJobs(): NonNullable<PluginContext["jobs"]> {
  const jobs = new Map<string, unknown>();
  return {
    async create(input) {
      const id = `job-${Date.now()}-${jobs.size + 1}`;
      jobs.set(id, { ...input, status: "running", progress: 0 });
      return { id };
    },
    async updateProgress(id, progress, message) {
      jobs.set(id, { ...(jobs.get(id) as object), status: "running", progress, message });
    },
    async fail(id, error) {
      jobs.set(id, { ...(jobs.get(id) as object), status: "failed", error });
    },
    async complete(id, result) {
      jobs.set(id, { ...(jobs.get(id) as object), status: "completed", result });
    },
  };
}

export function createInMemoryStorage(): NonNullable<PluginContext["storage"]> {
  const values = new Map<string, unknown>();
  return {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
  };
}
