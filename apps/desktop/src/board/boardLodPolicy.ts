export type BoardLodState = {
  labelMode: "hidden" | "normal";
  overlayMode: "simple" | "normal";
};

const HIDE_DETAIL_OVERLAYS_BELOW_SCALE = 0.08;

export function boardLodStateForScale(scale: number): BoardLodState {
  return {
    labelMode: scale < HIDE_DETAIL_OVERLAYS_BELOW_SCALE ? "hidden" : "normal",
    overlayMode: scale < HIDE_DETAIL_OVERLAYS_BELOW_SCALE ? "simple" : "normal",
  };
}
