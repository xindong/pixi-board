import type { TextLikePreviewSize } from "./textLikePreviewTypes";

const DEFAULT_PREVIEW_SIZE: TextLikePreviewSize = {
  width: 1920,
  height: 1080,
};
const MIN_PREVIEW_WIDTH = 160;
const MIN_PREVIEW_HEIGHT = 90;
const MAX_PREVIEW_LOGICAL_WIDTH = 8192;
const MAX_PREVIEW_LOGICAL_HEIGHT = 8192;

export function normalizePreviewSize(size?: Partial<TextLikePreviewSize>): TextLikePreviewSize {
  return {
    width: clamp(
      Math.round(size?.width ?? DEFAULT_PREVIEW_SIZE.width),
      MIN_PREVIEW_WIDTH,
      MAX_PREVIEW_LOGICAL_WIDTH,
    ),
    height: clamp(
      Math.round(size?.height ?? DEFAULT_PREVIEW_SIZE.height),
      MIN_PREVIEW_HEIGHT,
      MAX_PREVIEW_LOGICAL_HEIGHT,
    ),
  };
}

export function expandPreviewHeightToContent(
  root: HTMLElement,
  requestedSize: TextLikePreviewSize,
): TextLikePreviewSize {
  const contentHeight = Math.ceil(
    Math.max(
      requestedSize.height,
      root.scrollHeight,
      ...Array.from(
        root.querySelectorAll<HTMLElement>(".pixi-board-document-preview-root"),
      ).map((element) => element.scrollHeight),
    ),
  );
  return {
    width: requestedSize.width,
    height: clamp(contentHeight, MIN_PREVIEW_HEIGHT, MAX_PREVIEW_LOGICAL_HEIGHT),
  };
}

export function applyPreviewRootSize(root: HTMLElement, size: TextLikePreviewSize): void {
  root.style.width = `${size.width}px`;
  root.style.height = `${size.height}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
