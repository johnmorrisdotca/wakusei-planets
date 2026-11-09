// Which bodies are nearest, and when two bodies come closest: against JPL Horizons (astrometric directions from the Earth's centre and from a place, tabulated in test/data/horizons-approach.json by
// scripts/fetch-horizons-approach.py, so no network), against a brute-force scan of the same positions, and against the distances in the Horizons vector tables the accuracy tests use.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { heliocentric, moonVector } from "../src/ephemeris.ts";
import "../src/tables/all.ts";
import { BODIES, BODY_IDS, type BodyId } from "../src/facts.ts";
import { closestApproach, conjunctions, distance, distanceRange, nearest, within } from "../src/nearest.ts";
import { RAD, type Vec3 } from "../src/vec.ts";

type Window = { label: string; a: BodyId; b: BodyId; start: string; stepSeconds: number; queries: Record<string, Record<string, string>>; a_ra_dec: number[][]; b_ra_dec: number[][] };
type Fixture = { source: string; fetched: string; events: Window[]; topocentric: Window & { observer: { latitude: number; longitude: number; heightM: number } } };
const horizons = JSON.parse(readFileSync(new URL("./data/horizons-approach.json", import.meta.url), "utf8")) as Fixture;
const AU_KM = 149597870.7;
const LIGHT_SECONDS_PER_AU = 499.004784;

const between = (a: number[], b: number[]): number => Math.acos(Math.max(-1, Math.min(1, Math.sin(a[1]! * RAD) * Math.sin(b[1]! * RAD) + Math.cos(a[1]! * RAD) * Math.cos(b[1]! * RAD) * Math.cos((a[0]! - b[0]!) * RAD)))) / RAD;

/** The minimum of Horizons' separation: the least squares parabola of the squared separation about the tabulated minimum, whose vertex is the moment and the height the angle. */
function horizonsMinimum(w: Window, half: number): { ms: number; angle: number } {
  const s = w.a_ra_dec.map((a, i) => between(a, w.b_ra_dec[i]!));
  const k = s.indexOf(Math.min(...s));
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = Math.max(0, k - half); i <= Math.min(s.length - 1, k + half); i += 1) {
    xs.push((i - k) * w.stepSeconds);
    ys.push(s[i]! ** 2);
  }
  const sums = [0, 1, 2, 3, 4].map((p) => xs.reduce((total, x) => total + x ** p, 0));
  const rhs = [0, 1, 2].map((p) => xs.reduce((total, x, i) => total + ys[i]! * x ** p, 0));
  const m = [[sums[0]!, sums[1]!, sums[2]!], [sums[1]!, sums[2]!, sums[3]!], [sums[2]!, sums[3]!, sums[4]!]];
  const det = (n: number[][]): number => n[0]![0]! * (n[1]![1]! * n[2]![2]! - n[1]![2]! * n[2]![1]!) - n[0]![1]! * (n[1]![0]! * n[2]![2]! - n[1]![2]! * n[2]![0]!) + n[0]![2]! * (n[1]![0]! * n[2]![1]! - n[1]![1]! * n[2]![0]!);
  const column = (j: number): number[][] => m.map((row, i) => row.map((v, c) => (c === j ? rhs[i]! : v)));
  const d = det(m);
  const [c0, c1, c2] = [det(column(0)) / d, det(column(1)) / d, det(column(2)) / d] as [number, number, number];
  return { ms: Date.parse(w.start) + k * w.stepSeconds * 1000 - (c1 / (2 * c2)) * 1000, angle: Math.sqrt(c0 - (c1 * c1) / (4 * c2)) };
}

/** What the test holds the search to for each tabulated event: seconds of time and arc-seconds of angle. Measured 2026-11-08: 270 s and 0.3″ (Jupiter-Saturn, whose minimum is flat: they close at 0.01″ a second), 23 s and 0.5″, and 1 to 8 s and 0.3 to 1.5″ for the Moon. */
const LIMITS: Array<[RegExp, number, number]> = [[/Jupiter-Saturn/, 400, 0.5], [/Venus and Jupiter/, 40, 1], [/the Moon/, 15, 2.5]];

