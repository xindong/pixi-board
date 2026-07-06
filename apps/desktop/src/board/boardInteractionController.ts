import type { FederatedPointerEvent } from "../pixi";
import { BoardEditor } from "./boardEditor";
import type { BoardMutation } from "./boardHistory";
import { BoardScene, type ResizeHandleCorner } from "./boardScene";
import { BoardStore } from "./boardStore";
import { BoardViewport } from "./boardViewport";
import type { BoardFrameScheduler } from "./boardFrameScheduler";
import { BoardHotkeyController } from "./boardHotkeyController";
import { handleBoardViewportWheel } from "./boardViewportWheel";
import { handleNodeLabelDoubleClick } from "./nodeLabelDoubleClick";
import type { BoardTool, ToolContext } from "./tools/boardTool";
import { SelectTool } from "./tools/selectTool";

type BoardInteractionControllerOptions = {
  editor: BoardEditor;
  onNodeDoubleClick?: (nodeId: string) => void;
  onDeleteSelection?: () => boolean;
  onMutation: (mutation: BoardMutation) => void;
  scene: BoardScene;
  store: BoardStore;
  onViewportChange?: () => void;
  frameScheduler: BoardFrameScheduler;
  viewport: BoardViewport;
};

export class BoardInteractionController {
  private readonly editor: BoardEditor;
  private readonly onNodeDoubleClick: BoardInteractionControllerOptions["onNodeDoubleClick"];
  private readonly onMutation: BoardInteractionControllerOptions["onMutation"];
  private readonly onViewportChange: BoardInteractionControllerOptions["onViewportChange"];
  private readonly scene: BoardScene;
  private readonly frameScheduler: BoardFrameScheduler;
  private readonly store: BoardStore;
  private readonly viewport: BoardViewport;
  private readonly hotkeys: BoardHotkeyController;
  private readonly tools = new Map<string, BoardTool>();
  private activeTool: BoardTool;

  constructor(options: BoardInteractionControllerOptions) {
    this.editor = options.editor;
    this.onNodeDoubleClick = options.onNodeDoubleClick;
    this.onMutation = options.onMutation;
    this.onViewportChange = options.onViewportChange;
    this.scene = options.scene;
    this.frameScheduler = options.frameScheduler;
    this.store = options.store;
    this.viewport = options.viewport;

    const select = new SelectTool();
    this.tools.set(select.id, select);
    this.activeTool = select;
    this.hotkeys = new BoardHotkeyController({
      editor: this.editor,
      onDeleteSelection: options.onDeleteSelection,
      onMutation: this.onMutation,
      setActiveTool: (id) => this.setActiveTool(id),
      store: this.store,
      hasTool: (id) => this.tools.has(id),
    });
  }

  attach(): void {
    this.scene.canvas.addEventListener("wheel", this.handleViewportWheel, { passive: false });
    this.scene.canvas.addEventListener("dblclick", this.handleDoubleClick);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.handleWindowResize);
    this.scene.stage.on("pointerdown", this.handleStagePointerDown);
    this.scene.stage.on("globalpointermove", this.handleGlobalPointerMove);
    this.scene.stage.on("pointerup", this.handleGlobalPointerUp);
    this.scene.stage.on("pointerupoutside", this.handleGlobalPointerUp);

    this.activeTool.onActivate?.(this.context());
    this.applyToolCursor();
  }

  detach(): void {
    this.scene.canvas.removeEventListener("wheel", this.handleViewportWheel);
    this.scene.canvas.removeEventListener("dblclick", this.handleDoubleClick);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.handleWindowResize);
    this.scene.stage.off("pointerdown", this.handleStagePointerDown);
    this.scene.stage.off("globalpointermove", this.handleGlobalPointerMove);
    this.scene.stage.off("pointerup", this.handleGlobalPointerUp);
    this.scene.stage.off("pointerupoutside", this.handleGlobalPointerUp);

    this.activeTool.onDeactivate?.(this.context());
  }

  setActiveTool(id: string): void {
    const next = this.tools.get(id);
    if (!next || next === this.activeTool) return;

    this.activeTool.onDeactivate?.(this.context());
    this.activeTool = next;
    this.activeTool.onActivate?.(this.context());
    this.applyToolCursor();
  }

  handleNodePointerDown = (event: FederatedPointerEvent, nodeId: string): void => {
    this.activeTool.onNodePointerDown?.(event, nodeId, this.context());
  };

  handleResizeHandlePointerDown = (
    event: FederatedPointerEvent,
    corner: ResizeHandleCorner,
  ): void => {
    this.activeTool.onResizeHandlePointerDown?.(event, corner, this.context());
  };

  handleViewportWheel = (event: WheelEvent): void => {
    handleBoardViewportWheel({
      event,
      frameScheduler: this.frameScheduler,
      onViewportChange: this.onViewportChange,
      scene: this.scene,
      viewport: this.viewport,
    });
  };

  private context(): ToolContext {
    return {
      editor: this.editor,
      store: this.store,
      scene: this.scene,
      viewport: this.viewport,
      emitMutation: (mutation) => {
        if (mutation) this.onMutation(mutation);
      },
      requestSelectionSync: () => this.frameScheduler.requestSelectionSync(),
    };
  }

  private applyToolCursor(): void {
    this.scene.canvas.style.cursor = this.activeTool.cursor ?? "default";
  }

  private readonly handleWindowResize = () => {
    this.scene.handleResize();
    this.frameScheduler.requestViewportSync();
  };

  private readonly handleDoubleClick = (event: MouseEvent) => {
    handleNodeLabelDoubleClick({
      editor: this.editor,
      event,
      frameScheduler: this.frameScheduler,
      onNodeDoubleClick: this.onNodeDoubleClick,
      scene: this.scene,
    });
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    this.hotkeys.handle(event);
  };

  private readonly handleStagePointerDown = (event: FederatedPointerEvent) => {
    this.activeTool.onStagePointerDown?.(event, this.context());
  };

  private readonly handleGlobalPointerMove = (event: FederatedPointerEvent) => {
    this.activeTool.onGlobalPointerMove?.(event, this.context());
  };

  private readonly handleGlobalPointerUp = (event: FederatedPointerEvent) => {
    this.activeTool.onGlobalPointerUp?.(event, this.context());
  };

}
