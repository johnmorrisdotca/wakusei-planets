import assert from "node:assert/strict";
import { test } from "node:test";
import { orbitPoint, orbitSystems, practicePeriod } from "../demo/kepler-orbits.ts";
import { asteroidList } from "../src/asteroids.ts";
import { listComets } from "../src/comets.ts";
import { DWARF_IDS, MINOR_IDS, PLANET_IDS } from "../src/facts.ts";
import { MOON_CATALOGUE } from "../src/moon-catalogue.ts";

test("each natural-body catalogue contributes its orbits in the units and system they belong to", () => {
  const [sun, ...hosts] = orbitSystems();
  assert.equal(sun!.distanceUnit, "au");
  const ids = sun!.orbits.map(({ id }) => id);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of [...PLANET_IDS, ...DWARF_IDS, ...MINOR_IDS]) assert.ok(ids.includes(id), id);
  for (const { id } of asteroidList()) assert.ok(ids.includes(`asteroid:${id}`), id);
  const comets = listComets();
  assert.equal(sun!.withoutPeriod.length, comets.filter(({ periodYears }) => periodYears === null).length);
  assert.ok(comets.filter(({ periodYears }) => periodYears !== null).every(({ id }) => ids.includes(id)));
  for (const host of hosts) {
    assert.equal(host.distanceUnit, "km");
    assert.equal(host.orbits.length + host.withoutPeriod.length, MOON_CATALOGUE.filter((moon) => moon.host === host.id).length);
  }
  assert.ok(hosts.find(({ id }) => id === "haumea")?.orbits.some(({ id }) => id === "hiiaka"));
  assert.ok(hosts.find(({ id }) => id === "jupiter")?.orbits.some(({ id }) => id === "io"));
  assert.ok(hosts.find(({ id }) => id === "saturn")?.withoutPeriod.some(({ reason }) => reason === "missing"));
  for (const system of [sun!, ...hosts]) {
    for (const orbit of system.orbits) {
      assert.ok(Number.isFinite(orbit.periodDays) && orbit.periodDays > 0, orbit.id);
      assert.ok(Number.isFinite(orbit.axis) && orbit.axis > 0, orbit.id);
      assert.ok(orbit.eccentricity >= 0 && orbit.eccentricity < 1, orbit.id);
    }
  }
});

test("the published planet periods follow the third law, and twice the practice axis takes the square root of eight times as long", () => {
  const sun = orbitSystems()[0]!;
  const earth = sun.orbits.find(({ id }) => id === "earth")!;
  for (const id of PLANET_IDS) {
    const orbit = sun.orbits.find((body) => body.id === id)!;
    const expected = practicePeriod(orbit.axis, earth);
    assert.ok(Math.abs(orbit.periodDays / expected - 1) < 0.005, id);
  }
  assert.equal(practicePeriod(earth.axis, earth), earth.periodDays);
  assert.ok(Math.abs(practicePeriod(2 * earth.axis, earth) / earth.periodDays - Math.sqrt(8)) < 1e-12);
});

test("the focus is at the origin and near and far sectors of equal time have equal area", () => {
  const area = (eccentricity: number, start: number): number => {
    let twice = 0;
    for (let i = 0; i < 2048; i += 1) {
      const [x, y] = orbitPoint(eccentricity, start + i / 16384);
      const [nx, ny] = orbitPoint(eccentricity, start + (i + 1) / 16384);
      twice += x * ny - y * nx;
    }
    return twice / 2;
  };
  for (const e of [0, 0.28, 0.7, 0.97]) {
    assert.ok(Math.abs(orbitPoint(e, 0)[0] - (1 - e)) < 1e-12);
    assert.ok(Math.abs(orbitPoint(e, 0.5)[0] - (-1 - e)) < 1e-12);
    const near = area(e, -1 / 16);
    const far = area(e, 7 / 16);
    assert.ok(Math.abs(near / far - 1) < 0.0002, `e=${e}: ${near} and ${far}`);
  }
});
