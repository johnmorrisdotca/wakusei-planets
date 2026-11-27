import type { Apparent } from "../ephemeris.ts";
import { BODIES, type BodyId } from "../facts.ts";
import * as catalogue from "../moon-catalogue.ts";
import type { MoonFilter } from "../moon-filters.ts";
import { createMoonLayer, moonDotOffset } from "../space/all-moons.ts";
import { moonSourceOf } from "../space/moon-settings.ts";
import { dot, OBLIQUITY, RAD, type Vec3 } from "../vec.ts";
import type { BodyMoonCatalogue } from "./body.ts";

const sine = Math.sin(OBLIQUITY * RAD);
const cosine = Math.cos(OBLIQUITY * RAD);
const eclipticAxes: readonly Vec3[] = [[1, 0, 0], [0, sine, cosine], [0, -cosine, sine]];
const LIGHT_KM_PER_SECOND = 299_792.458;

export function bodyMoonSelection(host: BodyId, filter: MoonFilter, all: boolean) {
  const hostMoons = catalogue.MOON_CATALOGUE.filter((moon) => moon.host === host);
  const selected = catalogue.filterMoonCatalogue(filter, hostMoons);
  const source = all ? moonSourceOf(catalogue, selected, filter.discovered !== undefined) : undefined;
  return {
    full: new Set(selected.filter((moon) => moon.full).map((moon) => moon.id)),
    source: source === undefined ? undefined : { ...source, moons: source.moons.filter((moon) => !moon.full) },
    extent: all ? Math.max(0, ...hostMoons.map((moon) => moon.orbit === null ? 0 : moon.orbit.a * (1 + moon.orbit.e))) * 1.08 / BODIES[host].radiusKm : 0,
  };
}

export function bodyMoonCatalogue(selection: ReturnType<typeof bodyMoonSelection>, host: BodyId, pose: Apparent, time: number, rotate: (vector: Vec3) => Vec3): BodyMoonCatalogue | undefined {
  if (selection.source === undefined || selection.source.moons.length === 0) return undefined;
  const { right, up, toward } = pose.frame;
  const axis = (ecliptic: Vec3): Vec3 => rotate([dot(ecliptic, right), dot(ecliptic, up), dot(ecliptic, toward)]);
  return {
    source: selection.source,
    create: createMoonLayer,
    hosts: new Set([host]),
    axes: [axis(eclipticAxes[0]!), axis(eclipticAxes[1]!), axis(eclipticAxes[2]!)],
    time: time - pose.distanceKm / LIGHT_KM_PER_SECOND * 1000,
  };
}

export function bodyMoonPoint(catalogue: BodyMoonCatalogue, host: Parameters<typeof moonDotOffset>[1]["host"], km: Vec3): Vec3 {
  const offset = moonDotOffset("true", { host, km });
  const [x, y, z] = catalogue.axes;
  return [
    x[0] * offset[0] + y[0] * offset[1] + z[0] * offset[2],
    x[1] * offset[0] + y[1] * offset[1] + z[1] * offset[2],
    x[2] * offset[0] + y[2] * offset[1] + z[2] * offset[2],
  ];
}
