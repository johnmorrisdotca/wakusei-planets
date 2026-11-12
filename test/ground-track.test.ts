import assert from "node:assert/strict";
import { test } from "node:test";
import { coverageAngleRad, splitDateLine, splitTrail, trackSteps } from "../src/ground-track.ts";
import { createPaintTrail } from "../src/paint/trail.ts";

test("the date line splits a line that would cross the map, and a short line stays one piece", () => {
  const crossed = splitDateLine({ lon: 170, lat: 0 }, { lon: -170, lat: 4 });
  assert.equal(crossed.length, 2);
  assert.equal(crossed[0]![1].lon, 180);
  assert.equal(crossed[1]![0].lon, -180);
  assert.equal(splitDateLine({ lon: 10, lat: 0 }, { lon: 20, lat: 1 }).length, 1);
  const same = splitDateLine({ lon: -170, lat: 0 }, { lon: 170, lat: 0 });
  assert.equal(same.length, 2);
  assert.ok(Math.abs(same[0]![1].lon) === 180);
});

test("a step near a pole is split so the line goes to the pole instead of across the map", () => {
  const pieces = splitTrail({ lon: 10, lat: 80 }, { lon: 170, lat: 75 });
  assert.ok(pieces.length > 1);
  assert.ok(pieces.some((piece) => piece.some((point) => Math.abs(point.lat) === 90)));
  assert.equal(splitTrail({ lon: 0, lat: 10 }, { lon: 20, lat: 12 }).length, 1);
});

test("the swath radius is 0 on the surface and wider the higher the craft, and matches the Earth at 6,371 km", () => {
  assert.equal(coverageAngleRad(0, 6371), 0);
  assert.equal(coverageAngleRad(-10, 1737.4), 0);
  const low = coverageAngleRad(50, 1737.4);
  const high = coverageAngleRad(400, 1737.4);
  assert.ok(low > 0 && high > low);
  const earth = coverageAngleRad(400, 6371);
  assert.ok(Math.abs(earth - 0.2108) < 0.002, String(earth));
  assert.ok(trackSteps({ lon: 0, lat: 0 }, { lon: 10, lat: 0 }, 2).length > 2);
});

test("the trail grows as time moves, holds still at one moment, clears, and a new craft starts empty", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d" });
  const sample = (ms: number) => ({ lon: Math.max(-170, Math.min(170, ms / 200_000)), lat: 8, heightKm: 50 });
  const first = trail.step(0, 1737.4, sample);
  assert.equal(first, true);
  const painted = trail.pixels;
  assert.ok(painted > 0);
  assert.equal(trail.step(0, 1737.4, sample), false);
  assert.equal(trail.pixels, painted);
  assert.equal(trail.step(6 * 3_600_000, 1737.4, sample), true);
  assert.ok(trail.pixels > painted, "six hours later the line is longer");
  const backward = trail.pixels;
  trail.step(5 * 3_600_000, 1737.4, sample);
  assert.ok(trail.pixels > 0 && trail.pixels <= backward);
  trail.set({ id: "danuri" });
  assert.equal(trail.pixels, 0);
  trail.clear();
  assert.equal(trail.pixels, 0);
  assert.equal(trail.on, false);
});

// A craft on a 2-hour orbit tilted 80° to the equator, over a body that turns 13.18° a day: the point under it at a moment.
const PERIOD = 7_200_000;
const orbit = (ms: number) => {
  const phase = (2 * Math.PI * ms) / PERIOD;
  const tilt = (80 * Math.PI) / 180;
  const lat = (Math.asin(Math.sin(tilt) * Math.sin(phase)) * 180) / Math.PI;
  const inertial = (Math.atan2(Math.cos(tilt) * Math.sin(phase), Math.cos(phase)) * 180) / Math.PI;
  let lon = inertial - (13.18 * ms) / 86_400_000;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lon, lat, heightKm: 50 };
};
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 11);

const mask = (trail: { data: Uint8Array }): Uint8Array => Uint8Array.from({ length: trail.data.length / 4 }, (_, i) => (trail.data[i * 4 + 3] === 0 ? 0 : 1));
const differ = (a: Uint8Array, b: Uint8Array): number => a.reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);

test("the coverage radius is the angle out to 10° up: 12.08° from 400 km over the Earth, worked by hand", () => {
  // cos(a + 10°) = R cos(10°) / (R + h): 6371 × 0.98481 / 6771 = 0.92667, so a + 10° = 22.08°
  assert.ok(Math.abs((coverageAngleRad(400, 6371) * 180) / Math.PI - 12.0846) < 0.001);
  assert.ok(Math.abs((coverageAngleRad(50, 1737.4) * 180) / Math.PI - 6.812) < 0.001);
});

