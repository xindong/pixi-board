type DestroyableDisplayObject = {
  destroy(options?: unknown): void;
  removeFromParent(): void;
  visible: boolean;
  destroyed?: boolean;
};

const deferredDestroyObjects = new WeakSet<DestroyableDisplayObject>();

export function destroyDisplayObjectAfterRender(
  object: DestroyableDisplayObject | undefined,
  options?: unknown,
): void {
  if (!object || object.destroyed) return;
  object.visible = false;
  object.removeFromParent();
  if (deferredDestroyObjects.has(object)) return;
  deferredDestroyObjects.add(object);
  afterRenderFrame(() => {
    if (!object.destroyed) {
      object.destroy(options);
    }
  });
}

function afterRenderFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => callback());
    });
    return;
  }
  globalThis.setTimeout(callback, 0);
}