test("the closest approaches agree with JPL Horizons to seconds of time and arc-seconds", (t) => {
  assert.equal(horizons.events.length, 9);
  for (const w of horizons.events) {
    const [, seconds, arcseconds] = LIMITS.find(([name]) => name.test(w.label))!;
    const mine = closestApproach(w.a, w.b, { from: Date.parse(w.start), to: Date.parse(w.start) + (w.a_ra_dec.length - 1) * w.stepSeconds * 1000 });
    const reference = horizonsMinimum(w, w.stepSeconds === 60 ? 25 : 24);
    const late = (mine.time.getTime() - reference.ms) / 1000;
    const off = (mine.angle! - reference.angle) * 3600;
    t.diagnostic(`${w.label}: Horizons ${new Date(reference.ms).toISOString()} ${reference.angle.toFixed(5)} deg; here ${mine.time.toISOString()} ${mine.angle!.toFixed(5)} deg; ${late.toFixed(1)} s, ${off.toFixed(2)} arcsec`);
    assert.equal(mine.atEdge, false, w.label);
    assert.ok(Math.abs(late) <= seconds, `${w.label}: ${late.toFixed(1)} s from Horizons, the limit is ${seconds}`);
    assert.ok(Math.abs(off) <= arcseconds, `${w.label}: ${off.toFixed(2)} arcsec from Horizons, the limit is ${arcseconds}`);
    assert.ok(Math.abs(off) <= mine.uncertaintyArcseconds!, `${w.label}: the claimed accuracy ${mine.uncertaintyArcseconds!.toFixed(1)} arcsec does not cover ${off.toFixed(2)}`);
    assert.ok(Math.abs(late) <= mine.uncertaintySeconds, `${w.label}: the claimed accuracy ${mine.uncertaintySeconds.toFixed(0)} s does not cover ${late.toFixed(1)}`);
  }
});

test("the great conjunction of 2020 is at about 0.10 degree, around 18 UT on 21 December", () => {
  const found = closestApproach("jupiter", "saturn", { from: Date.UTC(2020, 11, 1), to: Date.UTC(2021, 0, 1) });
  assert.ok(Math.abs(found.angle! - 0.1) < 0.005, String(found.angle));
  assert.equal(found.time.toISOString().slice(0, 13), "2020-12-21T18");
});

test("Venus and Jupiter in March 2023 come to about half a degree on 2 March", () => {
  const found = closestApproach("venus", "jupiter", { from: Date.UTC(2023, 1, 15), to: Date.UTC(2023, 2, 15) });
  assert.ok(Math.abs(found.angle! - 0.5) < 0.02, String(found.angle));
  assert.equal(found.time.toISOString().slice(0, 10), "2023-03-02");
});

test("from a place on the Earth the Moon's parallax counts, as in Horizons", () => {
  const w = horizons.topocentric;
  let worst = 0;
  let parallax = 0;
  w.a_ra_dec.forEach((moon, i) => {
    const date = Date.parse(w.start) + i * w.stepSeconds * 1000;
    const reference = between(moon, w.b_ra_dec[i]!);
    const place = nearest("moon", { bodies: ["venus"], date, observer: w.observer })[0]!;
    const centre = nearest("moon", { bodies: ["venus"], date })[0]!;
    worst = Math.max(worst, Math.abs(place.angle - reference) * 3600);
    parallax = Math.max(parallax, Math.abs(centre.angle - reference));
  });
  assert.ok(worst < 2, `${worst.toFixed(2)} arc-seconds from Horizons from the place`);
  assert.ok(parallax > 0.2, `the Earth's centre would be ${parallax.toFixed(2)} degrees off, so the place matters`);
});

/** One body's place seen from the Earth's centre when its light left: the same definition as the search, worked out here from the theories without it. */
function direction(id: BodyId, ms: number): Vec3 {
  const earth = heliocentric("earth", ms);
  const place = (when: number): Vec3 => {
    if (id === "sun") return [0, 0, 0];
    if (BODIES[id].kind !== "moon") return heliocentric(id as never, when);
    const host = heliocentric(BODIES[id].parent ?? "earth", when);
    const offset = moonVector(id as never, when);
    return [host[0] + offset[0] / AU_KM, host[1] + offset[1] / AU_KM, host[2] + offset[2] / AU_KM];
  };
  let emit = ms;
  let v: Vec3 = [0, 0, 0];
  for (let i = 0; i < 4; i += 1) {
    const p = place(emit);
    v = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
    emit = ms - Math.hypot(...v) * LIGHT_SECONDS_PER_AU * 1000;
  }
  return v;
}
const angle = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))))) / RAD;

