// How far from a body's middle to the edge of its picture at zoom 1, in body radii: the size of the picture, which the zoom and the zoom limit are measured against. Pure.
import { nearMoons } from "../ephemeris.ts";
import { BODIES, ringReach, type BodyFacts, type BodyId, type HostId } from "../facts.ts";

/** The half-width of a body's picture, in its radii, when it has no scale of its own: the globe takes a little under half the height, so its rings, glow and haze have room round it. */
export const ROOM = 2.2;

export function extentOf(f: BodyFacts, options: { scaleTo?: BodyId; spanKm?: number; moons?: boolean; range?: number; tight?: boolean }): number {
  if (options.moons === true && f.parent === undefined && f.id !== "sun") {
    const near = nearMoons(f.id as HostId);
    const far = Math.max(1.8, ringReach(f) * 1.15, ...near.map((m) => m.reach * 1.1));
    return options.range ?? far;
  }
  if (options.spanKm !== undefined) return options.spanKm / f.radiusKm;
  if (options.scaleTo !== undefined) return (BODIES[options.scaleTo].radiusKm * 1.06) / f.radiusKm;
  if (options.tight !== true) return ROOM;
  // tight (a thumbnail): the picture holds the body and its rings, and an irregular body (Deimos, Phobos, Nix, Hydra) whole along its longest axis
  const longest = f.axesKm === undefined ? 1 : Math.max(...f.axesKm) / f.radiusKm;
  return Math.max(1.06, ringReach(f) * 1.04, longest * 1.06);
}
