import type { Asset, BoardNode } from "@pixi-board/board-domain";
import type { AssetImportCompletionEvent } from "../assets/assetImportManager";
import type { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import type { BoardStore } from "./boardStore";
import { AssetImportPatchQueue } from "./assetImportPatchQueue";
import { resolveImportPatches } from "./assetImportPatchResolver";

const IMPORT_PATCHES_PER_FRAME = 16;

type ImportSession = {
  id: number;
  controller: AbortController;
  placeholderNodes: BoardNode[];
  previousSelectionIds: string[];
};

type AssetImportSessionCoordinatorOptions = {
  editor: BoardEditor;
  store: BoardStore;
  onTransientChange: (mutation: BoardMutation) => void;
};

export type AssetImportSession = {
  id: number;
  signal: AbortSignal;
};

export type FinishedImportSession = {
  importedCount: number;
  failedCount: number;
  activeSessionCount: number;
};

export class AssetImportSessionCoordinator {
  private readonly editor: BoardEditor;
  private readonly store: BoardStore;
  private readonly onTransientChange: (mutation: BoardMutation) => void;
  private nextSessionId = 1;
  private flushFrame: number | null = null;
  private readonly sessions = new Map<number, ImportSession>();
  private readonly pendingPatches = new AssetImportPatchQueue();

  constructor(options: AssetImportSessionCoordinatorOptions) {
    this.editor = options.editor;
    this.store = options.store;
    this.onTransientChange = options.onTransientChange;
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  start(
    placeholderNodes: BoardNode[],
    previousSelectionIds: string[],
  ): AssetImportSession {
    const controller = new AbortController();
    const session: ImportSession = {
      id: this.nextSessionId++,
      controller,
      placeholderNodes,
      previousSelectionIds,
    };
    this.sessions.set(session.id, session);
    return { id: session.id, signal: controller.signal };
  }

  queueReplacement(sessionId: number, index: number, asset: Asset): void {
    const node = this.nodeForImportIndex(sessionId, index);
    if (!node) return;

    this.pendingPatches.push({
      kind: "replace",
      sessionId,
      nodeId: node.id,
      asset,
    });
    this.scheduleFlush();
  }

  queueRemoval(sessionId: number, index: number): void {
    const node = this.nodeForImportIndex(sessionId, index);
    if (!node) return;

    this.pendingPatches.push({
      kind: "remove",
      sessionId,
      nodeId: node.id,
    });
    this.scheduleFlush();
  }

  async finish(
    sessionId: number,
    completion: AssetImportCompletionEvent,
  ): Promise<FinishedImportSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.controller.signal.aborted) return null;

    await this.drainSessionPatches(sessionId);
    const nodes = session.placeholderNodes
      .map((node) => this.store.getNode(node.id))
      .filter((node): node is BoardNode => Boolean(node));
    const mutation = this.editor.commitInsertedNodes(nodes, session.previousSelectionIds, {
      label: "Import media",
    });
    if (mutation) {
      this.onTransientChange(mutation);
    }
    this.sessions.delete(sessionId);

    return {
      importedCount: completion.importedCount,
      failedCount: completion.failedCount,
      activeSessionCount: this.sessions.size,
    };
  }

  fail(sessionId: number): number | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.controller.abort();
    this.sessions.delete(sessionId);
    this.pendingPatches.removeSession(sessionId);
    const mutation = this.editor.removeNodesByIdTransient(
      session.placeholderNodes.map((node) => node.id),
    );
    if (mutation) {
      this.onTransientChange(mutation);
    }
    return this.sessions.size;
  }

  abortAll(): void {
    for (const session of this.sessions.values()) {
      session.controller.abort();
    }
    this.sessions.clear();
    this.pendingPatches.clear();
    if (this.flushFrame !== null) {
      window.cancelAnimationFrame(this.flushFrame);
      this.flushFrame = null;
    }
  }

  private nodeForImportIndex(sessionId: number, index: number): BoardNode | undefined {
    const session = this.sessions.get(sessionId);
    const node = session?.placeholderNodes[index];
    if (!session || session.controller.signal.aborted) return undefined;
    return node;
  }

  private scheduleFlush(): void {
    if (this.flushFrame !== null) return;

    this.flushFrame = window.requestAnimationFrame(() => {
      this.flushFrame = null;
      this.flush(IMPORT_PATCHES_PER_FRAME);
      if (this.pendingPatches.length > 0) {
        this.scheduleFlush();
      }
    });
  }

  private flush(limit: number, sessionId?: number): void {
    const patches = this.pendingPatches.take(limit, sessionId);
    if (patches.length === 0) return;

    const resolved = resolveImportPatches(patches, {
      isSessionActive: (patchSessionId) => this.sessions.has(patchSessionId),
      store: this.store,
    });

    const replaceMutation = this.editor.replaceNodeAssetsTransient(resolved.replacements);
    const removeMutation = this.editor.removeNodesByIdTransient(resolved.removals);
    if (replaceMutation || removeMutation) {
      if (replaceMutation) this.onTransientChange(replaceMutation);
      if (removeMutation) this.onTransientChange(removeMutation);
    }
  }

  private async drainSessionPatches(sessionId: number): Promise<void> {
    while (this.pendingPatches.hasSession(sessionId)) {
      await nextAnimationFrame();
      this.flush(IMPORT_PATCHES_PER_FRAME, sessionId);
    }
  }
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
