import type { Point } from "@pixi-board/board-domain";
import type { BoardNode } from "@pixi-board/board-domain";
import type { BoardNodeUpdateInput } from "@pixi-board/board-domain";
import type { BoardCommand } from "./boardHistory";
import { addedNodesPatch, removedNodesPatch, updatedNodesPatch } from "./boardScenePatch";
import type { NodeBounds } from "./boardStore";

export function createInsertNodesCommand(
  nodes: BoardNode[],
  previousSelectionIds: string[],
  nextSelectionIds: string[],
  label = "Insert nodes",
): BoardCommand {
  const nodeIds = nodes.map((node) => node.id);

  return {
    label,
    applyPatch: addedNodesPatch(nodeIds, { selectionChanged: true }),
    revertPatch: removedNodesPatch(nodeIds, { selectionChanged: true }),
    apply: (store) => {
      store.appendNodes(nodes);
      store.selectOnly(nextSelectionIds);
    },
    revert: (store) => {
      store.removeNodes(nodeIds);
      store.selectOnly(previousSelectionIds);
    },
  };
}

export function createCommitInsertedNodesCommand(
  nodes: BoardNode[],
  previousSelectionIds: string[],
  nextSelectionIds: string[],
  label = "Insert nodes",
): BoardCommand {
  const committedNodes = nodes.map((node) => structuredClone(node));
  const nodeIds = committedNodes.map((node) => node.id);

  return {
    label,
    applyPatch: addedNodesPatch(nodeIds, { selectionChanged: true }),
    revertPatch: removedNodesPatch(nodeIds, { selectionChanged: true }),
    apply: (store) => {
      store.appendNodes(committedNodes.map((node) => structuredClone(node)));
      store.selectOnly(nextSelectionIds);
    },
    revert: (store) => {
      store.removeNodes(nodeIds);
      store.selectOnly(previousSelectionIds);
    },
  };
}

export function createDeleteNodesCommand(
  nodes: BoardNode[],
  previousSelectionIds: string[],
  label = "Delete nodes",
): BoardCommand {
  const nodeIds = nodes.map((node) => node.id);

  return {
    label,
    applyPatch: removedNodesPatch(nodeIds, { selectionChanged: true }),
    revertPatch: addedNodesPatch(nodeIds, { selectionChanged: true }),
    apply: (store) => {
      store.removeNodes(nodeIds);
      store.selectOnly([]);
    },
    revert: (store) => {
      store.appendNodes(nodes);
      store.selectOnly(previousSelectionIds);
    },
  };
}

export function createMoveNodesCommand(
  beforePositions: Map<string, Point>,
  afterPositions: Map<string, Point>,
  label = "Move nodes",
): BoardCommand {
  return {
    label,
    applyPatch: updatedNodesPatch(afterPositions.keys()),
    revertPatch: updatedNodesPatch(beforePositions.keys()),
    apply: (store) => {
      store.setNodePositions(afterPositions);
    },
    revert: (store) => {
      store.setNodePositions(beforePositions);
    },
  };
}

export function createResizeNodesCommand(
  before: Map<string, NodeBounds>,
  after: Map<string, NodeBounds>,
  label = "Resize nodes",
): BoardCommand {
  return {
    label,
    applyPatch: updatedNodesPatch(after.keys()),
    revertPatch: updatedNodesPatch(before.keys()),
    apply: (store) => {
      store.setNodeBounds(after);
    },
    revert: (store) => {
      store.setNodeBounds(before);
    },
  };
}

export function createRenameNodeCommand(
  nodeId: string,
  beforeName: string | undefined,
  afterName: string,
  label = "Rename node",
): BoardCommand {
  return {
    label,
    applyPatch: updatedNodesPatch([nodeId], { selectionChanged: true }),
    revertPatch: updatedNodesPatch([nodeId], { selectionChanged: true }),
    apply: (store) => {
      store.setNodeName(nodeId, afterName);
    },
    revert: (store) => {
      store.setNodeName(nodeId, beforeName);
    },
  };
}

export function createUpdateNodesCommand(
  beforeNodes: BoardNode[],
  updates: BoardNodeUpdateInput[],
  label = "Update nodes",
): BoardCommand {
  return {
    label,
    applyPatch: updatedNodesPatch(
      updates.map((update) => update.id),
      { selectionChanged: true },
    ),
    revertPatch: updatedNodesPatch(
      beforeNodes.map((node) => node.id),
      { selectionChanged: true },
    ),
    apply: (store) => {
      store.updateNodes(updates);
    },
    revert: (store) => {
      store.replaceNodes(beforeNodes);
    },
  };
}
