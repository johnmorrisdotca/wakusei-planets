// Which way a body spins, as the space view's help mode shows it: the axis it turns about (by the right-hand rule, so the fingers curl the way it turns) and the line of its poles. Pure.
import { orientation } from "../scene/orient.ts";
import type { BodyId } from "../facts.ts";
import { cross, length, unit, type Vec3 } from "../vec.ts";

/**
 * How a body turns at one moment: `axis`, the unit vector it turns about by the right-hand rule (the fingers of the right hand curl the way the body turns when the thumb points along it, so it points to the north
 * pole of a body that turns the usual way and to the south pole of one that turns backwards, Venus and Uranus), and `pole`, the unit vector to its north pole as the IAU defines it.
 *
 * @example
 * ```ts
 * import type { SpinAxis } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const earth: SpinAxis = { axis: [0, 1, 0], pole: [0, 1, 0], retrograde: false };
 * console.log(earth.retrograde);
 * ```
 */
export interface SpinAxis {
  axis: Vec3;
  pole: Vec3;
  /** True when it turns the other way from most bodies: the axis points away from the north pole. */
  retrograde: boolean;
}

/**
 * The axis a body spins about at `ms`, in the scene's axes (J2000 equatorial, y north), from how its prime meridian moves over ten minutes, so it is right for a body that turns backwards (Venus, Uranus, Pluto), one
 * that is tipped on its side (Uranus) and a moon that keeps one face to its planet (it turns once an orbit, the way it goes round).
 *
 * @param id - The body's name.
 * @param ms - The moment, in milliseconds since the Unix epoch.
 * @returns The spin axis and the north pole.
 *
 * @example
 * ```ts
 * import { spinAxis } from "@johnmorrisdotca/wakusei-planets/space";
 *
 * const venus = spinAxis("venus", Date.UTC(2026, 10, 2));
 * console.log(venus.retrograde, venus.axis.map((n) => n.toFixed(2)).join(", "));
 * ```
 */
export function spinAxis(id: BodyId, ms: number): SpinAxis {
  const now = orientation(id, ms);
  const later = orientation(id, ms + 600_000);
  const turn = cross(now.meridian, later.meridian);
  const pole = unit(now.pole);
  // a body that turns by less than a rounding error in ten minutes (none here) would have no axis: fall back to the pole
  const axis = length(turn) < 1e-12 ? pole : unit(turn);
  const along = axis[0] * pole[0] + axis[1] * pole[1] + axis[2] * pole[2];
  return { axis, pole, retrograde: along < 0 };
}
