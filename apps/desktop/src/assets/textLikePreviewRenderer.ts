import { animationFrame, previewHost, renderDomPreview, waitForPreviewLayout } from "./domPreviewRenderer";
import type { Asset } from "@pixi-board/board-domain";
import { createPreviewRoot, escapeHtml } from "./textLikePreviewDocument";
import { hasHtmlDocumentShape, renderHtmlDocumentPreview } from "./textLikePreviewHtml";
import { applyPreviewRootSize, expandPreviewHeightToContent, normalizePreviewSize } from "./textLikePreviewSize";
import { PREVIEW_FONT_FAMILY } from "./textLikePreviewStyle";
import type {
  RenderPreviewOptions,
  TextLikeAssetKind,
  TextLikePreviewResult,
  TextLikePreviewSize,
} from "./textLikePreviewTypes";

export type { TextLikeAssetKind, TextLikePreviewResult, TextLikePreviewSize } from "./textLikePreviewTypes";

export function isTextLikeAssetKind(kind: string): kind is TextLikeAssetKind {
  return kind === "text" || kind === "markdown" || kind === "html";
}

export async function renderTextLikePreview(
  asset: Asset,
  sourceText: string,
  requestedSize?: Partial<TextLikePreviewSize>,
): Promise<TextLikePreviewResult> {
  if (!isTextLikeAssetKind(asset.kind)) {
    throw new Error(`Unsupported text-like preview asset kind: ${asset.kind}`);
  }

  const size = normalizePreviewSize(requestedSize);
  if (asset.kind === "html" && hasHtmlDocumentShape(sourceText)) {
    return renderHtmlDocumentPreview(sourceText, size);
  }

  const root = createPreviewRoot(asset.kind, sourceText, size);
  return renderPreviewRoot(root, size, {
    expandHeightToContent: asset.kind === "markdown" || asset.kind === "text",
  });
}

export function renderTextLikeErrorPreview(
  _asset: Asset,
  message: string,
  requestedSize?: Partial<TextLikePreviewSize>,
): Promise<TextLikePreviewResult> {
  const size = normalizePreviewSize(requestedSize);
  const root = createPreviewRoot(
    "html",
    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#64748b;font:600 22px ${PREVIEW_FONT_FAMILY};padding:32px;text-align:center;box-sizing:border-box">${escapeHtml(message)}</div>`,
    size,
  );
  return renderPreviewRoot(root, size);
}

async function renderPreviewRoot(
  root: HTMLElement,
  requestedSize: TextLikePreviewSize,
  options: RenderPreviewOptions = {},
): Promise<TextLikePreviewResult> {
  const host = previewHost();
  host.append(root);
  try {
    await waitForPreviewLayout(root);
    const size = options.expandHeightToContent
      ? expandPreviewHeightToContent(root, requestedSize)
      : requestedSize;
    if (size.width !== requestedSize.width || size.height !== requestedSize.height) {
      applyPreviewRootSize(root, size);
      await animationFrame();
      await animationFrame();
    }
    return renderDomPreview(root, size, { layoutReady: true });
  } finally {
    root.remove();
  }
}
