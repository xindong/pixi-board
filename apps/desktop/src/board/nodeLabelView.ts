import { Container, Graphics, Text } from "../pixi";
import type { Asset, BoardNode } from "@pixi-board/board-domain";
import { displayNodeName, UNNAMED_NODE_NAME } from "@pixi-board/board-domain";
import { nodeLabelAnchor } from "./nodeLabelGeometry";

const NODE_LABEL_FONT_SIZE = 12;
const NODE_LABEL_GAP = 6;
const TAG_HEIGHT = 16;
const TAG_RADIUS = 5;
const TAG_PAD_X = 6;
const TAG_NAME_GAP = 5;
const TAG_BACKGROUND_COLOR = 0xffffff;
const TAG_BORDER_COLOR = 0x0f172a;
// Generating tags show elapsed seconds in a fixed-width pill sized for the
// widest value, so per-second updates never re-measure or redraw anything.
const GENERATING_TAG_TEMPLATE = "999s";
const GENERATING_MAX_SECONDS = 999;

export class NodeLabelView {
  readonly container = new Container();

  private readonly tagBackground = new Graphics();
  private readonly tagText: Text;
  private readonly nameText: Text;
  private tagValue = "";
  private nameValue = "";
  private generatingStartAt: number | null = null;
  private generatingTagWidth = 0;
  private generatingSeconds = -1;

  constructor() {
    this.container.eventMode = "none";

    this.tagText = new Text({
      text: "",
      style: {
        fill: "rgba(37, 99, 235, 0.94)",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.2,
        lineHeight: 10,
      },
    });
    this.tagText.anchor.set(0, 0.5);

    this.nameText = new Text({
      text: UNNAMED_NODE_NAME,
      style: {
        fill: "rgba(71, 85, 105, 0.82)",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: NODE_LABEL_FONT_SIZE,
        fontWeight: "500",
        lineHeight: 13,
      },
    });
    this.nameText.anchor.set(0, 0.5);

    this.container.addChild(this.tagBackground, this.tagText, this.nameText);
  }

  update(node: BoardNode, asset: Asset | undefined, scale: number, editing: boolean): void {
    const name = displayNodeName(node.name);
    if (this.nameValue !== name) {
      this.nameValue = name;
      this.nameText.text = name;
    }
    if (node.type === "generating") {
      this.enterGeneratingTag(asset?.createdAt);
    } else {
      if (this.generatingStartAt !== null) {
        this.exitGeneratingTag();
      }
      const tag = nodeTypeTag(node, asset);
      if (this.tagValue !== tag) {
        this.tagValue = tag;
        this.tagText.text = tag;
        this.drawTagBackground(Math.ceil(this.tagText.width + TAG_PAD_X * 2));
      }
    }

    this.layout();
    const anchor = nodeLabelAnchor(node);
    const safeScale = Math.max(scale, 0.0001);
    this.container.position.set(
      anchor.x,
      anchor.y - (NODE_LABEL_GAP + TAG_HEIGHT) / safeScale,
    );
    this.container.scale.set(1 / safeScale);
    this.container.visible = !editing;
  }

  hitTest(
    screenPoint: { x: number; y: number },
    scale: number,
    offset: { x: number; y: number },
    padding: number,
  ): boolean {
    if (!this.container.visible) return false;

    const x = this.container.position.x * scale + offset.x;
    const y = this.container.position.y * scale + offset.y;
    const width = this.container.width * scale;
    const height = this.container.height * scale;
    return (
      screenPoint.x >= x - padding &&
      screenPoint.x <= x + width + padding &&
      screenPoint.y >= y - padding &&
      screenPoint.y <= y + height + padding
    );
  }

  setEditing(editing: boolean): void {
    this.container.visible = !editing;
  }

  tickGenerating(nowMs: number): void {
    if (this.generatingStartAt === null) return;
    const seconds = Math.min(
      GENERATING_MAX_SECONDS,
      Math.max(0, Math.floor((nowMs - this.generatingStartAt) / 1000)),
    );
    if (seconds === this.generatingSeconds) return;
    this.generatingSeconds = seconds;
    this.tagText.text = `${seconds}s`;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private enterGeneratingTag(createdAt: number | undefined): void {
    if (this.generatingStartAt === null) {
      this.generatingStartAt =
        typeof createdAt === "number" && Number.isFinite(createdAt) && createdAt > 0
          ? createdAt
          : Date.now();
      this.generatingSeconds = -1;
      this.tagValue = "";
      this.tagText.text = GENERATING_TAG_TEMPLATE;
      this.generatingTagWidth = Math.ceil(this.tagText.width + TAG_PAD_X * 2);
      this.tagText.anchor.set(0.5, 0.5);
      this.drawTagBackground(this.generatingTagWidth);
    }
    this.tickGenerating(Date.now());
  }

  private exitGeneratingTag(): void {
    this.generatingStartAt = null;
    this.generatingSeconds = -1;
    this.tagText.anchor.set(0, 0.5);
  }

  private layout(): void {
    if (this.generatingStartAt !== null) {
      this.tagText.position.set(this.generatingTagWidth / 2, TAG_HEIGHT / 2);
      this.nameText.position.set(this.generatingTagWidth + TAG_NAME_GAP, TAG_HEIGHT / 2);
      return;
    }
    const tagWidth = Math.ceil(this.tagText.width + TAG_PAD_X * 2);
    this.tagText.position.set(TAG_PAD_X, TAG_HEIGHT / 2);
    this.nameText.position.set(tagWidth + TAG_NAME_GAP, TAG_HEIGHT / 2);
  }

  private drawTagBackground(width: number): void {
    this.tagBackground.clear();
    this.tagBackground
      .roundRect(0, 0, width, TAG_HEIGHT, TAG_RADIUS)
      .fill({ color: TAG_BACKGROUND_COLOR, alpha: 0.72 })
      .stroke({ color: TAG_BORDER_COLOR, width: 1, alpha: 0.1 });
  }
}

function nodeTypeTag(node: BoardNode, asset: Asset | undefined): string {
  const kind = asset?.kind ?? node.type;
  if (kind === "image") return "IMG";
  if (kind === "video") return formatDurationTag(asset?.duration, "VIDEO");
  if (kind === "audio") return formatDurationTag(asset?.duration, "AUDIO");
  if (kind === "model") return "3D";
  if (kind === "html") return "HTML";
  if (kind === "markdown") return "MD";
  if (kind === "text") return "TXT";
  return kind.toUpperCase();
}

function formatDurationTag(duration: number | undefined, fallback: string): string {
  if (!Number.isFinite(duration) || !duration || duration <= 0) return fallback;
  const rounded = Math.max(1, Math.round(duration));
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