test("nearest in the sky is the brute-force list, in order", () => {
  for (const date of [Date.UTC(2020, 11, 21, 18), Date.UTC(2026, 10, 8, 12), Date.UTC(1999, 7, 11, 11)]) {
    for (const target of ["jupiter", "moon", "sun", "io", "neptune"] as const) {
      const here = direction(target, date);
      const brute = BODY_IDS.filter((id) => id !== target && id !== "earth").map((id) => ({ id, angle: angle(here, direction(id, date)) })).sort((a, b) => a.angle - b.angle);
      const found = nearest(target, { count: 10, date });
      assert.deepEqual(found.map((row) => row.id), brute.slice(0, 10).map((row) => row.id), `${target} on ${new Date(date).toISOString()}`);
      found.forEach((row, i) => assert.ok(Math.abs(row.angle - brute[i]!.angle) < 1e-6, `${target} ${row.id}: ${row.angle} vs ${brute[i]!.angle}`));
    }
  }
});

test("nearest in space is the brute-force list, in order, and agrees with the Horizons vectors", () => {
  const dense = JSON.parse(readFileSync(new URL("./data/horizons-dense.json", import.meta.url), "utf8")) as { dates: string[]; planets: Record<string, number[][]> };
  for (const target of ["earth", "mars", "jupiter"] as const) {
    const date = Date.UTC(2026, 10, 8);
    const brute = BODY_IDS.filter((id) => id !== target).map((id) => {
      const a = id === "sun" ? [0, 0, 0] : BODIES[id].kind === "moon" ? [0, 0, 0] : heliocentric(id as never, date);
      const b = heliocentric(target, date);
      return { id, km: Math.hypot(a[0]! - b[0], a[1]! - b[1], a[2]! - b[2]) * AU_KM, moon: BODIES[id].kind === "moon" };
    }).filter((row) => !row.moon).sort((x, y) => x.km - y.km);
    const planets = nearest(target, { by: "space", kind: ["planet", "dwarf-planet", "star"], date, count: 100 });
    assert.deepEqual(planets.map((row) => row.id), brute.map((row) => row.id));
    planets.forEach((row, i) => assert.ok(Math.abs(row.distanceKm - brute[i]!.km) < 1e-3));
  }
  // against Horizons' own vectors on 60 dates: the claimed accuracy covers the difference
  for (const name of ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]) {
    dense.dates.forEach((date, i) => {
      const e = dense.planets.earth![i]!;
      const x = dense.planets[name]![i]!;
      const reference = Math.hypot(e[0]! - x[0]!, e[1]! - x[1]!, e[2]! - x[2]!);
      const [row] = nearest("earth", { by: "space", bodies: [name as BodyId], date: Date.parse(date) });
      assert.ok(Math.abs(row!.distanceKm - reference) <= row!.uncertaintyKm, `${name} on ${date}: ${Math.abs(row!.distanceKm - reference).toFixed(0)} km off, expected within ${row!.uncertaintyKm.toFixed(0)}`);
      assert.ok(Math.abs(row!.distanceAu * AU_KM - row!.distanceKm) < 1e-6);
    });
  }
});

test("the angle is exact near 0 and 180 degrees", () => {
  const eclipse = nearest("sun", { bodies: ["moon"], date: Date.UTC(2024, 3, 8, 18, 20) })[0]!;
  assert.ok(eclipse.angle < 0.6 && eclipse.angle >= 0, String(eclipse.angle));
  const full = nearest("sun", { bodies: ["moon"], date: Date.UTC(2025, 2, 14, 7) })[0]!;
  assert.ok(full.angle > 179 && full.angle <= 180, String(full.angle));
  const mine = direction("sun", Date.UTC(2025, 2, 14, 7));
  const moon = direction("moon", Date.UTC(2025, 2, 14, 7));
  const cross = Math.hypot(mine[1] * moon[2] - mine[2] * moon[1], mine[2] * moon[0] - mine[0] * moon[2], mine[0] * moon[1] - mine[1] * moon[0]);
  assert.ok(Math.abs(full.angle - Math.atan2(cross, mine[0] * moon[0] + mine[1] * moon[1] + mine[2] * moon[2]) / RAD) < 1e-6);
});

