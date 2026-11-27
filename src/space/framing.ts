import type { BodyId } from "../facts.ts";
import type { BodyPlace } from "./scene.ts";

/**
 * A named view of the body in focus. Whole includes the ring envelope. Close is sized by the globe.
 * @example
 * ```ts
 * import type { BodyFraming } from "@johnmorrisdotca/wakusei-planets/space/element";
 * const framing: BodyFraming = "whole";
 * console.log(framing);
 * ```
 */
export type BodyFraming = "whole" | "close";

/**
 * Options for the framing query. Sizes are a share of the shorter side and screen places are in CSS pixels.
 * @example
 * ```ts
 * import type { BodyFramingOptions } from "@johnmorrisdotca/wakusei-planets/space/element";
 * const options: BodyFramingOptions = { share: 0.65, companion: "sun" };
 * console.log(options.share);
 * ```
 */
export interface BodyFramingOptions {
  /** Requested diameter as a share of the shorter side. Whole defaults to two thirds and Close to 1.8. */
  share?: number;
  /** A second body to project, even when its centre would be outside the screen. Beside a moon, its host is the default. */
  companion?: BodyId;
  /** An exact zoom to inspect. It takes precedence over the requested share. */
  zoom?: number;
}

type FramingSpot = Pick<BodyPlace, "x" | "y" | "r">;

/**
 * A proposed zoom and the predicted positions in the picture with pan reset. The body's radius is for its globe.
 * @example
 * ```ts no-run
 * import type { BodyFramingResult, WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 * const space = document.querySelector<WakuseiSpace>("wakusei-space")!;
 * const view: BodyFramingResult | null = space.framingFor(space.body, "whole", { companion: "sun" });
 * console.log(view?.companion);
 * ```
 */
export interface BodyFramingResult {
  zoom: number;
  /** Diameter of the selected framing as a share of the shorter side. */
  share: number;
  /** The requested zoom or size is outside the camera's range. */
  clamped: boolean;
  body: FramingSpot;
  /** The companion's projected place, or null when it is behind the camera or unavailable. */
  companion: FramingSpot | null;
}

export interface FramingInput {
  width: number;
  height: number;
  beside: boolean;
  host: BodyId | null;
  /** Position the preview camera and project the globe. Whole uses an enclosing radius for the rings. */
  sample(zoom: number, kind: BodyFraming, companion?: BodyId): { body: FramingSpot; extent: number; companion: FramingSpot | null };
}

export interface FramingSnapshot {
  focus: BodyId;
  beside: boolean;
  forBody(id: BodyId): FramingInput | null;
}

const DEFAULT_SHARE: Readonly<Record<BodyFraming, number>> = { whole: 2 / 3, close: 1.8 };

export function solveFraming(input: FramingInput, kind: BodyFraming, options: BodyFramingOptions, limits: { zoomMin: number; zoomMax: number }): BodyFramingResult | null {
  const { width, height } = input;
  const side = Math.min(width, height);
  const asked = options.share ?? DEFAULT_SHARE[kind];
  const fixed = options.zoom;
  const requested = fixed ?? asked;
  if (!(side > 0) || !Number.isFinite(requested) || requested <= 0) return null;
  const { zoomMin, zoomMax } = limits;
  const wanted = (asked * side) / 2;
  const radiusAt = (zoom: number): number => input.sample(zoom, kind).extent;
  let zoom = zoomMin;
  if (fixed !== undefined) zoom = Math.max(zoomMin, Math.min(zoomMax, fixed));
  else {
    // The normal camera only gets closer. Beside a moon the field of view also changes and the
    // widest attainable globe can be before the zoom limit, so look for the first crossing.
    let lo = zoomMin;
    let hi = zoomMax;
    let closest = zoomMin;
    const start = radiusAt(lo);
    let closestGap = Math.abs(start - wanted);
    if (start < wanted) {
      const steps = input.beside ? 48 : 1;
      for (let step = 1; step <= steps; step += 1) {
        hi = step === steps ? zoomMax : zoomMin + (zoomMax - zoomMin) * (step / steps);
        const radius = radiusAt(hi);
        const gap = Math.abs(radius - wanted);
        if (gap < closestGap) {
          closest = hi;
          closestGap = gap;
        }
        if (radius >= wanted) {
          for (let i = 0; i < 22; i += 1) {
            const middle = (lo + hi) / 2;
            if (radiusAt(middle) < wanted) lo = middle;
            else hi = middle;
          }
          closest = (lo + hi) / 2;
          break;
        }
        lo = hi;
      }
    }
    zoom = closest;
  }
  const found = input.sample(zoom, kind, options.companion ?? input.host ?? undefined);
  return { zoom, share: 2 * found.extent / side, clamped: fixed !== undefined ? zoom !== fixed : Math.abs(found.extent - wanted) > 0.05, body: found.body, companion: found.companion };
}
