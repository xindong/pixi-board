import type { FederatedPointerEvent } from "../../pixi";
import type { BoardEditor } from "../boardEditor";
import type { BoardMutation } from "../boardHistory";
import type { BoardScene } from "../boardScene";
import type { ResizeHandleCorner } from "../boardScene";
import type { BoardStore } from "../boardStore";
import type { BoardViewport } from "../boardViewport";

export type ToolContext = {
  editor: BoardEditor;
  store: BoardStore;
  scene: BoardScene;
  viewport: BoardViewport;
  emitMutation: (mutation: BoardMutation | null) => void;
  requestSelectionSync: () => void;
};

export interface BoardTool {
  readonly id: string;
  readonly cursor?: string;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  onNodePointerDown?(event: FederatedPointerEvent, nodeId: string, ctx: ToolContext): void;
  onStagePointerDown?(event: FederatedPointerEvent, ctx: ToolContext): void;
  onGlobalPointerMove?(event: FederatedPointerEvent, ctx: ToolContext): void;
  onGlobalPointerUp?(event: FederatedPointerEvent, ctx: ToolContext): void;
  onResizeHandlePointerDown?(
    event: FederatedPointerEvent,
    corner: ResizeHandleCorner,
    ctx: ToolContext,
  ): void;
}