test("the options filter, count and cut", () => {
  const date = Date.UTC(2026, 10, 8, 12);
  const planets = nearest("moon", { kind: "planet", count: 3, date });
  assert.equal(planets.length, 3);
  assert.ok(planets.every((row) => row.kind === "planet" && BODIES[row.id].kind === "planet"));
  assert.ok(planets.every((row, i) => i === 0 || planets[i - 1]!.angle <= row.angle));
  assert.equal(nearest("moon", { date }).length, 5);
  assert.equal(nearest("moon", { date, count: 0 }).length, 0);
  assert.ok(!nearest("mars", { date, count: 100 }).some((row) => row.id === "mars" || row.id === "earth"), "neither the target nor the Earth's own place");
  assert.ok(nearest("earth", { by: "space", date, count: 100 }).every((row) => row.id !== "earth"));
  const inside = within("jupiter", 2, { date });
  assert.ok(inside.length > 0 && inside.every((row) => row.angle <= 2));
  assert.deepEqual(inside.map((row) => row.id), nearest("jupiter", { date, within: 2 }).map((row) => row.id));
  assert.equal(nearest("jupiter", { date, within: 2, count: 1 }).length, 1);
  assert.deepEqual(within("jupiter", 1e6, { by: "space", kind: "moon", date }).map((row) => row.id).sort(), ["callisto", "europa", "ganymede", "io"].filter((id) => within("jupiter", 1e6, { by: "space", kind: "moon", date }).some((row) => row.id === id)));
  assert.ok(within("jupiter", 3e6, { by: "space", kind: "moon", date }).length >= 3);
  assert.deepEqual(nearest("mars", { bodies: ["venus", "jupiter"], date }).map((row) => row.id).sort(), ["jupiter", "venus"]);
  const dateObject = new Date(date);
  assert.deepEqual(nearest("mars", { date: dateObject }), nearest("mars", { date }));
  assert.equal(dateObject.getTime(), date);
  assert.ok(nearest("mars", { count: 1 }).length === 1, "the date defaults to now");
});

test("a sky seen from another body", () => {
  const date = Date.UTC(2026, 10, 8, 12);
  const fromMars = nearest("earth", { observer: "mars", count: 100, date });
  assert.ok(!fromMars.some((row) => row.id === "mars" || row.id === "earth"));
  assert.ok(fromMars.some((row) => row.id === "moon"));
  assert.ok(fromMars.find((row) => row.id === "moon")!.angle < 0.2, "from Mars the Moon is close to the Earth");
  const fromEarth = nearest("earth", { observer: "mars", bodies: ["moon", "sun"], date });
  assert.equal(fromEarth.length, 2);
  assert.throws(() => nearest("mars", { observer: "mars", date }), /where the sky is seen from/);
  assert.equal(nearest("mars", { observer: "mars", by: "space", count: 1, date }).length, 1, "in space the observer is not used");
});

test("each result carries the accuracy to expect", () => {
  const date = Date.UTC(2026, 10, 8, 12);
  const sky = nearest("jupiter", { kind: "planet", count: 2, date });
  assert.ok(sky.every((row) => row.uncertaintyArcseconds > 1 && row.uncertaintyArcseconds < 60), JSON.stringify(sky));
  const moonSky = nearest("jupiter", { kind: "moon", count: 1, date })[0]!;
  assert.ok(moonSky.uncertaintyArcseconds < 1, "a moon and its planet share the planet's error");
  const space = nearest("earth", { by: "space", count: 1, date })[0]!;
  assert.equal(space.id, "moon");
  assert.ok(space.uncertaintyKm < 30, String(space.uncertaintyKm));
  const far = nearest("earth", { by: "space", kind: "planet", count: 1, date })[0]!;
  assert.ok(far.uncertaintyKm > 1000, String(far.uncertaintyKm));
});

