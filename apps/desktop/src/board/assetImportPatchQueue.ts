import type { Asset } from "@pixi-board/board-domain";

export type ImportPatch =
  | {
      kind: "replace";
      sessionId: number;
      nodeId: string;
      asset: Asset;
    }
  | {
      kind: "remove";
      sessionId: number;
      nodeId: string;
    };

export class AssetImportPatchQueue {
  private readonly patches: ImportPatch[] = [];

  get length(): number {
    return this.patches.length;
  }

  push(patch: ImportPatch): void {
    this.patches.push(patch);
  }

  clear(): void {
    this.patches.length = 0;
  }

  hasSession(sessionId: number): boolean {
    return this.patches.some((patch) => patch.sessionId === sessionId);
  }

  take(limit: number, sessionId?: number): ImportPatch[] {
    const patches: ImportPatch[] = [];
    while (patches.length < limit && this.patches.length > 0) {
      const index =
        sessionId === undefined
          ? 0
          : this.patches.findIndex((patch) => patch.sessionId === sessionId);
      if (index < 0) break;
      const [patch] = this.patches.splice(index, 1);
      patches.push(patch);
    }
    return patches;
  }

  removeSession(sessionId: number): void {
    for (let index = this.patches.length - 1; index >= 0; index--) {
      if (this.patches[index].sessionId === sessionId) {
        this.patches.splice(index, 1);
      }
    }
  }
}
