import { describe, expect, it, vi } from "vitest";
import { createMediaPlaybackController } from "./mediaPlayback";

describe("createMediaPlaybackController", () => {
  it("activates and controls an audio element lazily", async () => {
    const audio = new FakeMediaElement(123) as unknown as HTMLAudioElement;
    const activateElement = vi.fn(async () => audio);
    let currentElement: HTMLMediaElement | null = null;
    const controller = createMediaPlaybackController({
      activateElement: async () => {
        currentElement = await activateElement();
        return currentElement;
      },
      durationFallback: undefined,
      getElement: () => currentElement,
      isActive: () => true,
    });

    expect(controller.controls.isReady?.()).toBe(false);
    await controller.controls.toggle();

    expect(activateElement).toHaveBeenCalledTimes(1);
    expect(controller.controls.isReady?.()).toBe(true);
    expect(controller.controls.isPlaying()).toBe(true);
    expect(controller.controls.duration()).toBe(123);

    controller.controls.seek(7);
    const activeElement = currentElement as HTMLMediaElement | null;
    expect(activeElement?.currentTime).toBe(7);

    await controller.controls.toggle();
    expect(controller.controls.isPlaying()).toBe(false);
  });

  it("reports loading while activation is pending", async () => {
    const audio = new FakeMediaElement(123) as unknown as HTMLAudioElement;
    let resolveActivation: (element: HTMLMediaElement) => void = () => {};
    const activateElement = vi.fn(
      () => new Promise<HTMLMediaElement>((resolve) => {
        resolveActivation = resolve;
      }),
    );
    let currentElement: HTMLMediaElement | null = null;
    const controller = createMediaPlaybackController({
      activateElement: async () => {
        currentElement = await activateElement();
        return currentElement;
      },
      durationFallback: undefined,
      getElement: () => currentElement,
      isActive: () => true,
    });

    const toggled = controller.controls.toggle();
    expect(activateElement).toHaveBeenCalledTimes(1);
    expect(controller.controls.isLoading?.()).toBe(true);

    resolveActivation(audio as unknown as HTMLMediaElement);
    await toggled;

    expect(controller.controls.isLoading?.()).toBe(false);
    expect(controller.controls.isPlaying()).toBe(true);
  });
});

class FakeMediaElement extends EventTarget {
  currentTime = 0;
  ended = false;
  paused = true;

  constructor(public duration: number) {
    super();
  }

  async play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  }

  pause(): void {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}