test("bad arguments are named", () => {
  assert.throws(() => nearest("pluton" as BodyId), /target must be a body/);
  assert.throws(() => nearest("mars", { by: "time" as "sky" }), /by must be/);
  assert.throws(() => nearest("mars", { kind: "comet" as "moon" }), /kind must be/);
  assert.throws(() => nearest("mars", { count: -1 }), /count/);
  assert.throws(() => nearest("mars", { count: 1.5 }), /count/);
  assert.throws(() => nearest("mars", { within: -1 }), /within/);
  assert.throws(() => nearest("mars", { date: NaN }), /date/);
  assert.throws(() => nearest("mars", { observer: { latitude: 100, longitude: 0 } }), /latitude/);
  assert.throws(() => nearest("mars", { observer: "nowhere" as BodyId }), /observer must be a body/);
  assert.throws(() => nearest("mars", { bodies: ["nowhere" as BodyId] }), /bodies must be a body/);
  assert.throws(() => closestApproach("mars", "mars", { from: 0, to: 1 }), /different/);
  assert.throws(() => closestApproach("mars", "venus", { from: 1, to: 0 }), /before/);
  assert.throws(() => closestApproach("earth", "venus", { from: 0, to: 1e9 }), /observer/);
});

test("when the separation only falls through the span, the smaller end is returned and marked", () => {
  const found = closestApproach("mars", "venus", { from: Date.UTC(2026, 10, 1), to: Date.UTC(2026, 10, 2) });
  assert.equal(found.atEdge, true);
  assert.ok(found.time.getTime() === Date.UTC(2026, 10, 1) || found.time.getTime() === Date.UTC(2026, 10, 2));
  const same = closestApproach("moon", "venus", { from: Date.UTC(2026, 11, 5), to: Date.UTC(2026, 11, 5) });
  assert.equal(same.atEdge, true);
});

test("closestApproach in space finds the Earth's closest approach to Mars, and Earth-Moon perigee", () => {
  const mars = closestApproach("earth", "mars", { from: Date.UTC(2025, 0, 1), to: Date.UTC(2026, 11, 31), by: "space" });
  assert.equal(mars.atEdge, false);
  assert.equal(mars.time.toISOString().slice(0, 10), "2025-01-12", "the Earth and Mars are nearest just after the opposition of January 2025");
  assert.ok(Math.abs(mars.distanceAu! - 0.6422) < 0.001, String(mars.distanceAu));
  const moon = closestApproach("earth", "moon", { from: Date.UTC(2026, 10, 1), to: Date.UTC(2026, 10, 30), by: "space" });
  assert.ok(moon.distanceKm! > 355_000 && moon.distanceKm! < 370_000, String(moon.distanceKm));
  assert.equal(moon.uncertaintySeconds > 0, true);
});

test("closestApproach is the brute-force minimum of the same separation", () => {
  const cases: Array<[BodyId, BodyId, number, number]> = [
    ["moon", "venus", Date.UTC(2026, 11, 4), Date.UTC(2026, 11, 6)],
    ["jupiter", "saturn", Date.UTC(2020, 11, 20), Date.UTC(2020, 11, 23)],
    ["moon", "jupiter", Date.UTC(2026, 11, 26), Date.UTC(2026, 11, 28)],
  ];
  for (const [a, b, from, to] of cases) {
    let best = { ms: from, value: Infinity };
    for (let ms = from; ms <= to; ms += 60_000) {
      const value = nearest(a, { bodies: [b], date: ms })[0]!.angle;
      if (value < best.value) best = { ms, value };
    }
    const found = closestApproach(a, b, { from, to });
    assert.ok(Math.abs(found.time.getTime() - best.ms) <= 61_000, `${a}-${b}: ${found.time.toISOString()} vs ${new Date(best.ms).toISOString()}`);
    assert.ok(found.angle! <= best.value + 1e-9 && best.value - found.angle! < 1e-5, `${a}-${b}: ${found.angle} vs ${best.value}`);
  }
});

