import type { BoardFrameScheduler } from "./boardFrameScheduler";
import type { BoardScene } from "./boardScene";
import type { BoardViewport } from "./boardViewport";

type BoardViewportWheelOptions = {
  event: WheelEvent;
  frameScheduler: BoardFrameScheduler;
  onViewportChange?: () => void;
  scene: BoardScene;
  viewport: BoardViewport;
};

export function handleBoardViewportWheel(options: BoardViewportWheelOptions): void {
  const { event, frameScheduler, onViewportChange, scene, viewport } = options;
  event.preventDefault();

  const rect = scene.canvas.getBoundingClientRect();
  const screen = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  if (event.ctrlKey || event.metaKey) {
    viewport.zoomAt(screen, event.deltaY);
  } else {
    viewport.panBy(-event.deltaX, -event.deltaY);
  }

  frameScheduler.requestViewportSync();
  onViewportChange?.();
}
