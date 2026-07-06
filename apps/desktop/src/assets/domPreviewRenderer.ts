import { toBlob } from "html-to-image";
import type { AssetMetadataUpdate } from "@pixi-board/board-domain";
import type { CanvasDerivativeExtension } from "./mediaPreview";

export type DomPreviewSize = {
  width: number;
  height: number;
};

export type DomPreviewResult = {
  extension: CanvasDerivativeExtension;
  bytes: number[];
  metadata: AssetMetadataUpdate;
};

type RenderDomPreviewOptions = {
  layoutReady?: boolean;
};

const MAX_RENDERED_PREVIEW_EDGE = 4096;
const MAX_PIXEL_RATIO = 2;

export async function renderDomPreview(
  root: HTMLElement,
  size: DomPreviewSize,
  options: RenderDomPreviewOptions = {},
): Promise<DomPreviewResult> {
  if (!options.layoutReady) {
    await waitForPreviewLayout(root);
  }
  const pixelRatio = previewPixelRatio(size);
  const blob =
    (await toPreviewBlob(root, size, pixelRatio, "image/webp").catch(() => null)) ??
    (await toPreviewBlob(root, size, pixelRatio, "image/png"));
  if (!blob) {
    throw new Error("DOM preview rendering returned an empty blob");
  }
  return {
    extension: blob.type === "image/png" ? "png" : "webp",
    bytes: await blobToBytes(blob),
    metadata: previewMetadata(size),
  };
}

export function previewHost(): HTMLDivElement {
  let host = document.getElementById("text-like-preview-host") as HTMLDivElement | null;
  if (host) return host;

  host = document.createElement("div");
  host.id = "text-like-preview-host";
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.overflow = "visible";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";
  document.body.append(host);
  return host;
}

export function animationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function toPreviewBlob(
  root: HTMLElement,
  size: DomPreviewSize,
  pixelRatio: number,
  type: "image/webp" | "image/png",
): Promise<Blob | null> {
  return toBlob(root, {
    width: size.width,
    height: size.height,
    pixelRatio,
    cacheBust: true,
    backgroundColor: "#ffffff",
    type,
  });
}

function previewMetadata(size: DomPreviewSize): AssetMetadataUpdate {
  return {
    width: size.width,
    height: size.height,
    metadata: {
      previewWidth: size.width,
      previewHeight: size.height,
    },
  };
}

function previewPixelRatio(size: DomPreviewSize): number {
  const devicePixelRatio = Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const edgePixelRatio = Math.min(
    MAX_RENDERED_PREVIEW_EDGE / size.width,
    MAX_RENDERED_PREVIEW_EDGE / size.height,
  );
  return Math.min(devicePixelRatio, edgePixelRatio);
}

export async function waitForPreviewLayout(root: HTMLElement): Promise<void> {
  const fontsReady = root.ownerDocument.fonts?.ready.catch(() => undefined);
  await Promise.all([
    waitForImages(root),
    fontsReady,
  ]);
  settlePreviewAnimations(root);
  await animationFrame();
  await animationFrame();
}

function settlePreviewAnimations(root: HTMLElement): void {
  for (const animation of root.getAnimations({ subtree: true })) {
    const timing = animation.effect?.getTiming();
    const duration = typeof timing?.duration === "number" ? timing.duration : 0;
    const delay = typeof timing?.delay === "number" ? timing.delay : 0;
    const iterations = Number(timing?.iterations ?? 1);
    const finiteAnimation = Number.isFinite(iterations) && iterations > 0 && Number.isFinite(duration);
    if (!finiteAnimation) continue;
    try {
      animation.currentTime = Math.max(0, delay + duration * iterations);
      animation.pause();
    } catch {
      // Some browser-managed animations may reject seeking; leave them as-is.
    }
  }
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;
  await Promise.race([
    Promise.all(
      images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    ),
    delay(500),
  ]);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function blobToBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
