import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

export function hitTestTopNodeAtScreen(
  screen: { x: number; y: number },
  options: {
    scene: BoardScene;
    store: BoardStore;
    viewport: BoardViewport;
  },
): string | null {
  const { scene, store, viewport } = options;
  const world = viewport.screenToWorld(screen);
  const epsilon = 1 / Math.max(viewport.scale, 0.0001);
  const ids = scene.query({
    id: "hit-test",
    minX: world.x - epsilon,
    minY: world.y - epsilon,
    maxX: world.x + epsilon,
    maxY: world.y + epsilon,
  });

  let topNodeId: string | null = null;
  let topZ = Number.NEGATIVE_INFINITY;
  for (const id of ids) {
    const node = store.getNode(id);
    if (!node || node.zIndex < topZ) continue;
    topNodeId = id;
    topZ = node.zIndex;
  }

  return topNodeId;
}
