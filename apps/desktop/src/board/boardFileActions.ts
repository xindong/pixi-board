import type { BoardNode } from "@pixi-board/board-domain";
import type { BoardRepository } from "../storage/boardRepository";
import type { AppStatus } from "../status";
import type { BoardStore } from "./boardStore";

type BoardFileActionsOptions = {
  onStatus: (status: AppStatus) => void;
  repository: BoardRepository;
  store: BoardStore;
};

export class BoardFileActions {
  private readonly onStatus: BoardFileActionsOptions["onStatus"];
  private readonly repository: BoardRepository;
  private readonly store: BoardStore;

  constructor(options: BoardFileActionsOptions) {
    this.onStatus = options.onStatus;
    this.repository = options.repository;
    this.store = options.store;
  }

  downloadNode(node: BoardNode): void {
    const asset = this.store.getAsset(node.assetId);
    if (!asset?.localPath) {
      this.onStatus("downloadFailed");
      return;
    }

    this.onStatus("downloading");
    this.repository
      .exportAsset(asset.id)
      .then(() => this.onStatus("downloaded"))
      .catch((error) => {
        console.error(error);
        this.onStatus("downloadFailed");
      });
  }

  revealProject(): void {
    this.repository.revealProject().catch((error) => {
      console.error(error);
      this.onStatus("failed");
    });
  }

  revealAsset(assetId: string): void {
    this.repository.revealAsset(assetId).catch((error) => {
      console.error(error);
      this.onStatus("failed");
    });
  }
}