test("the Moon passes the Sun at the total solar eclipse of 8 April 2024", () => {
  const found = closestApproach("moon", "sun", { from: Date.UTC(2024, 3, 8, 12), to: Date.UTC(2024, 3, 9, 0) });
  assert.ok(found.angle! < 0.6 && found.angle! > 0);
  assert.ok(Math.abs(found.time.getTime() - Date.UTC(2024, 3, 8, 18, 17, 16)) < 60_000, found.time.toISOString());
});

test("conjunctions is the brute-force list of minima, soonest first", () => {
  const from = Date.UTC(2023, 0, 1);
  const to = Date.UTC(2024, 0, 1);
  const bodies: BodyId[] = ["venus", "jupiter", "mars", "saturn"];
  const found = conjunctions({ from, to, bodies, within: 5 });
  assert.ok(found.every((row, i) => i === 0 || found[i - 1]!.time <= row.time));
  assert.ok(found.every((row) => row.angle! <= 5 && row.time.getTime() >= from && row.time.getTime() <= to));
  const hour = 3_600_000;
  const brute: Array<[BodyId, BodyId, number]> = [];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const series: number[] = [];
      for (let ms = from - 6 * hour; ms <= to + 6 * hour; ms += 6 * hour) series.push(nearest(bodies[i]!, { bodies: [bodies[j]!], date: ms })[0]!.angle);
      for (let k = 1; k < series.length - 1; k += 1) {
        const ms = from - 6 * hour + k * 6 * hour;
        if (series[k]! <= series[k - 1]! && series[k]! < series[k + 1]! && series[k]! < 5 && ms >= from && ms <= to) brute.push([bodies[i]!, bodies[j]!, ms]);
      }
    }
  }
  assert.equal(found.length, brute.length, `${found.map((row) => `${row.a}-${row.b}`).join(" ")} vs ${brute.map((row) => `${row[0]}-${row[1]}`).join(" ")}`);
  for (const [a, b, ms] of brute) {
    const one = found.find((row) => row.a === a && row.b === b && Math.abs(row.time.getTime() - ms) <= 6 * hour);
    assert.ok(one !== undefined, `${a}-${b} near ${new Date(ms).toISOString()}`);
  }
  const venusJupiter = found.find((row) => row.a === "venus" && row.b === "jupiter")!;
  assert.equal(venusJupiter.time.toISOString().slice(0, 10), "2023-03-02");
  assert.ok(found.every((row) => row.uncertaintyArcseconds! > 0 && row.uncertaintySeconds > 0));
});

test("conjunctions with the Moon and an observer's place, and with the default bodies", () => {
  const from = Date.UTC(2026, 11, 1);
  const to = Date.UTC(2027, 0, 1);
  const moon = conjunctions({ from, to, bodies: ["moon", "jupiter", "venus"], within: 7 });
  assert.ok(moon.some((row) => row.a === "moon" && row.b === "jupiter" && row.time.toISOString().startsWith("2026-12-27")));
  assert.ok(moon.some((row) => row.a === "moon" && row.b === "venus" && row.time.toISOString().startsWith("2026-12-05")));
  const place = conjunctions({ from, to, bodies: ["moon", "jupiter"], within: 7, observer: { latitude: 49.28, longitude: -123.12 } });
  const geocentric = moon.find((row) => row.a === "moon" && row.b === "jupiter")!;
  const topocentric = place.find((row) => row.a === "moon" && row.b === "jupiter")!;
  assert.ok(Math.abs(geocentric.angle! - topocentric.angle!) > 0.05, "parallax changes the Moon's separation");
  const all = conjunctions({ from: Date.UTC(2023, 0, 1), to: Date.UTC(2024, 0, 1) });
  assert.ok(all.length > 5 && all.every((row) => row.a !== "earth" && row.b !== "earth"));
  assert.deepEqual(conjunctions({ from, to, bodies: ["mars"] }), []);
  assert.deepEqual(conjunctions({ from, to, bodies: ["earth", "mars"], observer: "earth", within: 90 }), []);
  const space = conjunctions({ from: Date.UTC(2025, 0, 1), to: Date.UTC(2027, 0, 1), bodies: ["earth", "mars"], by: "space" });
  assert.ok(space.length >= 1 && space.every((row) => row.distanceKm! > 0 && row.distanceAu! > 0.3));
});

