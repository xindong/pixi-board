import { Texture } from "../pixi";
import type { Asset, AssetVariant } from "@pixi-board/board-domain";
import { BoardTextureLoader, type LoadedTexture } from "./boardTextureLoader";

type TextureEntry = {
  key: string;
  promise: Promise<Texture>;
  refs: number;
  texture?: Texture;
  url?: string;
  managedByAssets: boolean;
  unloadTimer: number | null;
};

export type TextureLease = {
  key: string;
  texture: Texture;
};

type TextureCacheOptions = {
  resolveAssetUrl: (assetId: string, variant: AssetVariant) => Promise<string>;
  unloadDelayMs: number;
};

export class BoardTextureCache {
  private readonly loader: BoardTextureLoader;
  private readonly unloadDelayMs: number;
  private readonly entries = new Map<string, TextureEntry>();

  constructor(options: TextureCacheOptions) {
    this.loader = new BoardTextureLoader({
      resolveAssetUrl: options.resolveAssetUrl,
    });
    this.unloadDelayMs = options.unloadDelayMs;
  }

  async acquire(asset: Asset, nodeType: string = asset.kind): Promise<TextureLease> {
    const descriptor = this.loader.descriptorForAsset(asset, nodeType);
    return this.acquireDescriptor(descriptor.key, descriptor.load);
  }

  async acquirePlaceholder(kind: string, label: string): Promise<TextureLease> {
    const descriptor = this.loader.placeholderDescriptor(kind, label);
    return this.acquireDescriptor(descriptor.key, descriptor.load);
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0) {
      this.scheduleUnload(entry);
    }
  }

  destroy(): void {
    for (const entry of this.entries.values()) {
      if (entry.unloadTimer !== null) {
        window.clearTimeout(entry.unloadTimer);
        entry.unloadTimer = null;
      }
    }

    for (const key of [...this.entries.keys()]) {
      void this.unloadNow(key);
    }
  }

  private async acquireDescriptor(
    key: string,
    load: () => Promise<LoadedTexture>,
  ): Promise<TextureLease> {
    let entry = this.entries.get(key);

    if (!entry) {
      entry = this.createEntry(key, load);
      this.entries.set(key, entry);
    }

    this.cancelUnload(entry);
    entry.refs += 1;

    try {
      return { key, texture: await entry.promise };
    } catch (error) {
      entry.refs = Math.max(0, entry.refs - 1);
      this.entries.delete(key);
      throw error;
    }
  }

  private createEntry(key: string, load: () => Promise<LoadedTexture>): TextureEntry {
    let entry: TextureEntry;
    const promise = load().then((loaded) => {
      entry.texture = loaded.texture;
      entry.url = loaded.url;
      entry.managedByAssets = loaded.managedByAssets;
      return loaded.texture;
    });

    entry = {
      key,
      promise,
      refs: 0,
      managedByAssets: false,
      unloadTimer: null,
    };
    return entry;
  }

  private scheduleUnload(entry: TextureEntry): void {
    if (entry.unloadTimer !== null) return;
    entry.unloadTimer = window.setTimeout(() => {
      entry.unloadTimer = null;
      void this.unloadNow(entry.key);
    }, this.unloadDelayMs);
  }

  private cancelUnload(entry: TextureEntry): void {
    if (entry.unloadTimer === null) return;
    window.clearTimeout(entry.unloadTimer);
    entry.unloadTimer = null;
  }

  private async unloadNow(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry || entry.refs > 0) return;
    this.entries.delete(key);

    const texture = entry.texture ?? (await entry.promise.catch(() => undefined));
    if (!texture) return;

    if (entry.managedByAssets) {
      return;
    }

    texture.destroy(true);
  }
}
