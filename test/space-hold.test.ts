// The frames the camera holds its direction in while time runs (src/space/hold.ts), walked without a browser: fixed to the stars, turning with the body in focus, and turning with a pair.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, type BodyId } from "../src/facts.ts";
import { bodyBasis, carry, controlsFor, directionBetween, FRAMES, hasRotation, holdSite, keepClear, pairAxis, pairBasis, readFrame } from "../src/space/hold.ts";
import { heldAim, newSpaceModel } from "../src/space/scene.ts";
import { groundDirection } from "../src/space/aim.ts";
import { cross, dot, length, RAD, scale, sub, unit, type Vec3 } from "../src/vec.ts";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2);
const angle = (a: Vec3, b: Vec3): number => Math.atan2(length(cross(a, b)), dot(a, b));

test("the frames are read as written, and anything else is the stars", () => {
  assert.deepEqual(FRAMES, ["stars", "body", "pair"]);
  assert.equal(readFrame("pair"), "pair");
  assert.equal(readFrame("body"), "body");
  for (const other of ["stars", "", null, undefined, "Pair", 3]) assert.equal(readFrame(other), "stars");
});

test("a basis is three unit vectors square to one another and right-handed", () => {
  for (const id of ["mars", "ceres", "io", "sun", "moon"] as BodyId[]) {
    const basis = bodyBasis(id, T0)!;
    assert.ok(basis, id);
    for (const v of [basis.a, basis.b, basis.c]) assert.ok(Math.abs(length(v) - 1) < 1e-9);
    assert.ok(Math.abs(dot(basis.a, basis.b)) < 1e-9 && Math.abs(dot(basis.a, basis.c)) < 1e-9 && Math.abs(dot(basis.b, basis.c)) < 1e-9);
    assert.ok(angle(cross(basis.a, basis.b), basis.c) < 1e-9, `${id}: right-handed`);
  }
  const pair = pairBasis([3, 0, 0], [0.2, 1, 0]);
  assert.ok(angle(pair.a, [1, 0, 0]) < 1e-12 && Math.abs(dot(pair.c, pair.a)) < 1e-12 && angle(cross(pair.a, pair.b), pair.c) < 1e-9);
});

test("a body with no known rotation has no basis, and every other has one", () => {
  const without = (Object.keys(BODIES) as BodyId[]).filter((id) => !hasRotation(id));
  assert.ok(without.length > 0, "some body has no known rotation");
  for (const id of without) assert.equal(bodyBasis(id, T0), null, id);
  for (const id of ["mars", "ceres", "moon", "phobos", "io", "sun"] as BodyId[]) assert.ok(hasRotation(id), id);
});

test("carried with a body's basis, a direction keeps its place on the ground as the body spins (Mars for a day, Ceres, a moon)", () => {
  for (const id of ["mars", "ceres", "moon", "io"] as BodyId[]) {
    const from = bodyBasis(id, T0)!;
    const aim = unit([0.4, 0.3, 0.86]);
    // the longitude and latitude of the direction on the body, which a stationary viewer over one place of the ground reads as the same
    const place = (a: Vec3, b: NonNullable<ReturnType<typeof bodyBasis>>): [number, number] => [Math.atan2(dot(a, b.b), dot(a, b.a)), Math.asin(dot(a, b.c))];
    const start = place(aim, from);
    let turned = 0;
    let before = aim;
    for (let hour = 1; hour <= 24; hour += 1) {
      const to = bodyBasis(id, T0 + hour * 3_600_000)!;
      const now = carry(aim, from, to);
      const [lon, lat] = place(now, to);
      assert.ok(Math.abs(lon - start[0]) < 1e-9 && Math.abs(lat - start[1]) < 1e-9, `${id}: the place on the ground moved at hour ${hour}`);
      turned += angle(before, now);
      before = now;
    }
    // while the picture under a camera fixed to the stars would have turned: the body's own spin, except for a moon that is held to its planet, which goes round only once an orbit
    assert.ok(turned > 0, `${id}: the camera turned with the body`);
  }
});

