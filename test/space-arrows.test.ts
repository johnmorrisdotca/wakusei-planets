// The arrows on an orbit line and the spin arrow of the help mode: the arrows point the way the body goes round, the spin axis is right for the Earth, Venus, Uranus and a moon that keeps one face to its planet,
// and the shapes are what the screen needs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonOffset } from "../src/scene/orient.ts";
import { arrowCount, arrowSites, MAX_ARROWS_PER_ORBIT, chevron, frameAt, moonOrbit, orbitLine, placeAround, placeMoon, placeSun, planetOrbit, spinArrow, spinAxis, ARROWS_PER_ORBIT, type ScaleMode } from "../src/space/index.ts";
import { cross, dot, length, unit, type Vec3 } from "../src/vec.ts";

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const ms = Date.UTC(2026, 10, 10, 12);
const DAY = 86_400_000;

test("arrows on a circle point the way round it, are spread evenly and are never at the first point, where the body is", () => {
  const circle = Array.from({ length: 97 }, (_, i) => [Math.cos((i / 96) * 2 * Math.PI), 0, Math.sin((i / 96) * 2 * Math.PI)] as Vec3);
  const arrows = arrowSites(circle, 4);
  assert.equal(arrows.length, 4);
  for (const arrow of arrows) {
    const sense = dot(cross(arrow.position, arrow.direction), [0, -1, 0]);
    assert.ok(sense > 0.99, `${sense}`);
    assert.ok(Math.abs(length(arrow.direction) - 1) < 1e-9);
    assert.ok(length(minus(arrow.position, circle[0]!)) > 0.5, "clear of the body");
  }
  assert.equal(arrowSites(circle).length, ARROWS_PER_ORBIT);
  assert.deepEqual(arrowSites([[0, 0, 0], [1, 0, 0]], 3), []);
});

for (const mode of ["true", "compressed"] as ScaleMode[]) {
  test(`${mode} scale: on the Earth's, Venus's, Mars's, Uranus's, Neptune's and Ceres's orbit lines every arrow points the way the body goes round the Sun, which is the way it goes now`, () => {
    const frame = frameAt(ms);
    const sun = placeSun(mode, frame.sun);
    for (const id of ["earth", "venus", "mars", "uranus", "neptune", "ceres"] as const) {
      const line = orbitLine(mode, sun, planetOrbit(id, ms, 96));
      // the way the body goes now, from its place a day before to a day after: its angular momentum about the Sun says which way round
      const before = placeAround(mode, sun, planetOrbit(id, ms - DAY, 1)[0]!);
      const after = placeAround(mode, sun, planetOrbit(id, ms + DAY, 1)[0]!);
      const now = placeAround(mode, sun, planetOrbit(id, ms, 1)[0]!);
      const momentum = cross(minus(now, sun), minus(after, before));
      const arrows = arrowSites(line);
      assert.equal(arrows.length, ARROWS_PER_ORBIT);
      for (const arrow of arrows) {
        const sense = dot(cross(minus(arrow.position, sun), arrow.direction), unit(momentum));
        assert.ok(sense > 0, `${id}, ${mode}: an arrow points against the way it goes (${sense})`);
      }
    }
  });
}

test("the Moon's ring: every arrow points the way the Moon goes round the Earth (counter-clockwise seen from the north), and they stay so with the clock run backwards", () => {
  for (const when of [ms, ms - 40 * DAY, ms + 400 * DAY]) {
    const ring = moonOrbit(when, 96).map((p) => placeMoon("true", p));
    const before = placeMoon("true", frameAt(when - DAY / 4).moon);
    const after = placeMoon("true", frameAt(when + DAY / 4).moon);
    const momentum = unit(cross(placeMoon("true", frameAt(when).moon), minus(after, before)));
    for (const arrow of arrowSites(ring)) assert.ok(dot(cross(arrow.position, arrow.direction), momentum) > 0.5);
  }
});

test("the spin axis: the Earth turns about its north pole, Venus and Uranus turn the other way about theirs, and a moon that keeps one face to its planet turns the way it goes round", () => {
  const earth = spinAxis("earth", ms);
  assert.ok(dot(earth.axis, earth.pole) > 0.999 && !earth.retrograde);
  assert.ok(earth.axis[1] > 0.9, "up, towards the north celestial pole, as the scene's y");
  const venus = spinAxis("venus", ms);
  assert.ok(venus.retrograde && dot(venus.axis, venus.pole) < -0.999);
  const uranus = spinAxis("uranus", ms);
  assert.ok(uranus.retrograde && dot(uranus.axis, uranus.pole) < -0.999);
  const eclipticNorth: Vec3 = [0, Math.cos((23.4393 * Math.PI) / 180), Math.sin((23.4393 * Math.PI) / 180)];
  assert.ok(Math.abs(dot(uranus.pole, eclipticNorth)) < 0.2, "Uranus lies on its side");
  for (const id of ["mars", "jupiter", "saturn", "neptune"] as const) assert.ok(!spinAxis(id, ms).retrograde, id);
  for (const id of ["moon", "io", "titan"] as const) {
    const r0 = moonOffset(id, ms);
    const r1 = moonOffset(id, ms + 3_600_000);
    const orbit = unit(cross(r0, r1));
    assert.ok(dot(spinAxis(id, ms).axis, orbit) > 0.95, `${id} turns the way it goes round`);
  }
});

