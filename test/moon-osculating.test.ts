// The osculating orbits of the irregular moons (MODULES-1091): one JPL Horizons day sets each, and inside `MOON_OSCULATING_DAYS` of it `catalogueMoonPosition` follows the moon to within a few degrees on dates the orbit
// was not set from (test/data/moon-osculating-horizons.json: Horizons' own places for a sample of every group, at 30, 60 and 120 days either side), where the mean orbit is tens of degrees off; outside the window it is the mean orbit.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogueMoonPosition, findCatalogueMoon, MOON_CATALOGUE, MOON_OSCULATING_DAYS, MOON_OSCULATING_EPOCH_JD } from "../src/moon-catalogue.ts";
import { dot, length, type Vec3 } from "../src/vec.ts";

interface Fixture {
  epochJd: number;
  moons: Record<string, { host: string; dates: Record<string, Vec3> }>;
}
const fixture = JSON.parse(readFileSync(new URL("./data/moon-osculating-horizons.json", import.meta.url), "utf8")) as Fixture;
const UNIX_JD = 2_440_587.5;
const msOf = (jd: number): number => (jd - UNIX_JD) * 86_400_000;
const degrees = (a: Vec3, b: Vec3): number => (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (length(a) * length(b))))) * 180) / Math.PI;
/** The same moon with its osculating orbit taken away, so the mean orbit is what answers. */
const meanOnly = (id: string) => ({ ...findCatalogueMoon(id)!, osculating: null });

test("every irregular moon of a giant planet has an osculating orbit, and no other moon does", () => {
  for (const m of MOON_CATALOGUE) {
    const irregular = m.orbit !== null && !["regular", "inner", "major", "none"].includes(m.group) && ["jupiter", "saturn", "uranus", "neptune"].includes(m.host);
    assert.equal(m.osculating !== null, irregular, `${m.id}: ${m.group}`);
    if (m.osculating !== null) {
      assert.equal(m.osculating.epochJd, MOON_OSCULATING_EPOCH_JD);
      assert.ok(m.osculating.e >= 0 && m.osculating.e < 1 && m.osculating.a > 1e6 && m.osculating.a < 1e8, m.id);
      assert.ok(Math.abs(m.osculating.a - m.orbit!.a) / m.orbit!.a < 0.25, `${m.id}: the osculating and the mean semi-major axis are of one orbit`);
    }
  }
});

test("on dates it was not set from, within the window, the osculating orbit is within a few degrees of Horizons and far nearer than the mean orbit", () => {
  assert.equal(fixture.epochJd, MOON_OSCULATING_EPOCH_JD);
  let worst = 0;
  let better = 0;
  let total = 0;
  const errors: number[] = [];
  for (const [id, entry] of Object.entries(fixture.moons)) {
    for (const [offset, truth] of Object.entries(entry.dates)) {
      const jd = fixture.epochJd + Number(offset);
      assert.ok(Math.abs(Number(offset)) <= MOON_OSCULATING_DAYS, "the fixture's dates are inside the window");
      const ours = degrees(catalogueMoonPosition(id, msOf(jd))!, truth);
      const mean = degrees(catalogueMoonPosition(meanOnly(id), msOf(jd))!, truth);
      worst = Math.max(worst, ours);
      errors.push(ours);
      total += 1;
      if (ours < mean) better += 1;
    }
  }
  errors.sort((a, b) => a - b);
  console.log(`osculating orbits: ${total} held-out places, median ${errors[Math.floor(total / 2)]!.toFixed(2)} degrees, worst ${worst.toFixed(2)}; nearer than the mean orbit in ${better}`);
  assert.ok(total >= 200, `${total} places`);
  assert.ok(worst < 8, `worst ${worst.toFixed(2)} degrees`);
  assert.ok(errors[Math.floor(total / 2)]! < 0.5, "the median is under half a degree");
  assert.ok(better / total > 0.9, `nearer than the mean orbit in ${better} of ${total}`);
});

test("outside the window the mean orbit answers, as it did, and the other moons are untouched", () => {
  const out = fixture.epochJd + MOON_OSCULATING_DAYS + 40;
  for (const id of ["himalia", "ymir", "caliban"]) {
    assert.deepEqual(catalogueMoonPosition(id, msOf(out)), catalogueMoonPosition(meanOnly(id), msOf(out)), id);
  }
  const inside = fixture.epochJd + 20;
  assert.notDeepEqual(catalogueMoonPosition("himalia", msOf(inside)), catalogueMoonPosition(meanOnly("himalia"), msOf(inside)));
  // a regular moon has no osculating orbit and is where it was
  const io = findCatalogueMoon("io")!;
  assert.equal(io.osculating, null);
  assert.deepEqual(catalogueMoonPosition(io, msOf(inside)), catalogueMoonPosition({ ...io }, msOf(inside)));
});