test("carried with a pair's basis, the companion stays at the same angle from the camera's direction for a year, and the camera circles the body in focus without a jump (the Sun behind Mercury, the Earth behind the Moon, Titan and Saturn)", () => {
  for (const [focus, companion] of [["mercury", "sun"], ["moon", "earth"], ["titan", "saturn"], ["io", "jupiter"], ["oberon", "uranus"]] as [BodyId, BodyId][]) {
    for (const mode of ["compressed", "true"] as const) {
      const toward = (ms: number): Vec3 => directionBetween(focus, companion, mode, ms);
      const axis = pairAxis(toward, T0);
      const from = pairBasis(toward(T0), axis);
      // the Sun behind Mercury at the back left: the camera on the far side of Mercury from the Sun, turned 20 degrees about the axis
      const aim = unit([-Math.cos(20 * RAD) * from.a[0] + Math.sin(20 * RAD) * from.b[0], -Math.cos(20 * RAD) * from.a[1] + Math.sin(20 * RAD) * from.b[1], -Math.cos(20 * RAD) * from.a[2] + Math.sin(20 * RAD) * from.b[2]]);
      const wanted = angle(aim, toward(T0));
      let before = aim;
      let steps = 0;
      const step = focus === "io" || focus === "moon" || focus === "titan" ? 3_600_000 * 4 : DAY;
      const span = focus === "io" || focus === "moon" || focus === "titan" ? 40 * DAY : 365 * DAY;
      let worst = 0;
      let companionStep = 0;
      let drift = 0;
      for (let ms = step; ms <= span; ms += step) {
        const to = pairBasis(toward(T0 + ms), axis);
        const now = carry(aim, from, to);
        drift = Math.max(drift, Math.abs(angle(now, toward(T0 + ms)) - wanted));
        worst = Math.max(worst, angle(before, now));
        companionStep = Math.max(companionStep, angle(toward(T0 + ms - step), toward(T0 + ms)));
        before = now;
        steps += 1;
      }
      assert.ok(drift < 1e-9, `${focus} with ${companion}, ${mode}: the companion moved ${drift} radians from its place`);
      // no step is more than the companion's own step round the body (a little over, for the way the direction to it bends)
      assert.ok(worst < companionStep * 1.05 + 1e-6, `${focus} with ${companion}, ${mode}: a jump of ${(worst / RAD).toFixed(1)} degrees in ${steps} steps, the companion's own step ${(companionStep / RAD).toFixed(1)}`);
    }
  }
});

test("a pair's axis is the same all the way round the orbit, a moon of Uranus (over the poles) included", () => {
  for (const [focus, companion] of [["oberon", "uranus"], ["moon", "earth"], ["mercury", "sun"]] as [BodyId, BodyId][]) {
    const toward = (ms: number): Vec3 => directionBetween(focus, companion, "compressed", ms);
    const first = pairAxis(toward, T0);
    const step = focus === "oberon" ? 5 * DAY : focus === "moon" ? 2 * DAY : 10 * DAY;
    for (let ms = 0; ms <= (focus === "mercury" ? 365 : 60) * DAY; ms += step) assert.ok(angle(pairAxis(toward, T0 + ms), first) < 0.2, `${focus}: the axis turned ${(angle(pairAxis(toward, T0 + ms), first) / RAD).toFixed(1)} degrees`);
  }
});

test("the stars' frame is no frame: with the same basis at both moments a direction is carried to itself", () => {
  const basis = bodyBasis("mars", T0)!;
  const aim = unit([0.1, 0.9, -0.4]);
  const same = carry(aim, basis, basis);
  assert.ok(angle(same, aim) < 1e-12);
});

