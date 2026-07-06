import { Container, Graphics, Sprite, Texture } from "../pixi";
import type { BoardNode } from "@pixi-board/board-domain";

// The generating visual is three tinted copies of one shared pre-rendered
// radial glow texture drifting over a light base. Per-frame animation only
// touches sprite transforms, so nothing is re-rasterized and all quads stay
// GPU-side in a single batch.
export type NodeGeneratingVisual = {
  root: Container;
  background: Graphics;
  fx: Container;
  fxMask: Graphics;
  blobs: Sprite[];
  width: number;
  height: number;
};

const LOADING_TEXTURE_SIZE = 1024;
const LOADING_BACKGROUND_COLOR = "#f3f4f6";
const GENERATING_BACKGROUND_COLOR = 0xeef1f8;
const GLOW_TEXTURE_SIZE = 256;
const AURORA_TINTS = [0x818cf8, 0x38bdf8, 0xc084fc];
const AURORA_ALPHA = 0.4;

let sharedLoadingTexture: Texture | undefined;
let sharedGlowTexture: Texture | undefined;

export function createGeneratingVisual(): NodeGeneratingVisual {
  const root = new Container();
  const background = new Graphics();

  const fx = new Container();
  const fxMask = new Graphics();
  fx.mask = fxMask;

  const glow = glowTexture();
  const blobs = AURORA_TINTS.map((tint) => {
    const blob = new Sprite(glow);
    blob.anchor.set(0.5);
    blob.tint = tint;
    blob.alpha = AURORA_ALPHA;
    return blob;
  });

  fx.addChild(...blobs);
  root.addChild(background, fx, fxMask);

  return { root, background, fx, fxMask, blobs, width: 1, height: 1 };
}

export function updateGeneratingVisual(visual: NodeGeneratingVisual, node: BoardNode): void {
  if (visual.width === node.width && visual.height === node.height) return;
  visual.width = node.width;
  visual.height = node.height;

  visual.background.clear();
  visual.background.rect(0, 0, node.width, node.height).fill(GENERATING_BACKGROUND_COLOR);
  visual.fxMask.clear();
  visual.fxMask.rect(0, 0, node.width, node.height).fill(0xffffff);
}

export function animateGeneratingVisual(visual: NodeGeneratingVisual, phase: number): void {
  const { width, height } = visual;
  const centerX = width / 2;
  const centerY = height / 2;
  const blobBaseSize = Math.max(width, height) * 1.15;

  // Slow, incommensurate orbits so the gradient field never visibly repeats.
  const driftX = width * 0.24;
  const driftY = height * 0.24;
  const orbits = [
    [Math.cos(phase * 0.11), Math.sin(phase * 0.17)],
    [Math.cos(phase * 0.13 + 2.1), Math.sin(phase * 0.09 + 1.3)],
    [Math.cos(phase * 0.07 + 4.2), Math.sin(phase * 0.15 + 3.7)],
  ];
  for (const [index, blob] of visual.blobs.entries()) {
    const [ox, oy] = orbits[index];
    blob.position.set(centerX + ox * driftX, centerY + oy * driftY);
    const breath = 1 + Math.sin(phase * 0.21 + index * 2.1) * 0.08;
    blob.width = blobBaseSize * breath;
    blob.height = blob.width;
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

function glowTexture(): Texture {
  if (sharedGlowTexture) return sharedGlowTexture;

  const canvas = document.createElement("canvas");
  canvas.width = GLOW_TEXTURE_SIZE;
  canvas.height = GLOW_TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (context) {
    const half = GLOW_TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.55)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.14)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  sharedGlowTexture = Texture.from(canvas);
  return sharedGlowTexture;
}
