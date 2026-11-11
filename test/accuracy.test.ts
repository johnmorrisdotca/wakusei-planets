// How far the package is from JPL Horizons, the reference for the sky: the planets' directions from the Sun on five dates from 1800 to 2050, the Moon and every moon's direction from
// its planet on seven dates from 1900 to 2100. The positions are in test/data/horizons.json (scripts/fetch-horizons-reference.py makes it), so this needs no network. The limits are what
// the package is held to, about half as much again as the worst it measured, and the docs' accuracy page gives the same numbers. A limit may only be raised with a reason.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { heliocentric, moonGeocentric, moonVector } from "../src/ephemeris.ts";
import "../src/tables/all.ts";
import { ORBITS } from "../src/data/orbits.ts";
import { length, RAD, type Vec3 } from "../src/vec.ts";

type Reference = { planetDates: string[]; moonDates: string[]; dwarfDates: string[]; planets: Record<string, Vec3[]>; moons: Record<string, Vec3[]>; dwarfs: Record<string, Vec3[]> };
const minorReference = JSON.parse(readFileSync(new URL("./data/horizons-minor.json", import.meta.url), "utf8")) as { minorDates: string[]; minors: Record<string, Vec3[]> };
const reference = JSON.parse(readFileSync(new URL("./data/horizons.json", import.meta.url), "utf8")) as Reference;
const AU_KM = 149597870.7;

/** The worst direction error in arc-seconds from the Sun, over the dates, for each planet. */
const PLANET_ARCSEC: Record<string, number> = { mercury: 3.5, venus: 1, earth: 2.2, mars: 2.2, jupiter: 1.6, saturn: 5.6, uranus: 5.8, neptune: 2.5, pluto: 0.3 };
/** The worst direction error in arc-seconds from the Sun, over the dates from 1900 to 2100, for each dwarf planet besides Pluto. */
const DWARF_ARCSEC: Record<string, number> = { ceres: 0.3, orcus: 0.1, haumea: 0.1, quaoar: 0.15, makemake: 0.15, gonggong: 0.1, eris: 0.1, sedna: 0.1 };
/** The worst direction error in arc-seconds from the Sun for each minor body, on the dates inside its fitted table's years (Vesta and Pallas 1900 to 2100, the others 1800 to 2200): the fits are held to 1 arc-second, and the measured worst is under 0.6. */
const MINOR_ARCSEC: Record<string, number> = { vesta: 1, pallas: 1, chiron: 1, pholus: 1, halley: 1 };
const MINOR_YEARS: Record<string, [number, number]> = { vesta: [1900, 2100], pallas: [1900, 2100], chiron: [1800, 2200], pholus: [1800, 2200], halley: [1800, 2200] };
/** The worst direction error in degrees from the planet (from the Pluto system's barycentre for Nix and Hydra), over the dates, for the Moon and each moon. */
const MOON_DEGREES: Record<string, number> = {
  moon: 0.0008, phobos: 0.5, deimos: 0.45, io: 0.08, europa: 0.03, ganymede: 0.022, callisto: 0.008,
  mimas: 1, enceladus: 0.32, tethys: 0.06, dione: 0.15, rhea: 0.15, titan: 0.025, iapetus: 0.025,
  miranda: 1.6, ariel: 0.3, umbriel: 0.13, titania: 0.25, oberon: 0.6,
  triton: 0.1, nereid: 3.6, proteus: 0.15, charon: 0.05, nix: 2.4, hydra: 2.4,
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

test("every dwarf planet is where JPL Horizons puts it, within its limit, on every date from 1900 to 2100", () => {
  for (const [name, limit] of Object.entries(DWARF_ARCSEC)) {
    const rows = reference.dwarfs[name]!;
    rows.forEach((horizons, i) => {
      const [x, y, z] = heliocentric(name as Parameters<typeof heliocentric>[0], Date.parse(reference.dwarfDates[i]!));
      const arcseconds = degreesBetween([x * AU_KM, y * AU_KM, z * AU_KM], horizons) * 3600;
      assert.ok(arcseconds <= limit, `${name} on ${reference.dwarfDates[i]} is ${arcseconds.toFixed(2)} arc-seconds from Horizons, the limit is ${limit}`);
    });
  }
});

test("each minor body is where JPL Horizons puts it, within 1 arc-second, on every date inside its table's years", () => {
  for (const [name, limit] of Object.entries(MINOR_ARCSEC)) {
    const rows = minorReference.minors[name]!;
    const [first, last] = MINOR_YEARS[name]!;
    let measured = 0;
    rows.forEach((horizons, i) => {
      const date = minorReference.minorDates[i]!;
      const year = Number(date.slice(0, 4));
      if (year < first || year >= last) return;
      const [x, y, z] = heliocentric(name as Parameters<typeof heliocentric>[0], Date.parse(date));
      const arcseconds = degreesBetween([x * AU_KM, y * AU_KM, z * AU_KM], horizons) * 3600;
      measured += 1;
      assert.ok(arcseconds <= limit, `${name} on ${date} is ${arcseconds.toFixed(2)} arc-seconds from Horizons, the limit is ${limit}`);
      assert.ok(arcseconds < 5);
    });
    assert.ok(measured >= 8, `${name}: ${measured} dates measured`);
  }
});

test("Halley's comet is at its perihelion in February 1986, 0.587 au from the Sun, and far out in 2023", () => {
  const near = length(heliocentric("halley", Date.UTC(1986, 1, 9, 12)));
  assert.ok(Math.abs(near - 0.587) < 0.001, String(near));
  assert.ok(length(heliocentric("halley", Date.UTC(2023, 11, 9))) > 35);
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
  for (const name of [...Object.keys(MOON_DEGREES), ...Object.keys(PLANET_ARCSEC), ...Object.keys(DWARF_ARCSEC)]) assert.ok(name in reference.moons || name in reference.planets || name in reference.dwarfs, name);
});