test("a camera on the far side of the body from its companion is moved to one side as little as it takes to keep the companion in sight, and continuously", () => {
  const toward: Vec3 = [1, 0, 0];
  const least = 15 * RAD;
  // clear already: left alone
  const clear = unit([-Math.cos(40 * RAD), Math.sin(40 * RAD), 0]);
  assert.ok(angle(keepClear(clear, toward, least), clear) < 1e-12);
  // exactly behind: moved to the least angle
  assert.ok(Math.abs(angle(keepClear([-1, 0, 0], toward, least), [-1, 0, 0]) - least) < 1e-9);
  // swept across the far side: never nearer than the least, and in steps no larger than a little over the sweep's own
  let before: Vec3 | null = null;
  for (let a = -40; a <= 40; a += 0.5) {
    // the sweep leans to one side (z), so it never goes through the exact middle of the far side, where the nearest way out is not one but every way
    const aim: Vec3 = [-Math.cos(a * RAD), Math.sin(a * RAD), 0.15];
    const kept = keepClear(aim, toward, least);
    assert.ok(angle(kept, unit([-1, 0, 0])) >= least - 1e-9, `at ${a}`);
    if (before !== null) assert.ok(angle(before, kept) < 2 * RAD, `a jump at ${a}: ${(angle(before, kept) / RAD).toFixed(2)} degrees`);
    before = kept;
  }
  assert.ok(Math.abs(length(keepClear(scale([-1, 0.0001, 0], 5), toward, least)) - 1) < 1e-12);
});

// ---- the whole camera: what is in the picture stays where it is in it ------------------------------------------------------------------------------------------------------------------------------

/** Where a point is in the picture of a camera that looks at `focus` from `aim` with `up` up, as tangents of the angles across and up. */
function screenOf(point: Vec3, focus: Vec3, aim: Vec3, distance: number, up: Vec3): [number, number] {
  const position: Vec3 = [focus[0] + aim[0] * distance, focus[1] + aim[1] * distance, focus[2] + aim[2] * distance];
  const forward = unit(sub(focus, position));
  const right = unit(cross(forward, up));
  const upward = cross(right, forward);
  const v = sub(point, position);
  const z = dot(v, forward);
  return [dot(v, right) / z, dot(v, upward) / z];
}

test("held to a pair the companion stays at the same place in the picture for thirty days, picture's up carried with the look direction (the Sun behind Mercury, the Earth behind the Moon), where fixed to the stars it goes right round", () => {
  for (const [focus, companion] of [["mercury", "sun"], ["moon", "earth"]] as [BodyId, BodyId][]) {
    for (const frame of ["pair", "stars"] as const) {
      const model = newSpaceModel();
      model.mode = "true";
      model.frame = frame;
      model.companion = companion;
      model.anchor = T0;
      model.time = T0;
      const first = holdSite(focus, "true", T0);
      const away = unit(sub(first.at, holdSite(companion, "true", T0).at));
      // the camera on the far side of the body from the companion, turned a little to one side: the companion at the back left or right
      const base = unit([away[0] + 0.3 * away[2], away[1], away[2] - 0.3 * away[0]]);
      let start: [number, number] | null = null;
      let worst = 0;
      for (let day = 0; day <= 30; day += 1) {
        model.time = T0 + day * DAY;
        const here = holdSite(focus, "true", model.time).at;
        const there = holdSite(companion, "true", model.time).at;
        const held = heldAim(model, focus, base, [0, 1, 0], "true", (id) => holdSite(id, "true", model.time).at, 0);
        const at = screenOf(there, here, held.aim, 4.1 * first.radius, held.up);
        start ??= at;
        worst = Math.max(worst, Math.hypot(at[0] - start[0], at[1] - start[1]));
      }
      // a picture 900 pixels high across 35 degrees: a tangent of 0.63 is 900 pixels
      if (frame === "pair") assert.ok((worst * 900) / 0.63 < 2, `${focus} with ${companion}: the companion moved ${((worst * 900) / 0.63).toFixed(2)} px`);
      else assert.ok(worst > 1, `${focus}: fixed to the stars the companion goes round`);
    }
  }
});

