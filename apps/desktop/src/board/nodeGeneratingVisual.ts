import { Graphics, Texture } from "../pixi";
import type { BoardNode } from "@pixi-board/board-domain";

export type NodeGeneratingVisual = {
  background: Graphics;
  dots: Graphics[];
};

const LOADING_TEXTURE_SIZE = 1024;
const LOADING_BACKGROUND_COLOR = "#f3f4f6";
const GENERATING_BACKGROUND_COLOR = 0xd1d5db;
const GENERATING_DOT_COLOR = 0xffffff;
let sharedLoadingTexture: Texture | undefined;

export function createGeneratingVisual(): NodeGeneratingVisual {
  return {
    background: new Graphics(),
    dots: [new Graphics(), new Graphics(), new Graphics()],
  };
}

export function updateGeneratingVisual(visual: NodeGeneratingVisual, node: BoardNode): void {
  const baseSize = Math.max(1, Math.min(node.width, node.height));
  const radius = Math.max(6, baseSize * 0.055);
  const gap = radius * 3.1;
  const centerX = node.width / 2;
  const centerY = node.height / 2;
  visual.background.clear();
  visual.background.rect(0, 0, node.width, node.height).fill(GENERATING_BACKGROUND_COLOR);
  visual.dots.forEach((dot, index) => {
    dot.clear();
    dot.circle(0, 0, radius).fill(GENERATING_DOT_COLOR);
    dot.position.set(centerX + (index - 1) * gap, centerY);
  });
}

export function animateGeneratingVisual(visual: NodeGeneratingVisual, phase: number): void {
  for (const [index, dot] of visual.dots.entries()) {
    const wave = (Math.sin(phase + index * 1.25) + 1) / 2;
    const scale = 0.68 + wave * 0.44;
    dot.alpha = 0.4 + wave * 0.6;
    dot.scale.set(scale);
  }
}

export function loadingTexture(): Texture {
  if (sharedLoadingTexture) return sharedLoadingTexture;

  const canvas = document.createElement("canvas");
  canvas.width = LOADING_TEXTURE_SIZE;
  canvas.height = LOADING_TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = LOADING_BACKGROUND_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  sharedLoadingTexture = Texture.from(canvas);
  return sharedLoadingTexture;
}
