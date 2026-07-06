import type { Container } from "../pixi";
import type { NodeLabelLayer } from "./nodeLabelLayer";

type BoardSceneLabelPortOptions = {
  labelLayer: NodeLabelLayer;
  overlayLayer: Container;
};

export class BoardSceneLabelPort {
  private readonly labelLayer: NodeLabelLayer;
  private readonly overlayLayer: Container;

  constructor(options: BoardSceneLabelPortOptions) {
    this.labelLayer = options.labelLayer;
    this.overlayLayer = options.overlayLayer;
  }

  hitTest(screenPoint: { x: number; y: number }): string | null {
    return this.labelLayer.hitTest(screenPoint, this.overlayLayer.scale.x, {
      x: this.overlayLayer.position.x,
      y: this.overlayLayer.position.y,
    });
  }

  setEditingNodeLabel(nodeId: string | null): void {
    this.labelLayer.setEditingNodeLabel(nodeId);
  }
}
