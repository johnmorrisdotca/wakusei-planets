// The space view's maths: the places of the Sun, the Moon and the planets against an independent library (astronomy-engine, MIT, a dev dependency only), the two scales, and the track that
// looks the sky up about once a second and interpolates between.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Body, GeoVector, HelioVector, MakeTime } from "astronomy-engine";
import { greenwichMeanSiderealTime } from "../src/time.ts";
import { AU_IN_EARTH_RADII, blend, compress, createTrack, frameAt, groundDirection, MOON_COMPRESSED, moonDistance, orbitLine, placeAround, placeBodies, placeMoon, placeSun, planetOrbit, radiusIn, RIDE_FOV, ridePose, SPACE_PLANETS, SUN_COMPRESSED, truePosition, type ScaleMode } from "../src/space/index.ts";
import { MOONS_OF } from "../src/facts.ts";
import { moonOffset } from "../src/scene/orient.ts";
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

test("the compressed scale keeps directions, puts the Moon close and the Sun at the Earth's own distance", () => {
  const moon: Vec3 = [0.00257, 0, 0];
  assert.ok(Math.abs(length(compress(moon)) - MOON_COMPRESSED) < 1e-9);
  assert.deepEqual(compress([0, 0, 0]), [0, 0, 0]);
  const toward: Vec3 = [0.3, -0.4, 0.5];
  assert.ok(degrees(compress(toward), toward) < 1e-5);
  const sun: Vec3 = [0.6, 0.6, 0.2];
  assert.ok(Math.abs(length(placeSun("compressed", sun)) - SUN_COMPRESSED * length(sun) ** 0.45) < 1e-9);
  assert.ok(degrees(placeSun("compressed", sun), sun) < 1e-5);
  // the Earth's own distance from the Sun is the unit, Neptune's is about 4.6 of it
  assert.ok(Math.abs(length(placeAround("compressed", [0, 0, 0], [1, 0, 0])) - SUN_COMPRESSED) < 1e-9);
  const neptune = length(placeAround("compressed", [0, 0, 0], [30, 0, 0])) / SUN_COMPRESSED;
  assert.ok(neptune > 4.4 && neptune < 4.8, `${neptune}`);
  assert.deepEqual(placeAround("compressed", [1, 2, 3], [0, 0, 0]), [1, 2, 3]);
});

const SCALES: readonly ScaleMode[] = ["compressed", "true"];
const SAMPLE_DATES = [Date.UTC(2026, 10, 2, 12), Date.UTC(2031, 2, 5), Date.UTC(2019, 8, 20, 6), Date.UTC(2044, 5, 1)];
const ORBIT_BODIES = ["earth", ...SPACE_PLANETS] as const;
const near = (p: Vec3, line: readonly Vec3[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i += 1) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const ab: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ap: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t));
  }
  return best;
};

test("every body lies on its own orbit line, at several dates and in both scales: one mapping places the bodies and the lines", () => {
  for (const mode of SCALES) {
    for (const ms of SAMPLE_DATES) {
      const frame = frameAt(ms);
      const places = placeBodies(mode, frame);
      for (const id of ORBIT_BODIES) {
        const line = orbitLine(mode, places.sun, planetOrbit(id, ms, 192));
        const sunToBody = length([places[id][0] - places.sun[0], places[id][1] - places.sun[1], places[id][2] - places.sun[2]]);
        // a body sits on its line to within what 192 straight segments leave out of a curve, and the length of the model's own error
        assert.ok(near(places[id], line) < 0.004 * sunToBody + 1e-6, `${id} ${mode} ${new Date(ms).toISOString()}: ${near(places[id], line)} of ${sunToBody}`);
      }
    }
  }
});

