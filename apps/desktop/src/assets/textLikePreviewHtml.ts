import { previewHost, renderDomPreview } from "./domPreviewRenderer";
import type { TextLikePreviewResult, TextLikePreviewSize } from "./textLikePreviewTypes";

export async function renderHtmlDocumentPreview(
  sourceText: string,
  size: TextLikePreviewSize,
): Promise<TextLikePreviewResult> {
  const host = previewHost();
  const frame = createPreviewFrame(size);
  host.append(frame);
  try {
    await writeFrameDocument(frame, sourceText);
    const documentElement = frame.contentDocument?.documentElement;
    if (!documentElement) {
      throw new Error("HTML preview frame did not create a document");
    }

    return renderDomPreview(documentElement, size);
  } finally {
    frame.remove();
  }
}

export function hasHtmlDocumentShape(sourceText: string): boolean {
  return /<\/?(html|head|body)(\s|>)/i.test(sourceText);
}

function createPreviewFrame(size: TextLikePreviewSize): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.style.position = "fixed";
  frame.style.left = "0";
  frame.style.top = "0";
  frame.style.width = `${size.width}px`;
  frame.style.height = `${size.height}px`;
  frame.style.border = "0";
  frame.style.pointerEvents = "none";
  frame.style.background = "#ffffff";
  return frame;
}

function writeFrameDocument(
  frame: HTMLIFrameElement,
  sourceText: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      reject(new Error("HTML preview frame is not accessible"));
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    frame.addEventListener("load", settle, { once: true });
    window.setTimeout(settle, 500);

    try {
      frameDocument.open();
      frameDocument.write(sourceText);
      frameDocument.close();
      if (frameDocument.readyState === "complete") {
        queueMicrotask(settle);
      }
    } catch (error) {
      reject(error);
    }
  });
}