test("an arrowhead on the screen: a wing at each side behind the tip, the length asked, and none for a way straight at the camera", () => {
  const right: Vec3 = [1, 0, 0];
  const up: Vec3 = [0, 1, 0];
  const [tip, a, b] = chevron([5, 5, 5], [1, 0, 0], right, up, 2)!;
  assert.deepEqual(tip, [5, 5, 5]);
  for (const wing of [a, b]) {
    assert.ok(wing[0] < tip[0], "behind the tip");
    assert.ok(Math.abs(length(minus(wing, tip)) - 2) < 1e-9);
  }
  assert.ok(Math.abs(a[1] - 5 + (b[1] - 5)) < 1e-9, "either side");
  assert.equal(chevron([0, 0, 0], [0, 0, 1], right, up, 2), null);
  // pointing up the screen
  const [, c] = chevron([0, 0, 0], [0, 1, 0], right, up, 1)!;
  assert.ok(c[1] < 0);
});

test("the spin arrow turns the way the body turns by the right-hand rule about the axis, with its head at the end", () => {
  for (const axis of [[0, 1, 0], unit([1, 1, 0]), [0, 0, 1], [0, -1, 0]] as Vec3[]) {
    const centre: Vec3 = [3, -2, 1];
    const { arc, head } = spinArrow(centre, axis, 1.3, 0.4, 28);
    assert.equal(arc.length, 29);
    const middle: Vec3 = [centre[0] + axis[0] * 0.4, centre[1] + axis[1] * 0.4, centre[2] + axis[2] * 0.4];
    for (let i = 0; i + 1 < arc.length; i += 1) assert.ok(dot(cross(minus(arc[i]!, middle), minus(arc[i + 1]!, middle)), unit(axis)) > 0, "counter-clockwise about the axis");
    for (const p of arc) assert.ok(Math.abs(length(minus(p, middle)) - 1.3) < 1e-9);
    const tip = arc[28]!;
    for (const wing of head) assert.ok(length(minus(wing, tip)) < 0.3 && length(minus(wing, tip)) > 0.05);
  }
});

test("an orbit carries two arrows by default, at most four, and the count is a whole number from none to four", () => {
  assert.equal(ARROWS_PER_ORBIT, 2);
  assert.equal(MAX_ARROWS_PER_ORBIT, 4);
  const circle = Array.from({ length: 97 }, (_, i) => [Math.cos((i / 96) * 2 * Math.PI), 0, Math.sin((i / 96) * 2 * Math.PI)] as Vec3);
  assert.equal(arrowSites(circle).length, 2);
  for (const [asked, drawn] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 4], [99, 4], [-3, 0], [2.6, 3]] as const) assert.equal(arrowSites(circle, asked).length, drawn, `asked for ${asked}`);
  // the attribute's text and anything that is not a number
  assert.equal(arrowCount(undefined), 2);
  assert.equal(arrowCount(null), 2);
  assert.equal(arrowCount(""), 2);
  assert.equal(arrowCount("many"), 2);
  assert.equal(arrowCount(Number.NaN), 2);
  assert.equal(arrowCount("3"), 3);
  assert.equal(arrowCount(" 1 "), 1);
  assert.equal(arrowCount("0"), 0);
  assert.equal(arrowCount("-1"), 0);
  assert.equal(arrowCount("9"), 4);
  assert.equal(arrowCount(3.4), 3);
  // spread evenly round the line: two arrows are half a turn apart
  const [a, b] = arrowSites(circle, 2);
  assert.ok(length([a!.position[0] + b!.position[0], a!.position[1] + b!.position[1], a!.position[2] + b!.position[2]]) < 0.05);
});

test("the far orbits are smooth curves: no corner of more than twenty degrees in Sedna's, Eris's, Gonggong's or Halley's line, in either scale", () => {
  const corners = (points: readonly Vec3[]): number => {
    let worst = 0;
    for (let i = 1; i < points.length - 1; i += 1) {
      const u = unit(minus(points[i]!, points[i - 1]!));
      const v = unit(minus(points[i + 1]!, points[i]!));
      worst = Math.max(worst, (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI);
    }
    return worst;
  };
  for (const id of ["sedna", "eris", "gonggong", "haumea", "halley", "pholus", "chiron"] as const) {
    const true_ = planetOrbit(id, ms, 96);
    assert.ok(corners(true_) < 20, `${id}: ${corners(true_).toFixed(1)} degrees at the sharpest corner`);
    for (const mode of ["true", "compressed"] as ScaleMode[]) {
      const line = orbitLine(mode, placeSun(mode, frameAt(ms).sun), true_);
      assert.ok(corners(line) < 30, `${id}, ${mode}: ${corners(line).toFixed(1)} degrees`);
    }
    // it goes once round and closes
    assert.ok(length(minus(true_[96]!, true_[0]!)) < 0.2 * Math.max(...true_.map(length)), `${id} closes`);
  }
});