test("the Earth is at the centre and on its own orbit, and the Moon is nearer to it than any other orbit", () => {
  for (const ms of SAMPLE_DATES) {
    const frame = frameAt(ms);
    const places = placeBodies("compressed", frame);
    assert.deepEqual(places.earth, [0, 0, 0]);
    const moon = length(places.moon);
    assert.ok(moon > 3 && moon < 4, `${moon}`);
    for (const id of ["venus", "mars"] as const) {
      const line = orbitLine("compressed", places.sun, planetOrbit(id, ms, 192));
      assert.ok(moon < 0.5 * near(places.earth, line), `the Moon ${moon} against the orbit of ${id} at ${near(places.earth, line)}`);
    }
  }
});

test("a compressed view keeps every moon's orbit well inside the gap to the neighbouring planets' orbits", () => {
  const row = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"] as const;
  for (const ms of SAMPLE_DATES) {
    const places = placeBodies("compressed", frameAt(ms));
    const lines = Object.fromEntries(row.map((id) => [id, orbitLine("compressed", places.sun, planetOrbit(id, ms, 192))])) as Record<(typeof row)[number], Vec3[]>;
    for (const host of Object.keys(MOONS_OF) as (keyof typeof MOONS_OF)[]) {
      if (!(row as readonly string[]).includes(host)) continue;
      let farthest = 0;
      for (const moon of MOONS_OF[host]) {
        for (let i = 0; i < 48; i += 1) {
          const d = length(moonOffset(moon, ms + i * 7 * 86_400_000));
          farthest = Math.max(farthest, host === "earth" ? length(compress(frameAt(ms + i * 7 * 86_400_000).moon)) : moonDistance("compressed", host as (typeof SPACE_PLANETS)[number], d) * radiusIn(host as (typeof SPACE_PLANETS)[number], "compressed"));
        }
      }
      for (const other of row) {
        if (other === host) continue;
        const gap = near(places[host as (typeof row)[number]], lines[other]);
        assert.ok(farthest < 0.6 * gap, `${host}'s moons reach ${farthest.toFixed(1)}, the orbit of ${other} is ${gap.toFixed(1)} away, at ${new Date(ms).toISOString()}`);
      }
    }
  }
});

