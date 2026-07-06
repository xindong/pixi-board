export type BoardScenePatch = {
  addedNodeIds?: string[];
  removedNodeIds?: string[];
  updatedNodeIds?: string[];
  assetChangedNodeIds?: string[];
  selectionChanged?: boolean;
};

export type BoardScenePatchOptions = {
  selectionChanged?: boolean;
};

export function addedNodesPatch(
  nodeIds: Iterable<string>,
  options?: BoardScenePatchOptions,
): BoardScenePatch {
  return withScenePatchOptions({ addedNodeIds: [...nodeIds] }, options);
}

export function removedNodesPatch(
  nodeIds: Iterable<string>,
  options?: BoardScenePatchOptions,
): BoardScenePatch {
  return withScenePatchOptions({ removedNodeIds: [...nodeIds] }, options);
}

export function updatedNodesPatch(
  nodeIds: Iterable<string>,
  options?: BoardScenePatchOptions,
): BoardScenePatch {
  return withScenePatchOptions({ updatedNodeIds: [...nodeIds] }, options);
}

export function assetChangedNodesPatch(
  nodeIds: Iterable<string>,
  options?: BoardScenePatchOptions,
): BoardScenePatch {
  const ids = [...nodeIds];
  return withScenePatchOptions(
    {
      updatedNodeIds: ids,
      assetChangedNodeIds: ids,
    },
    options,
  );
}

export function mergeScenePatches(
  patches: Array<BoardScenePatch | undefined | null>,
): BoardScenePatch {
  const addedNodeIds = new Set<string>();
  const removedNodeIds = new Set<string>();
  const updatedNodeIds = new Set<string>();
  const assetChangedNodeIds = new Set<string>();
  let selectionChanged = false;

  for (const patch of patches) {
    if (!patch) continue;
    for (const id of patch.addedNodeIds ?? []) {
      addedNodeIds.add(id);
      removedNodeIds.delete(id);
    }
    for (const id of patch.removedNodeIds ?? []) {
      removedNodeIds.add(id);
      addedNodeIds.delete(id);
      updatedNodeIds.delete(id);
      assetChangedNodeIds.delete(id);
    }
    for (const id of patch.updatedNodeIds ?? []) {
      if (!removedNodeIds.has(id)) updatedNodeIds.add(id);
    }
    for (const id of patch.assetChangedNodeIds ?? []) {
      if (!removedNodeIds.has(id)) assetChangedNodeIds.add(id);
    }
    selectionChanged ||= Boolean(patch.selectionChanged);
  }

  return {
    addedNodeIds: [...addedNodeIds],
    removedNodeIds: [...removedNodeIds],
    updatedNodeIds: [...updatedNodeIds],
    assetChangedNodeIds: [...assetChangedNodeIds],
    selectionChanged,
  };
}

export function scenePatchHasDataChanges(patch: BoardScenePatch): boolean {
  return Boolean(
    patch.addedNodeIds?.length ||
      patch.removedNodeIds?.length ||
      patch.updatedNodeIds?.length ||
      patch.assetChangedNodeIds?.length,
  );
}

function withScenePatchOptions(
  patch: BoardScenePatch,
  options?: BoardScenePatchOptions,
): BoardScenePatch {
  if (!options || !("selectionChanged" in options)) {
    return patch;
  }
  return {
    ...patch,
    selectionChanged: Boolean(options.selectionChanged),
  };
}
