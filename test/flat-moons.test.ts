// The moons on their planet's flat map: which bodies have moons, the point on the ground each is straight above (checked against the Sun's phase of the Moon), the moons of the giants over their equators, and the tracks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { apparent } from "../src/ephemeris.ts";
import { MOONS_OF } from "../src/facts.ts";
import { FLAT_BODIES, flatMoonTrackHalf, flatMoonTracks, flatMoons, flatSun, moonsOfBody, wrapLongitude } from "../src/flat/index.ts";
import { angleBetween } from "../src/places.ts";

const T = Date.UTC(2026, 10, 23, 12);

test("the bodies with moons are the hosts the package knows, and the others have none", () => {
  assert.deepEqual([...moonsOfBody("earth")], ["moon"]);
  assert.deepEqual([...moonsOfBody("mars")], ["phobos", "deimos"]);
  assert.equal(moonsOfBody("jupiter").length, 6);
  assert.equal(moonsOfBody("saturn").length, 19);
  assert.equal(moonsOfBody("pluto").length, 5);
  for (const id of ["mercury", "venus", "moon", "io", "titan", "ceres", "vesta"] as const) assert.equal(moonsOfBody(id).length, 0, id);
  for (const id of FLAT_BODIES) assert.equal(moonsOfBody(id).length, id in MOONS_OF ? MOONS_OF[id as keyof typeof MOONS_OF].length : 0, id);
  assert.deepEqual(flatMoons("venus", T), []);
  assert.equal(flatMoonTracks("venus", T).size, 0);
});

test("the Moon is straight above the point that is as far from the Sun's point as the Moon is from the Sun in the sky", () => {
  // the angle between the point under the Sun and the point under the Moon is the Moon's elongation: 180 degrees less the Sun-Moon-Earth phase angle
  for (const day of [Date.UTC(2026, 10, 9), Date.UTC(2026, 10, 17), Date.UTC(2026, 10, 24, 15), Date.UTC(2026, 11, 2), Date.UTC(2027, 2, 3, 6)]) {
    const moon = flatMoons("earth", day)[0]!;
    const sun = flatSun("earth", day);
    const apart = angleBetween(sun.lat, sun.lon, moon.lat, moon.lon);
    assert.ok(Math.abs(apart - (180 - apparent("moon", day).phaseAngle)) < 0.5, `${new Date(day).toISOString()}: ${apart}`);
    assert.ok(Math.abs(moon.lat) < 29, "never north or south of the Moon's greatest declination");
    assert.ok(moon.distanceKm > 356_000 && moon.distanceKm < 407_000, `${moon.distanceKm} km`);
    assert.ok(moon.lon >= -180 && moon.lon < 180);
  }
});

test("the big moons of Jupiter are over its equator, in order of their distance, and each is far from the planet's centre", () => {
  const moons = flatMoons("jupiter", T);
  assert.equal(moons.length, 6);
  assert.deepEqual(moons.map((m) => m.id), ["amalthea", "thebe", "io", "europa", "ganymede", "callisto"]);
  for (const moon of moons) assert.ok(Math.abs(moon.lat) < 4, `${moon.id} is at ${moon.lat} degrees`);
  const distance = (id: string): number => moons.find((m) => m.id === id)!.distanceKm;
  assert.ok(Math.abs(distance("io") - 421_800) < 25_000 && Math.abs(distance("callisto") - 1_882_700) < 130_000);
  assert.ok(distance("io") < distance("europa") && distance("europa") < distance("ganymede") && distance("ganymede") < distance("callisto"));
});

test("a moon that keeps one face to its planet stays over one place (Charon over Pluto), and a close moon runs round the ground (Phobos over Mars)", () => {
  const charon = flatMoonTracks("pluto", T, 24).get("charon")!;
  const lons = charon.map((p) => p.lon);
  const spread = Math.max(...lons.map((l) => Math.abs(wrapLongitude(l - lons[0]!))));
  assert.ok(spread < 3, `Charon moves ${spread} degrees of longitude over Pluto`);
  const phobos = flatMoonTracks("mars", T, 48).get("phobos")!;
  let turned = 0;
  for (let i = 1; i < phobos.length; i += 1) turned += Math.abs(wrapLongitude(phobos[i]!.lon - phobos[i - 1]!.lon));
  assert.ok(turned > 300 && turned < 1200, `Phobos goes ${turned} degrees of longitude over Mars in half a turn`);
});

test("a track is half a turn of the planet either way, between an hour and two days, with its moments, from the first to the last", () => {
  assert.equal(flatMoonTrackHalf("jupiter"), (9.925 / 2) * 3_600_000);
  assert.equal(flatMoonTrackHalf("pluto"), 48 * 3_600_000);
  assert.equal(flatMoonTrackHalf("earth"), (23.9345 / 2) * 3_600_000);
  const tracks = flatMoonTracks("jupiter", T, 10);
  assert.equal(tracks.size, 6);
  const io = tracks.get("io")!;
  assert.equal(io.length, 11);
  assert.equal(io[0]!.ms, T - flatMoonTrackHalf("jupiter"));
  assert.equal(io[10]!.ms, T + flatMoonTrackHalf("jupiter"));
  assert.ok(Math.abs(io[5]!.ms - T) < 1);
  const now = flatMoons("jupiter", T).find((m) => m.id === "io")!;
  assert.ok(Math.abs(io[5]!.lat - now.lat) < 1e-6 && Math.abs(wrapLongitude(io[5]!.lon - now.lon)) < 1e-6, "the track passes through the moon");
});
