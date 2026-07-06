import { createIcon } from "../ui/icons";
import type { MediaPlayback } from "./mediaPlayback";

export class SelectionMediaControls {
  readonly element: HTMLDivElement;

  private readonly playButton: HTMLButtonElement;
  private readonly progress: HTMLInputElement;
  private readonly timeLabel: HTMLSpanElement;

  private playback: MediaPlayback | null = null;
  private unsubscribePlayback: (() => void) | null = null;
  private scrubbing = false;
  private rafHandle: number | null = null;

  constructor() {
    this.playButton = document.createElement("button");
    this.playButton.type = "button";
    this.playButton.className = "sp-button";
    this.playButton.title = "播放/暂停";
    this.playButton.setAttribute("aria-label", "播放/暂停");
    this.playButton.append(createIcon("play", { size: 15 }));
    this.playButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePlayback();
    });
    this.playButton.addEventListener("click", (event) => {
      if (event.detail !== 0) return;
      this.togglePlayback();
    });

    this.progress = document.createElement("input");
    this.progress.type = "range";
    this.progress.className = "sp-progress";
    this.progress.min = "0";
    this.progress.max = "1000";
    this.progress.value = "0";
    this.progress.addEventListener("pointerdown", () => {
      this.scrubbing = true;
    });
    this.progress.addEventListener("input", () => {
      const duration = this.playback?.duration() ?? 0;
      if (duration > 0) {
        this.playback?.seek((Number(this.progress.value) / 1000) * duration);
      }
    });
    const endScrub = () => {
      this.scrubbing = false;
    };
    this.progress.addEventListener("pointerup", endScrub);
    this.progress.addEventListener("change", endScrub);

    this.timeLabel = document.createElement("span");
    this.timeLabel.className = "sp-time";
    this.timeLabel.textContent = "0:00 / 0:00";

    this.element = document.createElement("div");
    this.element.className = "sp-media";
    this.element.append(this.playButton, this.progress, this.timeLabel);
  }

  show(playback: MediaPlayback | null): void {
    this.stopTicking();
    this.unsubscribeFromPlayback();
    this.playback = playback;
    this.scrubbing = false;
    this.element.hidden = playback === null;
    this.unsubscribePlayback = playback?.subscribe?.(() => this.sync()) ?? null;
    this.sync();
    this.startTicking();
  }

  hide(): void {
    this.stopTicking();
    this.unsubscribeFromPlayback();
    this.playback = null;
    this.element.hidden = true;
  }

  destroy(): void {
    this.hide();
  }

  private startTicking(): void {
    if (this.rafHandle !== null || !this.playback) return;
    const tick = () => {
      this.sync();
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopTicking(): void {
    if (this.rafHandle === null) return;
    cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  private sync(): void {
    if (!this.playback) return;
    const loading = this.playback.isLoading?.() ?? false;
    const duration = this.playback.duration();
    const current = this.playback.currentTime();

    this.playButton.disabled = loading;
    this.playButton.classList.toggle("is-disabled", false);
    this.playButton.classList.toggle("is-loading", loading);
    this.playButton.setAttribute("aria-disabled", String(loading));
    this.playButton.replaceChildren(
      createIcon(
        loading ? "loading" : this.playback.isPlaying() ? "pause" : "play",
        { className: loading ? "sp-spin" : undefined, size: 15 },
      ),
    );
    if (!this.scrubbing) {
      this.progress.value =
        duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
    }
    this.timeLabel.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }

  private unsubscribeFromPlayback(): void {
    this.unsubscribePlayback?.();
    this.unsubscribePlayback = null;
  }

  private togglePlayback(): void {
    void this.playback?.toggle();
    this.sync();
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
