import type { AssetMetadataUpdate } from "@pixi-board/board-domain";

const PREVIEW_MAX_EDGE = 1280;

export type CanvasDerivativeExtension = "png" | "webp";

export type CanvasDerivative = {
  extension: CanvasDerivativeExtension;
  bytes: number[];
};

export type PreviewRenderOptions = {
  maxEdge?: number;
};

export type VideoFrameDerivative = {
  extension: CanvasDerivativeExtension;
  bytes: number[];
  metadata: AssetMetadataUpdate;
};

export async function encodeCanvasDerivative(canvas: HTMLCanvasElement): Promise<CanvasDerivative> {
  const webp = await canvasToBlob(canvas, "image/webp", 0.86);
  if (webp && webp.type === "image/webp" && webp.size > 0) {
    return {
      extension: "webp",
      bytes: await blobToBytes(webp),
    };
  }

  const png = await canvasToBlob(canvas, "image/png");
  if (!png) {
    throw new Error("Canvas derivative encoding failed");
  }

  return {
    extension: "png",
    bytes: await blobToBytes(png),
  };
}

export function drawPreviewCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: PreviewRenderOptions = {},
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const size = constrainPreviewSize(sourceWidth, sourceHeight, options.maxEdge);
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is unavailable");
  }

  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

export async function loadImageElement(url: string): Promise<HTMLImageElement> {
  try {
    return await loadImageElementOnce(url, "anonymous");
  } catch {
    return loadImageElementOnce(url);
  }
}

function loadImageElementOnce(
  url: string,
  crossOrigin?: HTMLImageElement["crossOrigin"],
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin !== undefined) {
      image.crossOrigin = crossOrigin;
    }
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image preview from ${url}`));
    image.src = url;
  });
}

export async function loadVideoFrame(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;

  await once(video, "loadedmetadata");
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await once(video, "loadeddata");
  }

  const seekTarget = pickSeekTarget(video.duration);
  if (seekTarget > 0) {
    video.currentTime = seekTarget;
    await once(video, "seeked");
  }

  return video;
}

export async function createVideoFrameDerivative(
  url: string,
  options: PreviewRenderOptions = {},
): Promise<VideoFrameDerivative> {
  let video: HTMLVideoElement | null = null;

  try {
    video = await loadVideoFrame(url);
    const canvas = drawPreviewCanvas(
      video,
      video.videoWidth,
      video.videoHeight,
      options,
    );
    const derivative = await encodeCanvasDerivative(canvas);
    return {
      extension: derivative.extension,
      bytes: derivative.bytes,
      metadata: {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: toFiniteDuration(video.duration),
      },
    };
  } finally {
    releaseVideoFrame(video);
  }
}

export function releaseVideoFrame(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
}

export function toFiniteDuration(duration: number): number | undefined {
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

export function constrainPreviewSize(
  width: number,
  height: number,
  maxEdge = PREVIEW_MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(maxEdge / Math.max(width, height, 1), 1);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function pickSeekTarget(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(Math.max(duration * 0.05, 0.05), Math.max(duration - 0.05, 0));
}

function once(
  target: EventTarget,
  eventName: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleResolve = () => {
      cleanup();
      resolve();
    };
    const handleReject = () => {
      cleanup();
      reject(new Error(`Unable to load media event ${eventName}`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, handleResolve);
      target.removeEventListener("error", handleReject);
    };

    target.addEventListener(eventName, handleResolve, { once: true });
    target.addEventListener("error", handleReject, { once: true });
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function blobToBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