test("a year's conjunction search is fast", () => {
  const start = performance.now();
  conjunctions({ from: Date.UTC(2023, 0, 1), to: Date.UTC(2024, 0, 1) });
  assert.ok(performance.now() - start < 3000, `${(performance.now() - start).toFixed(0)} ms`);
});

type Extreme = { query: Record<string, string>; ms: number[]; km: number[] };
type DistanceFixture = { source: string; fetched: string; pairs: Array<{ a: BodyId; b: BodyId; queries: Record<string, Record<string, string>>; min: Extreme; max: Extreme }> };
const distances = JSON.parse(readFileSync(new URL("./data/horizons-distance.json", import.meta.url), "utf8")) as DistanceFixture;

/** The turning point of a table of distances: the vertex of the least squares parabola through the 41 samples (ten days) about the tabulated extreme. */
function vertex(w: Extreme, pick: (...values: number[]) => number): { ms: number; km: number } {
  const k = w.km.indexOf(pick(...w.km));
  const from = Math.max(0, k - 20);
  const t0 = w.ms[k]!;
  const xs = w.ms.slice(from, k + 21).map((ms) => (ms - t0) / 86_400_000);
  const ys = w.km.slice(from, k + 21);
  const sums = [0, 1, 2, 3, 4].map((p) => xs.reduce((total, x) => total + x ** p, 0));
  const rhs = [0, 1, 2].map((p) => xs.reduce((total, x, i) => total + ys[i]! * x ** p, 0));
  const m = [[sums[0]!, sums[1]!, sums[2]!], [sums[1]!, sums[2]!, sums[3]!], [sums[2]!, sums[3]!, sums[4]!]];
  const det = (n: number[][]): number => n[0]![0]! * (n[1]![1]! * n[2]![2]! - n[1]![2]! * n[2]![1]!) - n[0]![1]! * (n[1]![0]! * n[2]![2]! - n[1]![2]! * n[2]![0]!) + n[0]![2]! * (n[1]![0]! * n[2]![1]! - n[1]![1]! * n[2]![0]!);
  const column = (j: number): number[][] => m.map((row, i) => row.map((v, c) => (c === j ? rhs[i]! : v)));
  const d = det(m);
  const [c0, c1, c2] = [det(column(0)) / d, det(column(1)) / d, det(column(2)) / d] as [number, number, number];
  const x = -c1 / (2 * c2);
  return { ms: t0 + x * 86_400_000, km: c0 + c1 * x + c2 * x * x };
}

test("the least and greatest distances of three pairs of planets from 1900 to 2100 agree with JPL Horizons", (t) => {
  assert.equal(distances.pairs.length, 3);
  for (const pair of distances.pairs) {
    const found = distanceRange(pair.a, pair.b, { from: Date.UTC(1900, 0, 1), to: Date.UTC(2100, 0, 1) });
    assert.equal(found.min.atEdge || found.max.atEdge, false);
    for (const [name, pick] of [["min", Math.min], ["max", Math.max]] as const) {
      const reference = vertex(pair[name], pick);
      const mine = found[name];
      const seconds = (mine.time.getTime() - reference.ms) / 1000;
      const km = mine.distanceKm - reference.km;
      t.diagnostic(`${pair.a}-${pair.b} ${name}: Horizons ${new Date(reference.ms).toISOString()} ${(reference.km / AU_KM).toFixed(5)} au; here ${mine.time.toISOString()} ${mine.distanceAu.toFixed(5)} au; ${seconds.toFixed(0)} s, ${km.toFixed(0)} km`);
      assert.ok(Math.abs(km) <= mine.uncertaintyKm, `${pair.a}-${pair.b} ${name}: ${km.toFixed(0)} km from Horizons, expected within ${mine.uncertaintyKm.toFixed(0)}`);
      assert.ok(Math.abs(seconds) < 86_400, `${pair.a}-${pair.b} ${name}: ${seconds.toFixed(0)} s from Horizons`);
    }
  }
});

