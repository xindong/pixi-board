import type { BoardEditor } from "./boardEditor";
import type { BoardFrameScheduler } from "./boardFrameScheduler";
import type { BoardScene } from "./boardScene";

type NodeLabelDoubleClickOptions = {
  editor: BoardEditor;
  event: MouseEvent;
  frameScheduler: BoardFrameScheduler;
  onNodeDoubleClick?: (nodeId: string) => void;
  scene: BoardScene;
};

export function handleNodeLabelDoubleClick(options: NodeLabelDoubleClickOptions): void {
  const { editor, event, frameScheduler, onNodeDoubleClick, scene } = options;
  if (!onNodeDoubleClick) return;

  const rect = scene.canvas.getBoundingClientRect();
  const screen = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  const nodeId = scene.labels.hitTest(screen);
  if (!nodeId) return;

  event.preventDefault();
  event.stopPropagation();
  editor.selectOnly([nodeId]);
  frameScheduler.requestSelectionSync();
  onNodeDoubleClick(nodeId);
}
