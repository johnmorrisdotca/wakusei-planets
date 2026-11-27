import { asteroidList, asteroidPeriodDays } from "../src/asteroids.ts";
import { listComets } from "../src/comets.ts";
import { DWARF_ELEMENTS } from "../src/data/dwarf.ts";
import { MINOR_ELEMENTS } from "../src/data/minor.ts";
import { ORBITS } from "../src/data/orbits.ts";
import { PLANET_KEPLER } from "../src/data/planet-kepler.ts";
import { kepler } from "../src/ephemeris.ts";
import { BODIES, DWARF_IDS, MINOR_IDS, type HostId } from "../src/facts.ts";
import { factSheet } from "../src/fact-sheets.ts";
import { MOON_CATALOGUE } from "../src/moon-catalogue.ts";

type Name = { en: string; ja: string };

export interface ExplorerOrbit {
  id: string;
  name: Name;
  /** Semimajor axis in the system's unit. */
  axis: number;
  eccentricity: number;
  periodDays: number;
}

export interface OrbitSystem {
  id: "sun" | HostId;
  name: Name;
  distanceUnit: "au" | "km";
  orbits: ExplorerOrbit[];
  /** Comets on open paths or moons with no usable elements in the catalogue. */
  withoutPeriod: { name: Name; reason: "open" | "missing" }[];
}

/** Keep periods in their own system. A moon's axis and period are measured about its planet. */
export function orbitSystems(): OrbitSystem[] {
  const sun: OrbitSystem = { id: "sun", name: BODIES.sun.name, distanceUnit: "au", orbits: [], withoutPeriod: [] };
  for (const { id, elements, validFromYear } of PLANET_KEPLER) {
    if (validFromYear !== 1800) continue;
    sun.orbits.push({ id, name: BODIES[id].name, axis: elements[0], eccentricity: elements[1], periodDays: factSheet(id).yearDays! });
  }
  for (const id of DWARF_IDS) {
    const { a, e, n } = DWARF_ELEMENTS[id];
    sun.orbits.push({ id, name: BODIES[id].name, axis: a, eccentricity: e, periodDays: 360 / n });
  }
  for (const id of MINOR_IDS) {
    if (id === "halley") continue; // the comet catalogue supplies its orbit
    const { a, e, n } = MINOR_ELEMENTS[id];
    sun.orbits.push({ id, name: BODIES[id].name, axis: a, eccentricity: e, periodDays: 360 / n });
  }
  for (const asteroid of asteroidList()) {
    sun.orbits.push({ id: `asteroid:${asteroid.id}`, name: asteroid.name, axis: asteroid.elements.a, eccentricity: asteroid.elements.e, periodDays: asteroidPeriodDays(asteroid) });
  }
  for (const { id, name, a, e, periodYears } of listComets()) {
    if (a === null || periodYears === null) sun.withoutPeriod.push({ name, reason: "open" });
    else sun.orbits.push({ id, name, axis: a, eccentricity: e, periodDays: periodYears * 365.25 });
  }
  const hosts = new Map<HostId, OrbitSystem>();
  for (const { id, host, label, ja, orbit } of MOON_CATALOGUE) {
    let system = hosts.get(host);
    if (system === undefined) {
      system = { id: host, name: BODIES[host].name, distanceUnit: "km", orbits: [], withoutPeriod: [] };
      hosts.set(host, system);
    }
    const name = { en: label, ja: ja ?? label };
    const fitted = ORBITS[id];
    if (orbit !== null) system.orbits.push({ id, name, axis: orbit.a, eccentricity: orbit.e, periodDays: orbit.periodDays });
    else if (fitted?.parent === host) system.orbits.push({ id, name, axis: fitted.a, eccentricity: fitted.e, periodDays: 360 / Math.abs(fitted.sid) });
    else system.withoutPeriod.push({ name, reason: "missing" });
  }
  return [sun, ...hosts.values()];
}

/** A practice orbit uses the period and semimajor axis of a reference orbit around the same body. */
export function practicePeriod(axis: number, reference: ExplorerOrbit): number {
  return reference.periodDays * (axis / reference.axis) ** 1.5;
}

/** A position in the orbital plane in units of the semimajor axis, with the focus at the origin. */
export function orbitPoint(eccentricity: number, fraction: number): readonly [number, number] {
  const anomaly = kepler(fraction * 2 * Math.PI, eccentricity);
  return [Math.cos(anomaly) - eccentricity, Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(anomaly)];
}
