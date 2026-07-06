import type { FederatedPointerEvent } from "../../pixi";
import { boundsForItems, nodeBounds, normalizeBounds, type Point } from "@pixi-board/board-domain";
import type { NodeBounds } from "../boardStore";
import type { ResizeHandleCorner } from "../boardScene";
import type { BoardTool, ToolContext } from "./boardTool";
import { resolveMarqueeSelection, type MarqueeSelectionState } from "./marqueeSelection";
import {
  oppositeResizeAnchor,
  resizeBoundsFromPointer,
  type SelectionResizeBox,
} from "./selectionResizeGeometry";

type DragState =
  | {
      kind: "nodes";
      pointerStart: Point;
      startPositions: Map<string, Point>;
      moved: boolean;
    }
  | ({ kind: "selection" } & MarqueeSelectionState)
  | {
      kind: "resize";
      corner: ResizeHandleCorner;
      anchor: Point;
      bboxBefore: SelectionResizeBox;
      beforeBounds: Map<string, NodeBounds>;
      moved: boolean;
    };

export class SelectTool implements BoardTool {
  readonly id = "select";
  readonly cursor = "default";
  private dragState: DragState | null = null;

  onDeactivate(): void {
    this.dragState = null;
  }

  onResizeHandlePointerDown(
    event: FederatedPointerEvent,
    corner: ResizeHandleCorner,
    ctx: ToolContext,
  ): void {
    if (event.button !== 0) return;
    const selectedIds = [...ctx.store.selectedIds].filter((id) => Boolean(ctx.store.getNode(id)));
    if (selectedIds.length === 0) return;

    const beforeBounds = ctx.store.snapshotNodeBounds(selectedIds);
    const items = selectedIds
      .map((id) => ctx.store.getNode(id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
      .map(nodeBounds);
    const bbox = boundsForItems("selection-resize", items);
    if (!bbox) return;

    const anchor = oppositeResizeAnchor(corner, bbox);
    this.dragState = {
      kind: "resize",
      corner,
      anchor,
      bboxBefore: bbox,
      beforeBounds,
      moved: false,
    };
  }

  onNodePointerDown(event: FederatedPointerEvent, nodeId: string, ctx: ToolContext): void {
    event.stopPropagation();
    const node = ctx.store.getNode(nodeId);
    if (!node || event.button !== 0) return;

    if (event.shiftKey || event.metaKey) {
      ctx.editor.toggleSelection(nodeId);
    } else if (!ctx.store.selectedIds.has(nodeId)) {
      ctx.editor.selectOnly([nodeId]);
    }

    const startPositions = new Map<string, Point>();
    for (const id of ctx.store.selectedIds) {
      const selectedNode = ctx.store.getNode(id);
      if (selectedNode) {
        startPositions.set(id, { x: selectedNode.x, y: selectedNode.y });
      }
    }

    this.dragState = {
      kind: "nodes",
      pointerStart: { x: event.global.x, y: event.global.y },
      startPositions,
      moved: false,
    };
    ctx.requestSelectionSync();
  }

  onStagePointerDown(event: FederatedPointerEvent, ctx: ToolContext): void {
    if (event.button !== 0 || event.target !== ctx.scene.stage) return;

    const worldPoint = ctx.viewport.screenToWorld(event.global);
    this.dragState = {
      kind: "selection",
      start: worldPoint,
      current: worldPoint,
      additive: event.shiftKey || event.metaKey,
    };
    ctx.scene.selection.setMarquee(
      normalizeBounds(worldPoint, worldPoint, "marquee"),
      ctx.viewport.scale,
    );
  }

  onGlobalPointerMove(event: FederatedPointerEvent, ctx: ToolContext): void {
    if (!this.dragState) return;

    if (this.dragState.kind === "resize") {
      const pointerWorld = ctx.viewport.screenToWorld(event.global);
      const { anchor, bboxBefore, beforeBounds } = this.dragState;
      const nextBounds = resizeBoundsFromPointer({
        anchor,
        bboxBefore,
        beforeBounds,
        corner: this.dragState.corner,
        pointerWorld,
      });

      this.dragState.moved = true;
      ctx.store.setNodeBounds(nextBounds);
      for (const id of nextBounds.keys()) {
        const node = ctx.store.getNode(id);
        if (!node) continue;
        ctx.scene.updateNodeTransform(node);
      }
      ctx.scene.selection.refresh(ctx.store, ctx.viewport.scale);
      return;
    }

    if (this.dragState.kind === "nodes") {
      const dx = (event.global.x - this.dragState.pointerStart.x) / ctx.viewport.scale;
      const dy = (event.global.y - this.dragState.pointerStart.y) / ctx.viewport.scale;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this.dragState.moved = true;
      }

      const nextPositions = new Map<string, Point>();
      for (const [id, start] of this.dragState.startPositions.entries()) {
        nextPositions.set(id, { x: start.x + dx, y: start.y + dy });
      }
      ctx.store.setNodePositions(nextPositions);

      for (const id of nextPositions.keys()) {
        const node = ctx.store.getNode(id);
        if (!node) continue;
        ctx.scene.updateNodeTransform(node);
      }

      ctx.scene.selection.refresh(ctx.store, ctx.viewport.scale);
      return;
    }

    this.dragState.current = ctx.viewport.screenToWorld(event.global);
    ctx.scene.selection.setMarquee(
      normalizeBounds(this.dragState.start, this.dragState.current, "marquee"),
      ctx.viewport.scale,
    );
  }

  onGlobalPointerUp(_event: FederatedPointerEvent, ctx: ToolContext): void {
    if (!this.dragState) return;

    if (this.dragState.kind === "resize") {
      if (this.dragState.moved) {
        const mutation = ctx.editor.commitNodeResize(this.dragState.beforeBounds);
        if (mutation) {
          ctx.emitMutation(mutation);
        }
      }
      this.dragState = null;
      return;
    }

    if (this.dragState.kind === "nodes") {
      if (this.dragState.moved) {
        const mutation = ctx.editor.commitNodeMove(this.dragState.startPositions);
        if (mutation) {
          ctx.emitMutation(mutation);
        }
      }
      this.dragState = null;
      return;
    }

    ctx.editor.selectOnly(
      resolveMarqueeSelection({
        currentSelectionIds: ctx.store.selectedIds,
        queryNodeIds: (bounds) => ctx.scene.query(bounds),
        scale: ctx.viewport.scale,
        state: this.dragState,
      }),
    );

    this.dragState = null;
    ctx.scene.selection.clearMarquee();
    ctx.requestSelectionSync();
  }
}
