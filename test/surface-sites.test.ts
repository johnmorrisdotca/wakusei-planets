// The standing view's sites on the Moon and Mars: every site the landing table says can be stood at is in the standing view's table at the same point, Mars has its own gravity and sky, and a site with no height model
// is a flat stand-in that says so and carries no relief.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LANDING_SITES } from "../src/landing-sites.ts";
import { driveStep, startDrive } from "../src/surface/drive.ts";
import { DustField } from "../src/surface/dust.ts";
import { flatManifest, flatTerrain } from "../src/surface/flat.ts";
import { groundAt } from "../src/surface/height.ts";
import { MARS_GRAVITY, MOON_GRAVITY, SURFACE_SITES, siteById } from "../src/surface/site.ts";
import { marsAir, standSky } from "../src/surface/sky.ts";

test("every landing site that leads to the standing view is there at the same point, place, body and moment", () => {
  const stands = LANDING_SITES.filter((site) => site.stand !== undefined);
  assert.deepEqual(stands.map((site) => site.stand).sort(), SURFACE_SITES.map((site) => site.id).sort());
  for (const landing of stands) {
    const site = siteById(landing.stand!)!;
    assert.equal(site.body, landing.body);
    assert.equal(site.place, landing.place);
    assert.ok(Math.abs(site.lat - landing.lat) < 1e-9 && Math.abs(site.lon - landing.lon) < 1e-9, `${site.id}'s point`);
    // the landing's own minute (the table's ISO date)
    assert.equal(site.time, Date.parse(landing.date), `${site.id}'s moment`);
  }
});

test("only Apollo 17 has measured heights; the rest say flat", () => {
  assert.deepEqual(SURFACE_SITES.filter((site) => site.ground === "measured").map((site) => site.id), ["apollo-17"]);
  assert.equal(SURFACE_SITES.filter((site) => site.body === "mars").length, 2);
  assert.equal(siteById("perseverance")!.gravity, 3.71);
  assert.equal(siteById("apollo-15")!.gravity, MOON_GRAVITY);
});

test("a flat stand-in is the datum everywhere, with nothing to fetch, and says so", () => {
  const site = siteById("perseverance")!;
  const terrain = flatTerrain(site);
  assert.equal(terrain.bytes, 0);
  assert.equal(terrain.manifest.body, "mars");
  assert.equal(terrain.manifest.radius, 3_389_500);
  assert.equal(terrain.pictures.length, 0);
  assert.equal(terrain.levels.length, 4);
  for (const [east, north] of [[0, 0], [123.4, -56.7], [4000, 4000], [-60_000, 20_000], [200_000, -200_000]] as const) assert.equal(groundAt(terrain.levels, terrain.manifest.height, east, north), 0, `${east} ${north}`);
  assert.match(flatManifest(siteById("curiosity")!).accuracy, /flat stand-in until height data is added/);
});

test("Mars's gravity is 3.71: a free-falling rover and a thrown grain fall 2.29 times as fast as on the Moon", () => {
  const air = (g?: number) => {
    let rover = { ...startDrive(0, 0, 0, 5), airborne: true };
    for (let i = 0; i < 20; i += 1) rover = driveStep(rover, { throttle: 0, steer: 0 }, 0.05, () => -1000, undefined, undefined, g);
    return rover.vy;
  };
  assert.ok(Math.abs(air(MARS_GRAVITY) / air(MOON_GRAVITY) - MARS_GRAVITY / MOON_GRAVITY) < 0.02, `${air(MARS_GRAVITY)} against ${air(MOON_GRAVITY)}`);
  assert.ok(Math.abs(air() - air(MOON_GRAVITY)) < 1e-12, "the Moon's is the default");
  const grain = (g: number): number => {
    const dust = new DustField(1, 1);
    dust.emit([0, 0, 0], [0, 4, 0], 10);
    dust.step(0.5, () => -100, g);
    return dust.velocity[1]!;
  };
  assert.ok(grain(MARS_GRAVITY) < grain(MOON_GRAVITY));
});

test("the Sun at Jezero and Gale is where the hour of the landing puts it, from Mars's own distance", () => {
  // Mars24's mean local time at the landing (the mean sun is up to 13 degrees (51 minutes) from the true one: the equation of time)
  const mean = (time: number, lon: number): number => {
    const jd = time / 86_400_000 + 2_440_587.5 + 69.184 / 86_400;
    const msd = (jd - 2_451_549.5) / 1.0274912517 + 44_796.0 - 0.0009626;
    return (24 * msd + lon / 15) % 24;
  };
  for (const id of ["perseverance", "curiosity"]) {
    const site = siteById(id)!;
    const sky = standSky("mars", site.lat, site.lon, site.time);
    const hourAngle = (mean(site.time, site.lon) - 12) * 15;
    // the Sun is up in the afternoon, to the west of south, and its true hour angle is within the equation of time of the mean one
    assert.ok(sky.sun.altitude > 25 && sky.sun.altitude < 50, `${id}: ${sky.sun.altitude}`);
    assert.ok(sky.sun.azimuth > 230 && sky.sun.azimuth < 300, `${id}: ${sky.sun.azimuth}`);
    const R = Math.PI / 180;
    const a = sky.sun.altitude * R;
    const z = sky.sun.azimuth * R;
    const p = site.lat * R;
    const ha = Math.atan2(-Math.sin(z) * Math.cos(a), Math.sin(a) * Math.cos(p) - Math.cos(a) * Math.sin(p) * Math.cos(z)) / R;
    assert.ok(Math.abs(ha - hourAngle) < 14, `${id}: hour angle ${ha} against mean ${hourAngle}`);
    assert.ok(sky.sunDiameter > 0.31 && sky.sunDiameter < 0.4, `the Sun from Mars is a third of a degree: ${sky.sunDiameter}`);
    assert.equal(sky.earthDisc, false);
    assert.ok(sky.air !== null && sky.air.daylight > 0.99);
  }
});

test("the Moon's sky has no air and keeps the Earth as a disc; Mars's air is butterscotch by day, blue round a low Sun, black at night", () => {
  const moon = standSky("moon", 26.1324, 3.6333, siteById("apollo-15")!.time);
  assert.equal(moon.air, null);
  assert.equal(moon.earthDisc, true);
  assert.ok(moon.sun.altitude > 8 && moon.sun.altitude < 16);
  const noon = marsAir(60);
  assert.ok(noon.horizon[0] > noon.horizon[2] && noon.zenith[0] > noon.zenith[2], "red over blue by day");
  assert.ok(noon.glow[0] > noon.glow[2], "the glow round a high Sun is tan");
  const dusk = marsAir(1);
  assert.ok(dusk.glow[2] > dusk.glow[0], "the glow round a low Sun is blue");
  assert.ok(marsAir(-3).daylight > 0.1 && marsAir(-3).daylight < 0.6, "a long twilight");
  const night = marsAir(-30);
  assert.deepEqual([night.daylight, ...night.zenith, ...night.horizon], [0, 0, 0, 0, 0, 0, 0]);
  assert.ok(night.ambient < noon.ambient);
});