test("held to a body, a place on its ground stays at the same place in the picture as it spins for a day (Mars, Ceres, Io), where fixed to the stars the ground goes round", () => {
  for (const id of ["mars", "ceres", "io"] as BodyId[]) {
    for (const frame of ["body", "stars"] as const) {
      const model = newSpaceModel();
      model.mode = "true";
      model.frame = frame;
      model.anchor = T0;
      model.time = T0;
      const site = holdSite(id, "true", T0);
      const base = unit([0.3, 0.2, 0.93]);
      const from = bodyBasis(id, T0)!;
      // a point on the ground: where the camera's own line of sight meets it, and one a quarter of a radius to the side
      const ground = (to: ReturnType<typeof bodyBasis> & object, dir: Vec3): Vec3 => [to.a[0] * dir[0] + to.b[0] * dir[1] + to.c[0] * dir[2], to.a[1] * dir[0] + to.b[1] * dir[1] + to.c[1] * dir[2], to.a[2] * dir[0] + to.b[2] * dir[1] + to.c[2] * dir[2]];
      const local: Vec3 = unit([dot(base, from.a) + 0.25, dot(base, from.b) + 0.1, dot(base, from.c)]);
      let start: [number, number] | null = null;
      let worst = 0;
      for (let hour = 0; hour <= 24; hour += 1) {
        model.time = T0 + hour * 3_600_000;
        const now = bodyBasis(id, model.time)!;
        const held = heldAim(model, id, base, [0, 1, 0], "true", (name) => holdSite(name, "true", model.time).at, 0);
        const surface = ground(now, local);
        const point: Vec3 = [site.at[0] + surface[0] * site.radius, site.at[1] + surface[1] * site.radius, site.at[2] + surface[2] * site.radius];
        const at = screenOf(point, site.at, held.aim, 4.1 * site.radius, held.up);
        start ??= at;
        worst = Math.max(worst, Math.hypot(at[0] - start[0], at[1] - start[1]));
      }
      if (frame === "body") assert.ok((worst * 900) / 0.63 < 2, `${id}: the ground moved ${((worst * 900) / 0.63).toFixed(2)} px`);
      else assert.ok(worst > 0.05, `${id}: fixed to the stars the ground goes round`);
    }
  }
});

test("a body with no known rotation, and a pair with no companion, are held to the stars and the draw says so", () => {
  const model = newSpaceModel();
  model.frame = "body";
  model.anchor = T0;
  model.time = T0 + DAY;
  const aim = unit([0.2, 0.4, 0.8]);
  const held = heldAim(model, "halley", aim, [0, 1, 0], "true", (id) => holdSite(id, "true", model.time).at, 0);
  assert.deepEqual(held.aim, aim);
  assert.deepEqual(model.frameDrawn, { asked: "body", drawn: "stars", pair: null });
  model.frame = "pair";
  model.companion = null;
  heldAim(model, "mercury", aim, [0, 1, 0], "true", (id) => holdSite(id, "true", model.time).at, 0);
  assert.deepEqual(model.frameDrawn, { asked: "pair", drawn: "stars", pair: null });
  model.pairWith = "sun";
  heldAim(model, "mercury", aim, [0, 1, 0], "true", (id) => holdSite(id, "true", model.time).at, 0);
  assert.deepEqual(model.frameDrawn, { asked: "pair", drawn: "pair", pair: "sun" });
});

test("the controls' yaw and tilt that give a direction are the ones that turn into it, whatever the moment and the centre", () => {
  for (const ms of [T0, T0 + 3 * DAY, T0 + 200 * DAY]) {
    for (const centre of [{ lon: 0, lat: 0 }, { lon: -75, lat: 40 }, { lon: 160, lat: -30 }]) {
      for (const [yaw, tilt] of [[0, 0], [30, 10], [-120, 45], [170, -60]]) {
        const aim = groundDirection(centre.lon - yaw, centre.lat - tilt, ms);
        const back = controlsFor(aim, centre, ms);
        assert.ok(angle(groundDirection(centre.lon - back.yaw, centre.lat - back.tilt, ms), aim) < 1e-9, `${ms} ${JSON.stringify(centre)} ${yaw} ${tilt}`);
      }
    }
  }
});
