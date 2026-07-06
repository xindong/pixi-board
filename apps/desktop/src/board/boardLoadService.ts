import type { AssetPipeline } from "../assets/assetPipeline";
import type { BoardRepository } from "../storage/boardRepository";
import type { AppStatus } from "../status";
import type { BoardEditor } from "./boardEditor";
import type { BoardScene } from "./boardScene";
import type { BoardStore } from "./boardStore";
import type { BoardViewport } from "./boardViewport";

type BoardLoadServiceOptions = {
  assets: AssetPipeline;
  editor: BoardEditor;
  emitZoom: () => void;
  onStatus: (status: AppStatus) => void;
  repository: BoardRepository;
  scene: BoardScene;
  setBusy: (busy: boolean, status?: AppStatus) => void;
  store: BoardStore;
  syncViewportNow: () => void;
  viewport: BoardViewport;
};

export class BoardLoadService {
  private readonly assets: AssetPipeline;
  private readonly editor: BoardEditor;
  private readonly emitZoom: BoardLoadServiceOptions["emitZoom"];
  private readonly onStatus: BoardLoadServiceOptions["onStatus"];
  private readonly repository: BoardRepository;
  private readonly scene: BoardScene;
  private readonly setBusy: BoardLoadServiceOptions["setBusy"];
  private readonly store: BoardStore;
  private readonly syncViewportNow: BoardLoadServiceOptions["syncViewportNow"];
  private readonly viewport: BoardViewport;

  constructor(options: BoardLoadServiceOptions) {
    this.assets = options.assets;
    this.editor = options.editor;
    this.emitZoom = options.emitZoom;
    this.onStatus = options.onStatus;
    this.repository = options.repository;
    this.scene = options.scene;
    this.setBusy = options.setBusy;
    this.store = options.store;
    this.syncViewportNow = options.syncViewportNow;
    this.viewport = options.viewport;
  }

  async load(options: { reloadResources?: boolean } = {}): Promise<void> {
    this.setBusy(true, "loading");
    try {
      const snapshot = await this.repository.loadSnapshot();
      const preparedAssets = await this.assets.prepareAssets(snapshot.assets);

      this.editor.loadSnapshot({
        nodes: snapshot.nodes,
        assets: preparedAssets,
      });
      if (snapshot.viewport) {
        this.viewport.loadSnapshot(snapshot.viewport);
        this.syncViewportNow();
        this.emitZoom();
      }

      this.scene.rebuildSpatialIndex(this.store.getNodes());
      if (options.reloadResources) {
        this.scene.reloadResources(this.store, this.viewport);
      } else {
        this.scene.syncData(this.store, this.viewport);
      }

      this.onStatus("loaded");
    } finally {
      this.setBusy(false);
    }
  }
}
