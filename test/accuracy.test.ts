// How far the package is from JPL Horizons, the reference for the sky: the planets' directions from the Sun on five dates from 1800 to 2050, the Moon and every moon's direction from
// its planet on seven dates from 1900 to 2100. The positions are in test/data/horizons.json (scripts/fetch-horizons-reference.py makes it), so this needs no network. The limits are what
// the package is held to, about half as much again as the worst it measured, and the docs' accuracy page gives the same numbers. A limit may only be raised with a reason.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { heliocentric, moonGeocentric, moonVector } from "../src/ephemeris.ts";
import { ORBITS } from "../src/data/orbits.ts";
import { length, RAD, type Vec3 } from "../src/vec.ts";

type Reference = { planetDates: string[]; moonDates: string[]; planets: Record<string, Vec3[]>; moons: Record<string, Vec3[]> };
const reference = JSON.parse(readFileSync(new URL("./data/horizons.json", import.meta.url), "utf8")) as Reference;
const AU_KM = 149597870.7;

/** The worst direction error in arc-seconds from the Sun, over the dates, for each planet. */
const PLANET_ARCSEC: Record<string, number> = { mercury: 3.5, venus: 1, earth: 2.2, mars: 2.2, jupiter: 2.8, saturn: 5.6, uranus: 5.8, neptune: 5, pluto: 60 };
/** The worst direction error in degrees from the planet (from the Pluto system's barycentre for Nix and Hydra), over the dates, for the Moon and each moon. */
const MOON_DEGREES: Record<string, number> = {
  moon: 0.3, phobos: 0.9, deimos: 0.5, io: 0.15, europa: 0.15, ganymede: 0.3, callisto: 0.12,
  mimas: 1.6, enceladus: 0.65, tethys: 0.35, dione: 0.15, rhea: 0.15, titan: 0.1, iapetus: 0.35,
  miranda: 2.7, ariel: 0.6, umbriel: 0.25, titania: 0.6, oberon: 0.6,
  triton: 0.1, nereid: 9, proteus: 0.2, charon: 0.05, nix: 3, hydra: 2.4,
};

const degreesBetween = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b))))) / RAD;

test("every planet is where JPL Horizons puts it, within its limit, on every date from 1800 to 2050", () => {
  for (const [name, limit] of Object.entries(PLANET_ARCSEC)) {
    const rows = reference.planets[name]!;
    rows.forEach((horizons, i) => {
      const [x, y, z] = heliocentric(name as Parameters<typeof heliocentric>[0], Date.parse(reference.planetDates[i]!));
      const mine: Vec3 = [x * AU_KM, y * AU_KM, z * AU_KM];
      const arcseconds = degreesBetween(mine, horizons) * 3600;
      assert.ok(arcseconds <= limit, `${name} on ${reference.planetDates[i]} is ${arcseconds.toFixed(0)} arc-seconds from Horizons, the limit is ${limit}`);
    });
  }
});

test("the Moon and every moon are where JPL Horizons puts them, within their limits, on every date from 1900 to 2100", () => {
  for (const [name, limit] of Object.entries(MOON_DEGREES)) {
    const rows = reference.moons[name]!;
    rows.forEach((horizons, i) => {
      const ms = Date.parse(reference.moonDates[i]!);
      const mine = name === "moon" ? moonGeocentric(ms) : moonVector(name as Parameters<typeof moonVector>[0], ms);
      const degrees = degreesBetween(mine, horizons);
      assert.ok(degrees <= limit, `${name} on ${reference.moonDates[i]} is ${degrees.toFixed(2)} degrees from Horizons, the limit is ${limit}`);
    });
  }
});

test("every moon with an orbit in the table is measured, and no limit is for a body the package does not have", () => {
  for (const name of Object.keys(ORBITS)) if (name in MOON_DEGREES === false && name in reference.moons === false) assert.ok(["dysnomia", "hiiaka", "namaka", "vanth"].includes(name), `${name} has no accuracy limit`);
  for (const name of [...Object.keys(MOON_DEGREES), ...Object.keys(PLANET_ARCSEC)]) assert.ok(name in reference.moons || name in reference.planets, name);
});
