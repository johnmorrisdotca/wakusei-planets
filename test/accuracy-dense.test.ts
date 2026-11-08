// The same measurement as accuracy.test.ts on many more dates: the planets and every moon on 60 dates spread over 1800 to 2200 (test/data/horizons-dense.json, scripts/fetch-horizons-dense.py makes it).
// The step is 2437 days, so no date sits on a planet's period. The limits are about a quarter more than the worst measured, and the docs' accuracy page gives the same numbers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { heliocentric, moonGeocentric, moonVector } from "../src/ephemeris.ts";
import "../src/tables/all.ts";
import { length, RAD, type Vec3 } from "../src/vec.ts";

type Dense = { dates: string[]; planets: Record<string, Vec3[]>; moons: Record<string, Vec3[]> };
const reference = JSON.parse(readFileSync(new URL("./data/horizons-dense.json", import.meta.url), "utf8")) as Dense;
const AU_KM = 149597870.7;

/** The worst direction error in arc-seconds from the Sun over the 60 dates, for each planet. */
const PLANET_ARCSEC: Record<string, number> = { mercury: 4.5, venus: 2.6, earth: 4, mars: 6, jupiter: 3.6, saturn: 5.7, uranus: 5, neptune: 3.4, pluto: 0.2 };
/** The worst direction error in degrees from the planet (from the Pluto system's barycentre for Nix and Hydra) over the 60 dates, for the Moon and each moon. */
const MOON_DEGREES: Record<string, number> = {
  moon: 0.0016, phobos: 0.55, deimos: 0.55, io: 0.15, europa: 0.05, ganymede: 0.03, callisto: 0.02,
  mimas: 2.1, enceladus: 0.72, tethys: 0.27, dione: 0.23, rhea: 0.27, titan: 0.06, iapetus: 0.04,
  miranda: 3, ariel: 0.3, umbriel: 0.28, titania: 0.52, oberon: 0.6,
  triton: 0.17, nereid: 6.3, proteus: 0.17, charon: 0.06, nix: 2.6, hydra: 2.1,
};

const degreesBetween = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b))))) / RAD;

test("every planet is where JPL Horizons puts it on 60 dates from 1800 to 2200", () => {
  assert.equal(reference.dates.length, 60);
  for (const [name, limit] of Object.entries(PLANET_ARCSEC)) {
    reference.planets[name]!.forEach((horizons, i) => {
      const [x, y, z] = heliocentric(name as Parameters<typeof heliocentric>[0], Date.parse(reference.dates[i]!));
      const arcseconds = degreesBetween([x * AU_KM, y * AU_KM, z * AU_KM], horizons) * 3600;
      assert.ok(arcseconds <= limit, `${name} on ${reference.dates[i]} is ${arcseconds.toFixed(2)} arc-seconds from Horizons, the limit is ${limit}`);
    });
  }
});

test("the Moon and every moon are where JPL Horizons puts them on 60 dates from 1800 to 2200", () => {
  for (const [name, limit] of Object.entries(MOON_DEGREES)) {
    reference.moons[name]!.forEach((horizons, i) => {
      const ms = Date.parse(reference.dates[i]!);
      const mine = name === "moon" ? moonGeocentric(ms) : moonVector(name as Parameters<typeof moonVector>[0], ms);
      const degrees = degreesBetween(mine, horizons);
      assert.ok(degrees <= limit, `${name} on ${reference.dates[i]} is ${degrees.toFixed(4)} degrees from Horizons, the limit is ${limit}`);
    });
  }
});
