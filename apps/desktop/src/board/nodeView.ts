import { Container, Rectangle, Sprite, Texture } from "../pixi";
import type { FederatedPointerEvent } from "../pixi";
import type { BoardNode } from "@pixi-board/board-domain";
import {
  animateGeneratingVisual,
  createGeneratingVisual,
  loadingTexture,
  updateGeneratingVisual,
  type NodeGeneratingVisual,
} from "./nodeGeneratingVisual";
import { destroyDisplayObjectAfterRender } from "./pixiDeferredDestroy";

export type NodeView = {
  node: BoardNode;
  container: Container;
  sprite?: Sprite;
  transitionSprite?: Sprite;
  transitionId: number;
  loadVersion: number;
  textureKey?: string;
  assetVisualKey?: string;
  generatingVisual?: NodeGeneratingVisual;
};

type TextureTransitionCallbacks = {
  onCancel?: () => void;
  onComplete?: () => void;
};

export function createNodeView(
  node: BoardNode,
  onPointerDown: (event: FederatedPointerEvent, nodeId: string) => void,
): NodeView {
  const container = new Container();
  container.eventMode = "static";
  container.cursor = "pointer";
  container.interactiveChildren = false;
  container.hitArea = new Rectangle(0, 0, node.width, node.height);
  container.on("pointerdown", (event) => onPointerDown(event, node.id));

  const view: NodeView = {
    node,
    container,
    transitionId: 0,
    loadVersion: 0,
  };

  if (node.type === "generating") {
    const visual = createGeneratingVisual();
    view.generatingVisual = visual;
    container.addChild(visual.root);
  } else {
    const sprite = new Sprite(loadingTexture());
    sprite.width = node.width;
    sprite.height = node.height;
    sprite.alpha = 1;
    view.sprite = sprite;
    container.addChild(sprite);
  }

  updateNodeView(view);
  return view;
}

export function updateNodeView(view: NodeView): void {
  const { node, container, sprite } = view;
  container.position.set(node.x, node.y);
  container.rotation = node.rotation;
  if (container.zIndex !== node.zIndex) {
    container.zIndex = node.zIndex;
  }
  const hitArea = container.hitArea;
  if (hitArea instanceof Rectangle) {
    hitArea.x = 0;
    hitArea.y = 0;
    hitArea.width = node.width;
    hitArea.height = node.height;
  } else {
    container.hitArea = new Rectangle(0, 0, node.width, node.height);
  }
  if (sprite) {
    sprite.width = node.width;
    sprite.height = node.height;
  }
  if (view.transitionSprite) {
    view.transitionSprite.width = node.width;
    view.transitionSprite.height = node.height;
  }
  if (view.generatingVisual) {
    updateGeneratingVisual(view.generatingVisual, node);
  }
}

export function applyTextureToView(view: NodeView, texture: Texture): void {
  const sprite = view.sprite;
  if (!sprite) return;
  cancelTextureTransition(view);
  sprite.texture = texture;
  sprite.alpha = 1;
  updateNodeView(view);
}

export function transitionTextureToView(
  view: NodeView,
  texture: Texture,
  durationMs = 180,
  callbacks: TextureTransitionCallbacks = {},
): void {
  const sprite = view.sprite;
  if (!sprite) return;
  const transitionId = ++view.transitionId;
  let settled = false;
  const cancel = () => {
    if (settled) return;
    settled = true;
    callbacks.onCancel?.();
  };
  const complete = () => {
    if (settled) return;
    settled = true;
    callbacks.onComplete?.();
  };
  const overlay = new Sprite(texture);
  overlay.width = view.node.width;
  overlay.height = view.node.height;
  overlay.alpha = 0;

  destroyDisplayObjectAfterRender(view.transitionSprite);
  view.transitionSprite = overlay;
  view.container.addChild(overlay);

  const start = performance.now();
  const tick = (now: number) => {
    if (view.transitionId !== transitionId || view.transitionSprite !== overlay) {
      destroyDisplayObjectAfterRender(overlay);
      cancel();
      return;
    }

    const progress = Math.min(1, (now - start) / durationMs);
    overlay.alpha = easeOutCubic(progress);

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    sprite.texture = texture;
    sprite.alpha = 1;
    view.transitionSprite = undefined;
    destroyDisplayObjectAfterRender(overlay);
    complete();
    updateNodeView(view);
  };

  requestAnimationFrame(tick);
}

export function applyLoadingVisualToView(view: NodeView): void {
  const sprite = view.sprite;
  if (!sprite) return;
  cancelTextureTransition(view);
  sprite.texture = loadingTexture();
  sprite.alpha = 1;
  updateNodeView(view);
}

export function destroyNodeView(view: NodeView): void {
  view.loadVersion++;
  cancelTextureTransition(view);
  destroyDisplayObjectAfterRender(view.container, { children: true });
}

export function updateGeneratingView(view: NodeView): void {
  if (!view.generatingVisual) return;
  updateGeneratingVisual(view.generatingVisual, view.node);
}

export function animateGeneratingView(view: NodeView, phase: number): void {
  const visual = view.generatingVisual;
  if (!visual) return;
  animateGeneratingVisual(visual, phase);
}

function cancelTextureTransition(view: NodeView): void {
  view.transitionId++;
  destroyDisplayObjectAfterRender(view.transitionSprite);
  view.transitionSprite = undefined;
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}
