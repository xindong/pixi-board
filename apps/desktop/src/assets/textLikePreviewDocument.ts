import { hasHtmlDocumentShape } from "./textLikePreviewHtml";
import { DOCUMENT_MAX_WIDTH, PREVIEW_FONT_FAMILY } from "./textLikePreviewStyle";
import type { TextLikeAssetKind, TextLikePreviewSize } from "./textLikePreviewTypes";

export function createPreviewRoot(
  kind: TextLikeAssetKind,
  sourceText: string,
  size: TextLikePreviewSize,
): HTMLDivElement {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = `${size.width}px`;
  root.style.height = `${size.height}px`;
  root.style.overflow = "hidden";
  root.style.background = "#ffffff";
  root.style.color = "#111827";
  root.style.fontFamily = PREVIEW_FONT_FAMILY;
  root.style.fontSynthesis = "none";
  root.style.lineHeight = "1.45";
  root.style.boxSizing = "border-box";
  root.style.contain = "layout paint style";

  const shell = document.createElement("div");
  shell.className = "pixi-board-html-preview-root";
  shell.style.width = "100%";
  shell.style.height = "100%";
  shell.style.overflow = "hidden";
  shell.style.boxSizing = "border-box";
  shell.style.position = "relative";

  if (kind === "html") {
    applyHtmlSource(shell, sourceText);
  } else if (kind === "markdown") {
    shell.className = "pixi-board-markdown-preview";
    applyDocumentSource(shell, markdownToHtml(sourceText), { html: true });
  } else {
    const pre = document.createElement("pre");
    pre.textContent = sourceText;
    applyDocumentSource(shell, pre);
  }

  root.append(shell);
  return root;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyDocumentSource(
  shell: HTMLDivElement,
  content: string | HTMLElement,
  options: { html?: boolean } = {},
): void {
  shell.classList.add("pixi-board-document-preview-root");
  shell.style.padding = "32px";
  shell.style.background = "#ffffff";
  shell.style.color = "#111827";
  shell.style.font = `500 22px/1.65 ${PREVIEW_FONT_FAMILY}`;

  const style = document.createElement("style");
  style.textContent = documentPreviewCss();
  const documentElement = document.createElement("div");
  documentElement.className = "pixi-board-document-preview";
  if (typeof content === "string" && options.html) {
    documentElement.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    documentElement.append(content);
  } else {
    documentElement.textContent = String(content);
  }
  shell.replaceChildren(style, documentElement);
}

function documentPreviewCss(): string {
  return `
    .pixi-board-document-preview-root {
      container-type: inline-size;
    }
    .pixi-board-document-preview {
      max-width: ${DOCUMENT_MAX_WIDTH};
      min-width: 0;
      margin: 0;
      font: inherit;
      color: inherit;
      overflow-wrap: anywhere;
      word-break: normal;
    }
    .pixi-board-document-preview pre {
      margin: 0;
      font: inherit;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .pixi-board-document-preview h1,
    .pixi-board-document-preview h2,
    .pixi-board-document-preview h3,
    .pixi-board-document-preview p {
      margin: 0 0 0.9em;
    }
    .pixi-board-document-preview h1 {
      font-size: 1.55em;
      line-height: 1.25;
      font-weight: 800;
    }
    .pixi-board-document-preview h2 {
      font-size: 1.28em;
      line-height: 1.32;
      font-weight: 750;
    }
    .pixi-board-document-preview h3 {
      font-size: 1.12em;
      line-height: 1.38;
      font-weight: 700;
    }
    .pixi-board-document-preview code {
      font-family: "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.9em;
    }
    @container (max-width: 520px) {
      .pixi-board-document-preview {
        max-width: none;
        font-size: 20px;
        line-height: 1.58;
      }
    }
  `;
}

function applyHtmlSource(shell: HTMLDivElement, sourceText: string): void {
  const parsed = new DOMParser().parseFromString(sourceText, "text/html");
  if (!hasHtmlDocumentShape(sourceText)) {
    shell.innerHTML = sourceText;
    return;
  }

  shell.replaceChildren();
  for (const style of parsed.head.querySelectorAll("style")) {
    const rewrittenStyle = document.createElement("style");
    rewrittenStyle.textContent = rewriteDocumentCss(style.textContent ?? "");
    shell.append(rewrittenStyle);
  }
  if (parsed.body.hasAttribute("style")) {
    shell.setAttribute("style", `${shell.getAttribute("style") ?? ""};${parsed.body.getAttribute("style") ?? ""}`);
    shell.style.width = "100%";
    shell.style.height = "100%";
    shell.style.overflow = "hidden";
    shell.style.boxSizing = "border-box";
  }
  shell.append(...Array.from(parsed.body.childNodes).map((node) => node.cloneNode(true)));
}

function rewriteDocumentCss(css: string): string {
  return css
    .replace(/\bhtml\s*,\s*body\b/g, ".pixi-board-html-preview-root")
    .replace(/\bbody\s*,\s*html\b/g, ".pixi-board-html-preview-root")
    .replace(/\bbody\b/g, ".pixi-board-html-preview-root")
    .replace(/\bhtml\b/g, ".pixi-board-html-preview-root");
}

function markdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}
