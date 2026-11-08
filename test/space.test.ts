// The space view's maths: the places of the Sun, the Moon and the planets against an independent library (astronomy-engine, MIT, a dev dependency only), the two scales, and the track that
// looks the sky up about once a second and interpolates between.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Body, GeoVector, HelioVector, MakeTime } from "astronomy-engine";
import { greenwichMeanSiderealTime } from "../src/time.ts";
import { AU_IN_EARTH_RADII, blend, compress, createTrack, frameAt, groundDirection, MOON_COMPRESSED, placeAround, placeMoon, placeSun, planetOrbit, radiusIn, SPACE_PLANETS, SUN_COMPRESSED, truePosition } from "../src/space/index.ts";
import type { Vec3 } from "../src/vec.ts";

const RAD = Math.PI / 180;
const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);
const degrees = (a: Vec3, b: Vec3): number => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b)))) / RAD;
const engine = (x: { x: number; y: number; z: number }): Vec3 => [x.x, x.z, -x.y];
const BODY = { mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars, jupiter: Body.Jupiter, saturn: Body.Saturn, uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto } as const;
const DATES = [Date.UTC(2026, 10, 2, 12), Date.UTC(2024, 5, 15, 3), Date.UTC(2031, 0, 20, 18), Date.UTC(1999, 7, 11, 11)];

test("the Sun, the Moon and the planets are where astronomy-engine puts them, from the Earth's centre", () => {
  for (const ms of DATES) {
    const time = MakeTime(new Date(ms));
    const frame = frameAt(ms);
    const sun = engine(GeoVector(Body.Sun, time, false));
    assert.ok(degrees(frame.sun, sun) < 0.01, `Sun ${degrees(frame.sun, sun)}`);
    assert.ok(Math.abs(length(frame.sun) / length(sun) - 1) < 1e-4);
    const moon = engine(GeoVector(Body.Moon, time, false));
    assert.ok(degrees(frame.moon, moon) < 0.02, `Moon ${degrees(frame.moon, moon)}`);
    assert.ok(Math.abs(length(frame.moon) / length(moon) - 1) < 1e-3);
    for (const id of SPACE_PLANETS) {
      const ref = engine(GeoVector(BODY[id], time, false));
      // the library allows for the light's travel time; this view draws where the body is, so the larger ones differ by what the body moves in that time
      assert.ok(degrees(frame.planets[id], ref) < 0.06, `${id} ${new Date(ms).toISOString()} ${degrees(frame.planets[id], ref)}`);
      assert.ok(Math.abs(length(frame.planets[id]) / length(ref) - 1) < 2e-3, `${id} distance`);
    }
  }
});

test("the Moon at the new and full moon is on the Sun's side and opposite it", () => {
  const nov2026 = [Date.UTC(2026, 10, 9, 22, 2), Date.UTC(2026, 10, 24, 14, 53)];
  const [dark, full] = nov2026.map(frameAt) as [ReturnType<typeof frameAt>, ReturnType<typeof frameAt>];
  assert.ok(degrees(dark!.moon, dark!.sun) < 10);
  assert.ok(degrees(full!.moon, full!.sun) > 174);
});

test("the Sun's distance and declination follow the seasons", () => {
  const june = frameAt(Date.UTC(2026, 5, 21, 12)).sun;
  const december = frameAt(Date.UTC(2026, 11, 21, 12)).sun;
  assert.ok(Math.asin(june[1] / length(june)) / RAD > 23.3);
  assert.ok(Math.asin(december[1] / length(december)) / RAD < -23.3);
  const january = length(frameAt(Date.UTC(2026, 0, 3)).sun);
  const july = length(frameAt(Date.UTC(2026, 6, 6)).sun);
  assert.ok(january < 0.984 && july > 1.016);
});

test("a planet's orbit starts where it is and comes back to the same place", () => {
  const ms = Date.UTC(2026, 10, 2);
  for (const id of SPACE_PLANETS) {
    const points = planetOrbit(id, ms, 48);
    assert.equal(points.length, 49);
    const here = frameAt(ms);
    const helio: Vec3 = [here.planets[id][0] - here.sun[0], here.planets[id][1] - here.sun[1], here.planets[id][2] - here.sun[2]];
    assert.ok(length([points[0]![0] - helio[0], points[0]![1] - helio[1], points[0]![2] - helio[2]]) < 2e-3 * length(helio), `${id} starts at the planet`);
    const ref = HelioVector(BODY[id], MakeTime(new Date(ms)));
    assert.ok(degrees(points[0]!, engine(ref)) < 0.06, `${id} against the library`);
    const gap = length([points[48]![0] - points[0]![0], points[48]![1] - points[0]![1], points[48]![2] - points[0]![2]]);
    assert.ok(gap < 0.35 * length(helio), `${id} closes (${gap})`);
  }
});

