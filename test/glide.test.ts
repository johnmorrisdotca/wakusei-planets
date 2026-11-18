// The smooth move of the standing view's camera (MODULES-1561): the curve, the blend of two poses, and that the element starts one when the watched descent ends, when the rover starts and when the watch's camera changes, and not otherwise.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { blendPose, easeInOut, GLIDE_MS, type Pose } from "../src/surface/glide.ts";

const flat = (): number => 100;
const from: Pose = { east: 0, north: 150, up: 101.7, look: { azimuth: 350, pitch: 12, fov: 27 } };
const to: Pose = { east: 0, north: 0, up: 101.7, look: { azimuth: 10, pitch: 0, fov: 74 } };

test("the curve starts at 0, ends at 1, is flat at both ends, rises all the way and holds outside 0 to 1", () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(-3), 0);
  assert.equal(easeInOut(7), 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 1e-12);
  assert.ok(easeInOut(0.01) < 0.0001, "slow at the start");
  assert.ok(1 - easeInOut(0.99) < 0.0001, "slow at the end");
  let last = 0;
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const now = easeInOut(t);
    assert.ok(now >= last, `rising at ${t}`);
    last = now;
  }
  assert.ok(GLIDE_MS > 300 && GLIDE_MS < 3000);
});

test("a blend is the first pose at 0 and the second at 1, exactly, and neither pose is changed", () => {
  const a = JSON.stringify(from);
  const b = JSON.stringify(to);
  assert.deepEqual(blendPose(from, to, 0, flat), from);
  assert.deepEqual(blendPose(from, to, 1, flat), to);
  assert.deepEqual(blendPose(from, to, -1, flat), from);
  assert.deepEqual(blendPose(from, to, 2, flat), to);
  assert.notEqual(blendPose(from, to, 0, flat).look, from.look, "a new object");
  assert.equal(JSON.stringify(from), a);
  assert.equal(JSON.stringify(to), b);
});

test("half way is half way: the eye on the line between, the pitch and field of view in the middle, and the azimuth the short way round (350 to 10 passes 0, not 180)", () => {
  const mid = blendPose(from, to, 0.5, flat);
  assert.equal(mid.east, 0);
  assert.equal(mid.north, 75);
  assert.equal(mid.up, 101.7);
  assert.equal(mid.look.pitch, 6);
  assert.equal(mid.look.fov, 50.5);
  assert.ok(Math.abs(mid.look.azimuth - 0) < 1e-9 || Math.abs(mid.look.azimuth - 360) < 1e-9, `azimuth ${mid.look.azimuth}`);
  const quarter = blendPose(from, to, 0.25, flat);
  assert.ok(Math.abs(quarter.look.azimuth - 355) < 1e-9);
  // the other way round: 10 to 350
  const back = blendPose(to, from, 0.5, flat);
  assert.ok(back.look.azimuth < 1e-9 || back.look.azimuth > 359.999999);
  assert.ok(blendPose(from, to, 0.7, flat).look.azimuth < 360);
});

test("the eye keeps its height above the ground, blended, so it does not go under a hill between the two places", () => {
  // a hill 40 m high half way between: the ground rises from 100 at the ends to 140 in the middle
  const hill = (_east: number, north: number): number => 100 + 40 * Math.exp(-(((north - 75) / 30) ** 2));
  const start: Pose = { ...from, up: hill(0, 150) + 1.7 };
  const end: Pose = { ...to, up: hill(0, 0) + 1.7 };
  for (const k of [0.2, 0.4, 0.5, 0.6, 0.8]) {
    const pose = blendPose(start, end, k, hill);
    assert.ok(Math.abs(pose.up - hill(pose.east, pose.north) - 1.7) < 1e-9, `k=${k}: 1.7 m above the ground`);
  }
  // from 40 m up (the window) to 1.7 m (standing): the height above the ground comes down evenly
  const window: Pose = { ...from, up: hill(0, 150) + 40 };
  assert.ok(Math.abs(blendPose(window, end, 0.5, hill).up - hill(0, 75) - 20.85) < 1e-9);
});

test("the element starts a move when the watched descent ends and when the rover starts, from the last draw's pose, and not for any other change; a reader who prefers reduced motion, or glide=off, gets a cut", () => {
  const source = readFileSync("src/surface/element.ts", "utf8");
  assert.match(source, /#beginGlide\(\): void \{[\s\S]*?!last\.fromWatch \|\| setting === "off"[\s\S]*?prefers-reduced-motion: reduce/);
  const off = source.slice(source.indexOf("#syncLanding(again = false)"), source.indexOf("const camera = this.getAttribute(\"watch-camera\")"));
  assert.match(off, /this\.#beginGlide\(\);\s*this\.#changed\(\);\s*return;/, "the watch ends");
  const drive = source.slice(source.indexOf("#syncDrive(): void {"), source.indexOf("/** The vehicle's measures"));
  assert.match(drive, /this\.#syncDriveCamera\(\);\s*this\.#beginGlide\(\);/, "the rover starts");
  const again = source.slice(source.indexOf("if (!again) return;"), source.indexOf("if (changed) this.#landingAnnounce();"));
  assert.match(again, /const moved = changed \|\| this\.#landing\.from\.distance !== from\.distance \|\| this\.#landing\.from\.bearing !== from\.bearing;[\s\S]*?if \(moved\) this\.#beginGlide\(\);\s*this\.#landingFrame\(0, true\);/, "the watch's camera, or where the ground camera stands, changes");
  assert.equal((source.match(/this\.#beginGlide\(\)/g) ?? []).length, 3, "and nowhere else");
  assert.match(source, /fromWatch: this\.#landing !== undefined \|\| this\.#glide !== undefined/, "a move from a move goes on from where that had got to");
  assert.match(source, /#onPointerDown = \(event: PointerEvent\): void => \{\s*this\.#glide = undefined;/, "a hand on the view ends the move");
  assert.match(source, /if \(this\.#glide !== undefined\) this\.#changed\(\);/, "the move draws frame after frame");
});
