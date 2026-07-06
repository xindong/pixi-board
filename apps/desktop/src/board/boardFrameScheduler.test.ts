import { describe, expect, it, vi } from "vitest";
import { BoardFrameScheduler } from "./boardFrameScheduler";

describe("BoardFrameScheduler", () => {
  it("coalesces repeated viewport sync requests into one frame", () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("window", {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancelAnimationFrame: vi.fn(),
    });

    const scene = {
      applyViewport: vi.fn(),
      syncViewport: vi.fn(),
      selection: {
        refresh: vi.fn(),
        refreshPlacement: vi.fn(),
      },
    };
    const store = {};
    const viewport = {};
    const scheduler = new BoardFrameScheduler({
      scene: scene as never,
      store: store as never,
      viewport: viewport as never,
    });

    scheduler.requestViewportSync();
    scheduler.requestViewportSync();
    scheduler.requestSelectionSync();

    expect(callbacks).toHaveLength(1);
    callbacks[0](performance.now());

    expect(scene.applyViewport).toHaveBeenCalledTimes(2);
    expect(scene.selection.refreshPlacement).toHaveBeenCalledTimes(2);
    expect(scene.syncViewport).toHaveBeenCalledTimes(1);
    expect(scene.selection.refresh).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
