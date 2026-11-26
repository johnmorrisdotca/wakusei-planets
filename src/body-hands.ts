// Whether a body takes the shared hands, and how its camera is handed to a line globe that draws itself.

/** A still and another package's shaded Earth do not take the hands. The line Earth does: the view is passed on to its globe. */
export const bodyHandsOn = (live: string | null, delegating: "line" | "shaded" | undefined): boolean => live !== "off" && delegating !== "shaded";

/** The camera a line globe understands: turn, tip, zoom and pan in CSS pixels. */
export interface LineView {
  yaw: number;
  tilt: number;
  zoom: number;
  panX: number;
  panY: number;
}

/** Hand the body's camera to a line globe, when that globe has `setView`. A shaded picture that moves itself is left alone. */
export const passLineView = (el: unknown, view: { yaw?: number; tilt?: number; zoom?: number; panX?: number; panY?: number }): void => {
  const target = el as { setView?: (view: LineView, final?: boolean) => void } | null | undefined;
  if (target === null || target === undefined || typeof target.setView !== "function") return;
  target.setView({ yaw: view.yaw ?? 0, tilt: view.tilt ?? 0, zoom: view.zoom ?? 1, panX: view.panX ?? 0, panY: view.panY ?? 0 }, true);
};
