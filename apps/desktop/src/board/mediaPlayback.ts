export type MediaPlayback = {
  isReady?(): boolean;
  isLoading?(): boolean;
  isPlaying(): boolean;
  duration(): number;
  currentTime(): number;
  toggle(): void | Promise<void>;
  seek(seconds: number): void;
  subscribe?(listener: () => void): () => void;
};

export type MediaPlaybackController = {
  controls: MediaPlayback;
  prepare: () => Promise<HTMLMediaElement | null>;
  teardown: () => void;
};

export type MediaPlaybackControllerOptions = {
  activateElement: () => Promise<HTMLMediaElement | null>;
  durationFallback: number | undefined;
  getElement: () => HTMLMediaElement | null;
  isActive: () => boolean;
};

const MEDIA_PLAYBACK_EVENTS = [
  "canplay",
  "durationchange",
  "ended",
  "loadedmetadata",
  "pause",
  "play",
  "seeked",
  "timeupdate",
] as const;

export function createMediaPlaybackController(
  options: MediaPlaybackControllerOptions,
): MediaPlaybackController {
  const listeners = new Set<() => void>();
  let boundElement: HTMLMediaElement | null = null;
  let loadingElement: Promise<HTMLMediaElement | null> | null = null;
  let requestedPlaying = false;
  let ready = false;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const handleMediaEvent = (event: Event) => {
    if (event.type === "ended") {
      requestedPlaying = false;
    }
    notify();
  };

  const unbind = () => {
    if (!boundElement) return;
    for (const eventName of MEDIA_PLAYBACK_EVENTS) {
      boundElement.removeEventListener(eventName, handleMediaEvent);
    }
    boundElement = null;
  };

  const bind = () => {
    const element = options.getElement();
    if (element === boundElement) return element;

    unbind();
    if (!element) return null;

    boundElement = element;
    for (const eventName of MEDIA_PLAYBACK_EVENTS) {
      boundElement.addEventListener(eventName, handleMediaEvent);
    }
    return boundElement;
  };

  const ensureElement = async () => {
    const current = bind();
    if (current) return current;

    if (!loadingElement) {
      loadingElement = options.activateElement().finally(() => {
        loadingElement = null;
        notify();
      });
      notify();
    }

    const loaded = await loadingElement;
    if (!options.isActive()) return null;

    ready = Boolean(loaded);
    bind();
    notify();
    return loaded;
  };

  const playElement = async (element: HTMLMediaElement) => {
    try {
      if (element.ended) {
        element.currentTime = 0;
      }
      await element.play();
    } catch (error) {
      requestedPlaying = false;
      console.warn("Media playback failed", error);
    } finally {
      notify();
    }
  };

  const pauseElement = (element: HTMLMediaElement | null) => {
    if (element) element.pause();
    notify();
  };

  const controls: MediaPlayback = {
    isReady: () => ready || Boolean(bind()),
    isLoading: () => Boolean(loadingElement),
    isPlaying: () => {
      const element = bind();
      return Boolean(element) && !element!.paused && !element!.ended;
    },
    duration: () => resolveMediaDuration(bind()?.duration, options.durationFallback),
    currentTime: () => bind()?.currentTime ?? 0,
    toggle: async () => {
      const element = bind();
      const isActuallyPlaying = Boolean(element) && !element!.paused && !element!.ended;

      if (requestedPlaying || isActuallyPlaying) {
        requestedPlaying = false;
        pauseElement(element);
        return;
      }

      requestedPlaying = true;
      notify();

      if (!element) {
        const loaded = await ensureElement();
        if (loaded && requestedPlaying) await playElement(loaded);
        else if (loaded) pauseElement(loaded);
        return;
      }

      if (element.paused || element.ended) {
        await playElement(element);
      } else {
        notify();
      }
    },
    seek: (seconds) => {
      const element = bind();
      if (element) element.currentTime = seconds;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      bind();
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    controls,
    prepare: ensureElement,
    teardown: () => {
      requestedPlaying = false;
      bind()?.pause();
      unbind();
      listeners.clear();
    },
  };
}

export function resolveMediaDuration(
  elementDuration: number | undefined,
  assetDuration: number | undefined,
): number {
  if (elementDuration !== undefined && Number.isFinite(elementDuration) && elementDuration > 0) {
    return elementDuration;
  }
  return assetDuration ?? 0;
}
