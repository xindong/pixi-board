import { Texture } from "../pixi";
import { createAudioWaveformCanvas } from "../audioWaveform";

const TEXT_FONT_FAMILY =
  '"SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

export function createPlaceholderTexture(kind: string, label: string): Texture {
  if (kind === "audio:waveform" || kind === "audio") {
    return Texture.from(createAudioWaveformCanvas({ label }));
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 420;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#f1f5f9";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#334155";
    context.font = `700 34px ${TEXT_FONT_FAMILY}`;
    context.textAlign = "center";
    context.fillText(kind.toUpperCase(), canvas.width / 2, 180);
    context.font = `500 22px ${TEXT_FONT_FAMILY}`;
    context.fillText(label, canvas.width / 2, 226);
  }
  return Texture.from(canvas);
}