test("Earth and Mars come to 0.37 au in August 2003 and go to 2.68 au in 2066", () => {
  const { min, max } = distanceRange("earth", "mars", { from: Date.UTC(1900, 0, 1), to: Date.UTC(2100, 0, 1) });
  assert.equal(min.time.toISOString().slice(0, 10), "2003-08-27");
  assert.ok(Math.abs(min.distanceAu - 0.3727) < 0.0005, String(min.distanceAu));
  assert.ok(Math.abs(max.distanceAu - 2.676) < 0.01, String(max.distanceAu));
});

test("distance is the straight line between two centres, either way round", () => {
  const date = Date.UTC(2003, 7, 27, 9);
  const forward = distance("earth", "mars", date);
  const back = distance("mars", "earth", new Date(date));
  assert.equal(forward.distanceKm, back.distanceKm);
  assert.equal(forward.time, date);
  assert.ok(Math.abs(forward.distanceAu * AU_KM - forward.distanceKm) < 1e-6);
  const earth = heliocentric("earth", date);
  const mars = heliocentric("mars", date);
  assert.ok(Math.abs(forward.distanceKm - Math.hypot(earth[0] - mars[0], earth[1] - mars[1], earth[2] - mars[2]) * AU_KM) < 1e-3);
  assert.equal(distance("sun", "earth", date).distanceAu.toFixed(2), "1.01");
  assert.ok(Math.abs(distance("earth", "moon", date).distanceKm - nearest("earth", { by: "space", date, count: 1 })[0]!.distanceKm) < 1e-9);
  const io = distance("jupiter", "io", date);
  assert.ok(io.distanceKm > 4.0e5 && io.distanceKm < 4.4e5, String(io.distanceKm));
  assert.ok(io.uncertaintyKm < 2000, "a moon and its planet share the planet's error, so only the moon's own 0.15 degree counts");
  assert.ok(distance("mars", "ceres", date).distanceAu > 0.5);
  assert.ok(Number.isFinite(distance("pluto", "charon", date).distanceKm));
  assert.ok(distance("earth", "mars").time > 0, "the date defaults to now");
  assert.throws(() => distance("mars", "mars", date), /different/);
  assert.throws(() => distance("mars", "nowhere" as BodyId, date), /b must be a body/);
  assert.throws(() => distance("mars", "venus", NaN), /date/);
});

test("distanceRange finds the Moon's perigee and apogee, and marks a range that only falls", () => {
  const month = distanceRange("earth", "moon", { from: Date.UTC(2026, 10, 1), to: Date.UTC(2026, 10, 30) });
  assert.ok(month.min.distanceKm < month.max.distanceKm && month.min.distanceKm > 356_000 && month.max.distanceKm < 407_000);
  assert.equal(month.min.atEdge, false);
  assert.ok(month.min.time < month.max.time || month.min.time > month.max.time);
  // brute force at ten-minute steps agrees with the turning points
  let low = Infinity;
  let high = 0;
  for (let ms = Date.UTC(2026, 10, 1); ms <= Date.UTC(2026, 10, 30); ms += 600_000) {
    const km = distance("earth", "moon", ms).distanceKm;
    low = Math.min(low, km);
    high = Math.max(high, km);
  }
  assert.ok(month.min.distanceKm <= low + 1e-6 && low - month.min.distanceKm < 5, `${month.min.distanceKm} vs ${low}`);
  assert.ok(month.max.distanceKm >= high - 1e-6 && month.max.distanceKm - high < 5, `${month.max.distanceKm} vs ${high}`);
  const falling = distanceRange("earth", "mars", { from: Date.UTC(2003, 5, 1), to: Date.UTC(2003, 6, 1) });
  assert.equal(falling.min.atEdge, true);
  assert.equal(falling.min.time.getTime(), Date.UTC(2003, 6, 1));
  assert.equal(falling.max.time.getTime(), Date.UTC(2003, 5, 1));
  assert.throws(() => distanceRange("mars", "mars", { from: 0, to: 1 }), /different/);
  assert.throws(() => distanceRange("mars", "venus", { from: 1, to: 0 }), /before/);
});
