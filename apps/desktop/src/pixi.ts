// Centralize PixiJS imports behind one local boundary.
// PixiJS v8 public subpath exports are mostly side-effect initializers, so
// keeping a single adapter file makes future import/bundle strategy changes safer.
// The packaged app runs under a CSP without unsafe-eval, so swap PixiJS's
// eval-based paths for the CSP-safe implementations.
import "pixi.js/unsafe-eval";
export {
  Application,
  Assets,
  Circle,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
export type { FederatedPointerEvent, Ticker } from "pixi.js";
