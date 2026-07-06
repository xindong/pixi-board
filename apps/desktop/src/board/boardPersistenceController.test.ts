import { describe, expect, it, vi } from "vitest";
import { BoardPersistenceController } from "./boardPersistenceController";

describe("BoardPersistenceController", () => {
  it("debounces document saves", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      clearTimeout,
      setTimeout,
    });
    const saveBoardState = vi.fn().mockResolvedValue(undefined);
    const controller = new BoardPersistenceController({
      getNodes: () => [],
      getViewport: () => ({ scale: 1, offset: { x: 0, y: 0 } }),
      onStatus: vi.fn(),
      repository: {
        saveBoardState,
      } as never,
    });

    controller.scheduleDocumentSave();
    controller.scheduleDocumentSave();
    await vi.advanceTimersByTimeAsync(350);

    expect(saveBoardState).toHaveBeenCalledTimes(1);
    controller.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
