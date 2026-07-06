import { BrowserBoardRepository } from "./storage/browserBoardRepository";
import type { BoardRepository } from "./storage/boardRepository";

type TauriBridge = typeof import("./tauriBridge");

export type WhiteboardRuntimeAdapter = {
  bridge: TauriBridge | null;
  initialRepository: BoardRepository;
  createRepository(projectRoot: string): BoardRepository;
  pickImportPaths?: () => Promise<string[]>;
  listenForDrops?: (onDrop: (paths: string[]) => void) => Promise<() => void>;
};

export function createBrowserRuntimeAdapter(): WhiteboardRuntimeAdapter {
  const repository = new BrowserBoardRepository();
  return {
    bridge: null,
    initialRepository: repository,
    createRepository: () => repository,
  };
}

export async function createTauriRuntimeAdapter(): Promise<WhiteboardRuntimeAdapter> {
  const [{ TauriBoardRepository }, bridge] = await Promise.all([
    import("./storage/tauriBoardRepository"),
    import("./tauriBridge"),
  ]);
  return {
    bridge,
    initialRepository: new BrowserBoardRepository(),
    createRepository: (projectRoot) => new TauriBoardRepository({ projectRoot }),
    pickImportPaths: bridge.openMediaDialog,
    listenForDrops: bridge.listenForDroppedFiles,
  };
}
