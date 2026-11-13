import assert from "node:assert/strict";
import { test } from "node:test";
import { orientation } from "../src/scene/orient.ts";
import { cross, dot, RAD, type Vec3 } from "../src/vec.ts";
import { faceView, frameAt, groundDirection, subCameraPoint } from "../src/space/index.ts";

const MS = Date.UTC(2026, 10, 2, 14);
const CENTRE = { lon: 10, lat: 20 };
const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
const unit = (v: Vec3): Vec3 => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };

test("for the Earth itself the point under the camera is the ground the view was aimed at: the centre less the yaw and tilt", () => {
  for (const [yaw, tilt] of [[0, 0], [35, -10], [-120, 40], [170, 5]] as const) {
    const at = subCameraPoint("earth", { yaw, tilt }, CENTRE, MS, MS);
    assert.ok(Math.abs(wrap(at.lon - (CENTRE.lon - yaw))) < 1e-6, `lon at ${yaw}`);
    assert.ok(Math.abs(at.lat - (CENTRE.lat - tilt)) < 1e-6, `lat at ${tilt}`);
  }
});

test("the Moon seen from the Earth's side has its sub-Earth point at the middle of its disc: longitude 0, latitude within the tilt of its pole", () => {
  for (const ms of [MS, MS + 7 * 86_400_000, MS + 20 * 86_400_000]) {
    const m = frameAt(ms).moon as unknown as Vec3;
    const d = unit([-m[0], -m[1], -m[2]]); // from the Moon to the Earth: where a camera on the Earth's side stands
    const earth = orientation("earth", ms);
    const lat = Math.asin(dot(d, earth.pole)) / RAD;
    const lon = Math.atan2(dot(d, cross(earth.pole, earth.meridian)), dot(d, earth.meridian)) / RAD;
    const view = { yaw: CENTRE.lon - lon, tilt: CENTRE.lat - lat };
    const at = subCameraPoint("moon", view, CENTRE, ms, ms);
    assert.ok(Math.abs(wrap(at.lon)) < 0.5, `longitude ${at.lon}`);
    assert.ok(Math.abs(at.lat) < 8, `latitude ${at.lat}`);
  }
});

test("turning the view to a face and asking for the face under the camera gives the same face, for every kind of body", () => {
  for (const body of ["moon", "mars", "jupiter", "earth", "mercury", "io"] as const) {
    for (const [lon, lat] of [[0, 0], [100, 20], [-170, -60], [45, 80]] as const) {
      const turn = faceView(body, { lon, lat }, CENTRE, MS, MS + 3_600_000);
      const back = subCameraPoint(body, turn, CENTRE, MS, MS + 3_600_000);
      assert.ok(Math.abs(wrap(back.lon - lon)) < 1e-6 || Math.abs(lat) > 79.9, `${body} ${lon},${lat}: longitude ${back.lon}`);
      assert.ok(Math.abs(back.lat - lat) < 1e-6, `${body} ${lon},${lat}: latitude ${back.lat}`);
    }
  }
});

test("a camera held in the stars sees the body turn under it: Mars goes by 14.6 degrees an hour, the Earth 15.04, in the direction of the spin", () => {
  const view = { yaw: 0, tilt: 0 };
  for (const [body, rate] of [["mars", 14.62], ["earth", 15.04]] as const) {
    const a = subCameraPoint(body, view, CENTRE, MS, MS);
    const b = subCameraPoint(body, view, CENTRE, MS, MS + 3_600_000);
    assert.ok(Math.abs(wrap(a.lon - b.lon) - rate) < 0.2, `${body}: ${wrap(a.lon - b.lon)}`);
  }
});

test("the shorter way round: the yaw asked for is within half a turn of where the view is", () => {
  const turn = faceView("mars", { lon: 100, lat: 20 }, CENTRE, MS, MS, 350);
  assert.ok(Math.abs(turn.yaw - 350) <= 180);
  assert.ok(Math.abs(wrap(turn.yaw) - wrap(faceView("mars", { lon: 100, lat: 20 }, CENTRE, MS, MS).yaw)) < 1e-9);
  // the ground direction the view aims at is the one the face names
  const d = groundDirection(CENTRE.lon - turn.yaw, CENTRE.lat - turn.tilt, MS);
  const { pole, meridian } = orientation("mars", MS);
  assert.ok(Math.abs(Math.asin(dot(d, pole)) / RAD - 20) < 1e-6);
  assert.ok(Math.abs(wrap(Math.atan2(dot(d, cross(pole, meridian)), dot(d, meridian)) / RAD - 100)) < 1e-6);
});