test("compressing the moons keeps their order and leaves the true scale alone", () => {
  for (const host of ["jupiter", "saturn", "neptune", "pluto"] as const) {
    const moons = MOONS_OF[host];
    const real = moons.map((moon) => length(moonOffset(moon, Date.UTC(2026, 10, 2)))).sort((a, b) => a - b);
    const drawn = real.map((d) => moonDistance("compressed", host, d));
    for (let i = 1; i < drawn.length; i += 1) assert.ok(drawn[i]! > drawn[i - 1]!, `${host} keeps its order`);
    assert.ok(drawn.every((d, i) => d <= real[i]! + 1e-9));
    assert.deepEqual(real.map((d) => moonDistance("true", host, d)), real);
  }
  assert.equal(moonDistance("compressed", "mars", 6.9), 6.9);
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

const dotOf = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const rideOf = (extra: Partial<Parameters<typeof ridePose>[0]> = {}) => ridePose({ position: [1.066, 0, 0], velocity: [0, 0, -7.66], radius: 1, look: "down", yaw: 0, tilt: 0, zoom: 1, ...extra });

test("riding along looking down: the camera looks at the centre with the way it goes at the top, and the body fills 70 degrees at 420 km", () => {
  const pose = rideOf();
  assert.ok(degrees(pose.forward, [-1, 0, 0]) < 1e-4);
  assert.ok(degrees(pose.up, [0, 0, -1]) < 1e-4);
  assert.equal(pose.fov, RIDE_FOV);
  assert.ok(Math.abs(pose.bodyRadiusDegrees - Math.asin(1 / 1.066) / RAD) < 1e-9);
});

test("riding along looking at the horizon: tipped forward by the body's angular radius less 12 degrees", () => {
  const pose = rideOf({ look: "horizon" });
  const tip = degrees(pose.forward, [-1, 0, 0]);
  assert.ok(Math.abs(tip - (pose.bodyRadiusDegrees - 12)) < 1e-6, `${tip}`);
  assert.ok(dotOf(pose.forward, [0, 0, -1]) > 0);
  assert.ok(Math.abs(dotOf(pose.forward, pose.up)) < 1e-9);
});

test("riding round any body: the radius is only a unit, so kilometres and radii give the same camera", () => {
  const inRadii = ridePose({ position: [5.9, 0, 0], velocity: [0, 1, 0], radius: 1, look: "horizon", yaw: 20, tilt: -10, zoom: 2 });
  const inKm = ridePose({ position: [5.9 * 69_911, 0, 0], velocity: [0, 17, 0], radius: 69_911, look: "horizon", yaw: 20, tilt: -10, zoom: 2 });
  assert.ok(degrees(inRadii.forward, inKm.forward) < 1e-6);
  assert.ok(degrees(inRadii.up, inKm.up) < 1e-6);
  assert.ok(Math.abs(inRadii.bodyRadiusDegrees - inKm.bodyRadiusDegrees) < 1e-9);
  const moonOverJupiter = Math.asin(1 / 5.9) / RAD;
  assert.ok(Math.abs(inRadii.bodyRadiusDegrees - moonOverJupiter) < 1e-9);
});

test("a moon's way of going from two positions a second apart is the top of the picture", () => {
  const ms = Date.UTC(2026, 10, 2, 14);
  const here = moonOffset("io", ms);
  const soon = moonOffset("io", ms + 1000);
  const velocity: Vec3 = [soon[0] - here[0], soon[1] - here[1], soon[2] - here[2]];
  const pose = ridePose({ position: here, velocity, radius: 1, look: "down", yaw: 0, tilt: 0, zoom: 1 });
  assert.ok(degrees(pose.forward, [-here[0], -here[1], -here[2]]) < 1e-6);
  assert.ok(dotOf(pose.up, velocity) / length(velocity) > 0.99);
  assert.ok(Math.abs(length(here) - 5.9) < 0.3);
});

test("with no way of going, or one straight at the body, the camera still has a top: north, or east where north is straight down", () => {
  for (const velocity of [[0, 0, 0], [-3, 0, 0]] as Vec3[]) {
    const pose = rideOf({ velocity });
    assert.ok(Math.abs(length(pose.up) - 1) < 1e-9 && Math.abs(length(pose.forward) - 1) < 1e-9);
    assert.ok(Math.abs(dotOf(pose.forward, pose.up)) < 1e-9);
  }
  const overPole = ridePose({ position: [0, 1.2, 0], velocity: [0, 0, 0], radius: 1, look: "down", yaw: 0, tilt: 0, zoom: 1 });
  assert.ok(Math.abs(length(overPole.up) - 1) < 1e-9);
});

test("a drag looks about: yaw turns the camera to its left, tilt tips it towards the bottom, and the pace follows the field of view", () => {
  const base = rideOf();
  const left = rideOf({ yaw: 30 });
  const turned = degrees(base.forward, left.forward);
  assert.ok(Math.abs(turned - 30 * (1.5 * 60) / 180) < 1e-6, `${turned}`);
  assert.ok(left.forward[1] > 0.25, "the camera turns to its left (its left is +y here), so the ground moves right");
  const tipped = rideOf({ tilt: 20 });
  assert.ok(Math.abs(degrees(base.forward, tipped.forward) - 20 * (1.5 * 60) / 60) < 1e-6);
  assert.ok(dotOf(tipped.forward, [0, 0, -1]) < 0, "tilt tips the camera towards the bottom of its picture, which is behind it");
  const zoomed = rideOf({ zoom: 4, yaw: 30 });
  assert.ok(Math.abs(zoomed.fov - 15) < 1e-9);
  assert.ok(degrees(base.forward, zoomed.forward) < turned / 3);
  assert.equal(rideOf({ zoom: 1000 }).fov, 5);
  assert.equal(rideOf({ zoom: 0.001 }).fov, 100);
});

test("on or inside the body the angular radius is a quarter turn", () => {
  assert.equal(rideOf({ position: [0.9, 0, 0] }).bodyRadiusDegrees, 90);
  assert.equal(rideOf({ position: [1, 0, 0] }).bodyRadiusDegrees, 90);
});
