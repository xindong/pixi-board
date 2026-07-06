export const AUDIO_WAVEFORM_WIDTH = 2160;
export const AUDIO_WAVEFORM_HEIGHT = 1080;
const DEFAULT_PEAK_COUNT = 160;

export type AudioWaveformOptions = {
  label?: string;
  peaks?: number[];
  progress?: number;
  width?: number;
  height?: number;
};

export function createAudioWaveformCanvas(options: AudioWaveformOptions = {}): HTMLCanvasElement {
  const width = options.width ?? AUDIO_WAVEFORM_WIDTH;
  const height = options.height ?? AUDIO_WAVEFORM_HEIGHT;
  const peaks = normalizePeaks(options.peaks?.length ? options.peaks : defaultWaveformPeaks());
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context is unavailable");
  }

  drawAudioWaveform(context, {
    peaks,
    progress: options.progress ?? 0,
    width,
    height,
  });

  return canvas;
}

export async function decodeAudioPeaks(url: string, peakCount = 320): Promise<number[]> {
  const response = await fetch(url);
  const data = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("AudioContext is unavailable");
  }

  const audioContext = new AudioContextCtor();
  try {
    const buffer = await audioContext.decodeAudioData(data.slice(0));
    return peaksFromAudioBuffer(buffer, peakCount);
  } finally {
    void audioContext.close();
  }
}

export function encodeAudioPeaksDerivative(peaks: number[]): number[] {
  return Array.from(new TextEncoder().encode(JSON.stringify({ peaks: normalizePeaks(peaks) })));
}

export async function loadAudioPeaksDerivative(url: string): Promise<number[]> {
  const response = await fetch(url);
  const data = (await response.json()) as { peaks?: unknown };
  if (!Array.isArray(data.peaks)) {
    throw new Error("Audio waveform derivative is missing peaks");
  }
  return normalizePeaks(data.peaks.filter((peak): peak is number => typeof peak === "number"));
}

function peaksFromAudioBuffer(buffer: AudioBuffer, peakCount: number): number[] {
  const channelCount = Math.max(buffer.numberOfChannels, 1);
  const sampleCount = buffer.length;
  const bucketSize = Math.max(1, Math.floor(sampleCount / peakCount));
  const peaks: number[] = [];

  for (let bucket = 0; bucket < peakCount; bucket += 1) {
    const start = bucket * bucketSize;
    const end = Math.min(start + bucketSize, sampleCount);
    let max = 0;

    for (let channel = 0; channel < channelCount; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = start; index < end; index += 1) {
        const value = Math.abs(data[index] ?? 0);
        if (value > max) max = value;
      }
    }

    peaks.push(max);
  }

  return normalizePeaks(peaks);
}

function drawAudioWaveform(
  context: CanvasRenderingContext2D,
  input: { width: number; height: number; peaks: number[]; progress: number },
) {
  const { width, height, peaks } = input;
  const progress = Math.max(0, Math.min(1, input.progress));
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f8fafc");
  gradient.addColorStop(1, "#eef6ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const left = 0;
  const right = width;
  const centerY = height / 2;
  const maxWaveHeight = height;
  const step = (right - left) / peaks.length;
  const barWidth = Math.ceil(step);

  context.fillStyle = "rgba(37, 99, 235, 0.22)";
  peaks.forEach((peak, index) => {
    const normalized = Math.max(0.04, Math.min(1, peak));
    const barHeight = normalized * maxWaveHeight;
    const x = left + index * step;
    context.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
  });

  context.save();
  context.beginPath();
  context.rect(0, 0, width * progress, height);
  context.clip();
  context.fillStyle = "#2563eb";
  peaks.forEach((peak, index) => {
    const normalized = Math.max(0.04, Math.min(1, peak));
    const barHeight = normalized * maxWaveHeight;
    const x = left + index * step;
    context.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
  });
  context.restore();
}

function defaultWaveformPeaks(): number[] {
  return Array.from({ length: DEFAULT_PEAK_COUNT }, (_, index) => {
    const phase = index / DEFAULT_PEAK_COUNT;
    return (
      0.24 +
      Math.abs(Math.sin(phase * Math.PI * 7)) * 0.46 +
      Math.abs(Math.sin(phase * Math.PI * 19)) * 0.22
    );
  });
}

function normalizePeaks(peaks: number[]): number[] {
  const max = Math.max(...peaks, 0.001);
  return peaks.map((peak) => Math.max(0, Math.min(1, peak / max)));
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
