import type { Asset } from "@pixi-board/board-domain";
import { assetLabel } from "./assetLabels";
import { encodeCanvasDerivative } from "./mediaPreview";
import type { ModelPreviewResult } from "./modelPreviewTypes";
import { staticPreviewMetadataFor } from "./staticPreviewMetadata";

const MODEL_PREVIEW_FALLBACK_GRADIENT: [string, string] = ["#eef2f6", "#dbe3ec"];

export async function generateModelCardPreview(asset: Asset): Promise<ModelPreviewResult> {
  const metadata = staticPreviewMetadataFor({
    kind: "model",
    fileName: assetLabel(asset),
  });
  const canvas = document.createElement("canvas");
  canvas.width = metadata.width ?? 640;
  canvas.height = metadata.height ?? 420;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is unavailable");
  }

  paintModelBackdrop(context, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  roundRect(context, 72, 68, canvas.width - 144, canvas.height - 136, 18);
  context.fill();

  context.fillStyle = "#111827";
  context.font = "700 36px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("MODEL", canvas.width / 2, 168);

  context.fillStyle = "#475569";
  context.font = "500 24px Inter, system-ui, sans-serif";
  wrapText(context, assetLabel(asset), canvas.width / 2, 224, canvas.width - 190, 34);

  const derivative = await encodeCanvasDerivative(canvas);
  return {
    ...derivative,
    metadata,
  };
}

function paintModelBackdrop(context: CanvasRenderingContext2D, width: number, height: number): void {
  const [start, end] = MODEL_PREVIEW_FALLBACK_GRADIENT;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, start);
  gradient.addColorStop(1, end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = nextLine;
    }
  }
  if (line) context.fillText(line, x, currentY);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