test("a swath over the date line is painted on both edges of the map", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d", swath: "coverage" });
  trail.step(T0, 1737.4, () => ({ lon: 179, lat: 0, heightKm: 50 }));
  const px = (lon: number, lat: number) => (Math.floor((0.5 - lat / 180) * 512) * 1024 + Math.floor((lon / 360 + 0.5) * 1024)) * 4 + 3;
  assert.equal(trail.data[px(177, 0)], 255);
  assert.equal(trail.data[px(-177, 0)], 255, "the far side of the date line");
  assert.equal(trail.data[px(-150, 0)], 0);
});

test("a swath over a pole is painted all the way round", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d", swath: "coverage" });
  trail.step(T0, 1737.4, () => ({ lon: 40, lat: 88, heightKm: 50 }));
  const px = (lon: number, lat: number) => (Math.floor((0.5 - lat / 180) * 512) * 1024 + Math.floor((lon / 360 + 0.5) * 1024)) * 4 + 3;
  assert.equal(trail.data[px(-140, 87)], 255);
  assert.equal(trail.data[px(40, 0)], 0);
});

test("a clock that jumps ahead fills the gap from the orbit, and matches a trail laid down in one go", () => {
  const stepped = createPaintTrail();
  stepped.set({ id: "lro", length: "1d" });
  stepped.step(T0, 1737.4, orbit, PERIOD);
  stepped.step(T0 + 5 * 3_600_000, 1737.4, orbit, PERIOD);
  const whole = createPaintTrail();
  whole.set({ id: "lro", length: "1d" });
  whole.step(T0 + 5 * 3_600_000, 1737.4, orbit, PERIOD);
  assert.ok(differ(mask(stepped), mask(whole)) < whole.pixels * 0.05, `${differ(mask(stepped), mask(whole))} of ${whole.pixels}`);
});

test("a clock run backwards uncovers the older end of the trail, and matches one laid down at that moment", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d" });
  trail.step(T0 + DAY, 1737.4, orbit, PERIOD);
  for (let h = 1; h <= 6; h += 1) trail.step(T0 + DAY - h * 3_600_000, 1737.4, orbit, PERIOD);
  const fresh = createPaintTrail();
  fresh.set({ id: "lro", length: "1d" });
  fresh.step(T0 + DAY - 6 * 3_600_000, 1737.4, orbit, PERIOD);
  assert.ok(differ(mask(trail), mask(fresh)) < fresh.pixels * 0.05, `${differ(mask(trail), mask(fresh))} of ${fresh.pixels}`);
});

test("a month of trail from a cold start follows the orbit: no long chords, and the first lay-down is bounded", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1m" });
  let calls = 0;
  trail.step(T0 + 40 * DAY, 1737.4, (ms) => ((calls += 1), orbit(ms)), PERIOD);
  assert.ok(calls <= 4001, String(calls));
  // no two samples a third of a trip apart or more, so no line is a chord across the orbit
  const times: number[] = [];
  const again = createPaintTrail();
  again.set({ id: "lro", length: "1m" });
  again.step(T0 + 40 * DAY, 1737.4, (ms) => (times.push(ms), orbit(ms)), PERIOD);
  assert.ok(times.every((t, i) => i === 0 || Math.abs(t - times[i - 1]!) <= PERIOD / 3 + 1));
  assert.ok(trail.pixels > 1000);
});

test("nothing older than the length is kept, and the buffer is the same size throughout", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d" });
  const size = trail.data.length;
  for (let h = 0; h <= 96; h += 3) trail.step(T0 + h * 3_600_000, 1737.4, orbit, PERIOD);
  const now = Math.round((T0 + 96 * 3_600_000) / 120_000) & 0xffff;
  let oldest = 0;
  for (let i = 0; i < trail.data.length; i += 4) {
    if (trail.data[i + 3] === 0) continue;
    const then = (trail.data[i]! << 8) | trail.data[i + 1]!;
    let age = now - then;
    if (age < -32768) age += 65536;
    oldest = Math.max(oldest, age);
  }
  assert.ok(oldest <= 721, `oldest stamp ${oldest} ticks`);
  assert.equal(trail.data.length, size);
});

test("a new craft empties the picture and says it must be sent, even before it has painted anything", () => {
  const trail = createPaintTrail();
  trail.set({ id: "lro", length: "1d" });
  trail.step(T0, 1737.4, orbit, PERIOD);
  trail.set({ id: "danuri", length: "1d" });
  assert.equal(trail.pixels, 0);
  assert.equal(trail.step(T0, 1737.4, () => null, PERIOD), true, "the cleared picture is sent once");
  assert.equal(trail.step(T0, 1737.4, () => null, PERIOD), false);
});
