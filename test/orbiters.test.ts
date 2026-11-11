import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ORBITER_FACTS, ORBITER_IDS, orbiterCentre, orbiterElements, orbiterFacts, orbiterNumbers, orbiterPath, orbiterPosition, orbiterSpeed, orbiterStatus, type OrbiterId } from "../src/orbiters.ts";

interface Point {
  jd: number;
  position: [number, number, number];
  velocity: [number, number, number];
}
const fixture = JSON.parse(readFileSync(new URL("./data/orbiters-horizons.json", import.meta.url), "utf8")) as Record<string, Point[]>;
const UNIX_EPOCH_JD = 2440587.5;
const msOfJd = (jd: number): number => (jd - UNIX_EPOCH_JD) * 86_400_000;
const length = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);

test("thirteen orbiters, six round the Moon and seven round Mars, each with its facts", () => {
  assert.equal(ORBITER_IDS.length, 13);
  assert.equal(ORBITER_IDS.filter((id) => orbiterCentre(id) === "moon").length, 6);
  assert.equal(ORBITER_IDS.filter((id) => orbiterCentre(id) === "mars").length, 7);
  for (const id of ORBITER_IDS) {
    const facts = orbiterFacts(id);
    assert.equal(facts.centre, orbiterCentre(id), id);
    assert.ok(facts.name.en.length > 0 && facts.name.ja.length > 0 && facts.about.en.length > 20 && facts.about.ja.length > 10, `${id} is named and described in both languages`);
    assert.ok(/^\d{4}-\d{2}(-\d{2})?/.test(facts.launch.date), `${id} has a launch date`);
    assert.equal(ORBITER_FACTS[id], facts);
  }
  assert.throws(() => orbiterCentre("iss" as OrbiterId), /no orbiter called iss/);
});

test("every craft with a path is where Horizons puts it, within the fit's own stated error, at the points held from its window", () => {
  let checked = 0;
  for (const id of ORBITER_IDS) {
    const elements = orbiterElements(id);
    const points = fixture[id];
    if (elements === undefined) {
      assert.ok(points === undefined || id === "capstone", `${id} has no path`);
      continue;
    }
    assert.ok(points !== undefined && points.length >= 4, `${id} has reference points`);
    for (const point of points) {
      const ours = orbiterPosition(id, msOfJd(point.jd));
      const miss = length([ours[0] - point.position[0], ours[1] - point.position[1], ours[2] - point.position[2]]);
      // the test points are inside the fit's window: within the worst error measured there, with a little room for the rounding of the elements
      assert.ok(miss <= elements.fitErrorKm.max * 1.05 + 1, `${id} at JD ${point.jd}: ${miss.toFixed(1)} km off, the fit's worst is ${elements.fitErrorKm.max} km`);
      // the speed from the ellipse is the real speed to a few per cent on a tracked fit; a mean ellipse only (ARTEMIS, pulled about by the Earth) is rougher
      const speed = orbiterSpeed(id, msOfJd(point.jd));
      const real = length(point.velocity);
      assert.ok(Math.abs(speed - real) / real < (elements.basis === "tracked" ? 0.05 : 0.2), `${id}: speed ${speed.toFixed(3)} against Horizons' ${real.toFixed(3)} km/s`);
      checked += 1;
    }
  }
  assert.ok(checked >= 40, `${checked} points checked`);
});

test("the orbits are the right size: a low lunar orbit about 100 km up, a low Mars orbit a few hundred km up, Hope far out, and ARTEMIS long and lopsided", () => {
  const when = Date.UTC(2026, 10, 11);
  const lro = orbiterNumbers("lro", when)!;
  assert.ok(lro.altitudeKm > 20 && lro.altitudeKm < 250, `LRO ${lro.altitudeKm.toFixed(0)} km up`);
  assert.ok(lro.periodDays * 24 * 60 > 100 && lro.periodDays * 24 * 60 < 130, `LRO goes round in ${(lro.periodDays * 24 * 60).toFixed(0)} minutes`);
  assert.ok(lro.inclinationDeg > 75 && lro.inclinationDeg < 105, "LRO is polar");
  const mro = orbiterNumbers("mro", when)!;
  assert.ok(mro.altitudeKm > 200 && mro.altitudeKm < 400, `MRO ${mro.altitudeKm.toFixed(0)} km up`);
  assert.ok(mro.periodDays * 24 * 60 > 105 && mro.periodDays * 24 * 60 < 120, "MRO's 112 minutes");
  const hope = orbiterElements("hope")!;
  assert.ok(hope.a > 30_000 && hope.e > 0.3 && hope.periodDays > 2 && hope.periodDays < 2.5, "Hope's high 55-hour orbit");
  const artemis = orbiterElements("artemis-p1")!;
  assert.ok(artemis.e > 0.7 && artemis.periodDays > 0.9 && artemis.periodDays < 1.2, "ARTEMIS P1's 26-hour lopsided orbit");
  assert.equal(orbiterNumbers("tianwen-1", when), undefined);
});

test("the status says where a path comes from: tracked inside the window, predicted past the tracking, modelled outside it or for a mean ellipse only, none for no path", () => {
  const lro = orbiterElements("lro")!;
  assert.equal(lro.basis, "tracked");
  assert.equal(orbiterStatus("lro", Date.parse(lro.validFrom) + 86_400_000), "tracked");
  assert.equal(orbiterStatus("lro", Date.parse(lro.validUntil) + 86_400_000), "modelled");
  assert.equal(orbiterStatus("lro", Date.UTC(2020, 0, 1)), "modelled");
  assert.equal(orbiterStatus("artemis-p1", Date.parse(orbiterElements("artemis-p1")!.validFrom) + 86_400_000), "modelled");
  assert.equal(orbiterStatus("maven", Date.UTC(2026, 10, 11)), "modelled");
  assert.equal(orbiterStatus("capstone", Date.UTC(2026, 10, 11)), "none");
  assert.equal(orbiterStatus("tianwen-1", Date.UTC(2026, 10, 11)), "none");
  assert.throws(() => orbiterPosition("tianwen-1", Date.UTC(2026, 10, 11)), /no path/);
  assert.deepEqual(orbiterPath("capstone", Date.UTC(2026, 10, 11)), []);
  assert.equal(orbiterFacts("maven").status.state, "ended");
  assert.equal(orbiterFacts("capstone").status.state, "ended");
});

test("the path round one trip closes on itself, stays the ellipse's size, and passes through the craft's own place", () => {
  const when = Date.UTC(2026, 10, 11, 12);
  for (const id of ["lro", "mro", "hope", "mars-express"] as const) {
    const path = orbiterPath(id, when, 96);
    const elements = orbiterElements(id)!;
    assert.equal(path.length, 97);
    assert.ok(length([path[0]![0] - path[96]![0], path[0]![1] - path[96]![1], path[0]![2] - path[96]![2]]) < 1e-6, `${id}'s line closes`);
    const radii = path.map(length);
    assert.ok(Math.min(...radii) > elements.a * (1 - elements.e) - 1 && Math.max(...radii) < elements.a * (1 + elements.e) + 1, `${id}'s line is between periapsis and apoapsis`);
    const here = orbiterPosition(id, when);
    const nearest = Math.min(...path.map((p) => length([p[0] - here[0], p[1] - here[1], p[2] - here[2]])));
    assert.ok(nearest < (2 * Math.PI * elements.a * (1 + elements.e)) / 96, `${id} sits on its line (${nearest.toFixed(0)} km from the nearest point)`);
  }
});
