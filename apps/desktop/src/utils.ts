export function createId(prefix: string): string {
  const cryptoId = crypto.randomUUID?.();
  return `${prefix}_${cryptoId ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function fitSize(width?: number, height?: number, maxWidth = 640, maxHeight = 320) {
  const sourceWidth = width && width > 0 ? width : maxWidth;
  const sourceHeight = height && height > 0 ? height : maxHeight;
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  return {
    width: Math.max(96, Math.round(sourceWidth * scale)),
    height: Math.max(72, Math.round(sourceHeight * scale)),
  };
}

export function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : "";
}

export function baseNameWithoutExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const index = trimmed.lastIndexOf(".");
  if (index < 0) return trimmed;
  return trimmed.slice(0, index);
}