test("the compressed scale keeps directions and puts the Moon 10 Earth radii away and the Sun 44", () => {
  const moon: Vec3 = [0.00257, 0, 0];
  assert.ok(Math.abs(length(compress(moon)) - MOON_COMPRESSED) < 1e-9);
  assert.deepEqual(compress([0, 0, 0]), [0, 0, 0]);
  const toward: Vec3 = [0.3, -0.4, 0.5];
  assert.ok(degrees(compress(toward), toward) < 1e-5);
  assert.ok(Math.abs(length(placeSun("compressed", [0.6, 0.6, 0.2])) - SUN_COMPRESSED) < 1e-9);
  assert.ok(degrees(placeSun("compressed", [0.6, 0.6, 0.2]), [0.6, 0.6, 0.2]) < 1e-5);
  // the Earth's own distance from the Sun is the 44, Neptune's is about 200
  assert.ok(Math.abs(length(placeAround("compressed", [0, 0, 0], [1, 0, 0])) - SUN_COMPRESSED) < 1e-9);
  const neptune = length(placeAround("compressed", [0, 0, 0], [30, 0, 0]));
  assert.ok(neptune > 190 && neptune < 210, `${neptune}`);
  assert.deepEqual(placeAround("compressed", [1, 2, 3], [0, 0, 0]), [1, 2, 3]);
});

test("the true scale is the real distance in Earth radii", () => {
  const moon = frameAt(Date.UTC(2026, 10, 2)).moon;
  const km = length(placeMoon("true", moon)) * 6378.137;
  assert.ok(km > 356_000 && km < 407_000, `${km}`);
  assert.ok(Math.abs(length(truePosition([1, 0, 0])) - AU_IN_EARTH_RADII) < 1e-9);
  assert.ok(Math.abs(length(placeSun("true", [1, 0, 0])) - AU_IN_EARTH_RADII) < 1e-9);
  assert.deepEqual(placeAround("true", [10, 0, 0], [1, 0, 0]), [10 + AU_IN_EARTH_RADII, 0, 0]);
  assert.ok(Math.abs(radiusIn("moon", "true") - 0.2724) < 0.001);
  assert.ok(Math.abs(radiusIn("sun", "true") - 109.1) < 0.2);
  assert.equal(radiusIn("earth", "true"), 1);
  assert.equal(radiusIn("jupiter", "compressed"), 1.8);
});

test("the track looks the sky up about twice a second at a day a second and interpolates within a tenth of a degree", () => {
  const track = createTrack(1000);
  const start = Date.UTC(2026, 10, 2);
  for (let i = 0; i < 100; i += 1) {
    const ms = start + i * 10_000;
    const frame = track.at(ms);
    assert.ok(degrees(frame.moon, frameAt(ms).moon) < 0.1);
  }
  assert.ok(track.lookups <= 2 * 100);
  const still = createTrack(1000);
  for (let i = 0; i < 40; i += 1) still.at(start + i * 20);
  assert.equal(still.lookups, 2);
  assert.ok(still.ends());
  still.reset();
  assert.equal(still.ends(), undefined);
  still.setStep(60_000);
  still.at(start);
  assert.equal(still.ends()![1].ms - still.ends()![0].ms, 60_000);
});

test("blend is the middle of two frames", () => {
  const a = frameAt(Date.UTC(2026, 10, 2));
  const b = frameAt(Date.UTC(2026, 10, 3));
  const m = blend(a, b, 0.5);
  assert.equal(m.ms, (a.ms + b.ms) / 2);
  assert.ok(Math.abs(m.sun[0] - (a.sun[0] + b.sun[0]) / 2) < 1e-12);
});

test("the sky can be worked out backwards in time", () => {
  const track = createTrack(1000);
  const a = track.at(Date.UTC(2026, 10, 2));
  const b = track.at(Date.UTC(2020, 0, 1));
  assert.ok(degrees(a.sun, b.sun) > 1);
  assert.equal(track.lookups, 4);
});

test("the ground direction follows the Earth's turn: Greenwich is at the sidereal angle, 90 degrees east is a quarter turn on, the pole is the pole", () => {
  const ms = Date.UTC(2026, 10, 2, 14);
  const [x, y, z] = groundDirection(0, 0, ms);
  const ra = (Math.atan2(-z, x) / RAD + 360) % 360;
  assert.ok(Math.abs(ra - greenwichMeanSiderealTime(ms)) < 1, `${ra} against ${greenwichMeanSiderealTime(ms)}`);
  assert.ok(Math.abs(y) < 0.01);
  const east = groundDirection(90, 0, ms);
  assert.ok(Math.abs(((Math.atan2(-east[2], east[0]) / RAD + 360) % 360) - ((ra + 90) % 360)) < 1);
  assert.ok(groundDirection(0, 90, ms)[1] > 0.999);
  const later = groundDirection(0, 0, ms + 3_600_000);
  assert.ok(Math.abs(degrees([x, y, z], later) - 15.04) < 0.1);
});
