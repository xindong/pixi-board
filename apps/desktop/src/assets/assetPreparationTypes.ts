import type { BoardRepository } from "../storage/boardRepository";
import type { Asset } from "@pixi-board/board-domain";

export type AssetPreparationRepository = Pick<
  BoardRepository,
  "resolveAssetUrl" | "saveDerivative" | "saveDerivatives" | "updateAssetMetadata"
>;

export type AssetPreparationContext = {
  force?: boolean;
  priority?: "background" | "user";
  refreshPreviewOnly?: boolean;
  size?: {
    width?: number;
    height?: number;
  };
};

export interface AssetPreparationStage {
  supports(asset: Asset, context?: AssetPreparationContext): boolean;
  prepare(asset: Asset, context?: AssetPreparationContext): Promise<Asset>;
}
