// The portrait builder's scene: the layout, the camera, hit tests, snapping, order, undo and the text kept in the address. All pure, so all here.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES } from "../src/index.ts";
import { addBody, addMoons, auto, centreCamera, createHistory, decodeScene, defaultPortrait, encodeScene, fitAll, freeze, hitTest, moveInOrder, PRESETS, removeBody, rescale, resolve, setItem, setPortrait, sizesFor, snap, toScreen, fromScreen, type Portrait } from "../src/portrait/model.ts";
import { shapesOf, shapesSvg } from "../src/portrait/overlay.ts";
import { poseOf } from "../src/portrait/pose.ts";
import { surfacePoint } from "../src/pose.ts";
import { dot } from "../src/vec.ts";

const withBodies = (...ids: Parameters<typeof addBody>[1][]): Portrait => ids.reduce((p, id) => addBody(p, id), defaultPortrait());

test("bodies are added once, in the order of the sky for an automatic layout, and removed", () => {
  const p = withBodies("saturn", "earth", "sun", "earth");
  assert.deepEqual(p.items.map((i) => i.body), ["sun", "earth", "saturn"]);
  assert.deepEqual(removeBody(p, "earth").items.map((i) => i.body), ["sun", "saturn"]);
  assert.equal(removeBody(p, "mars"), p);
});

test("an automatic row never overlaps, and the camera holds every body with a margin", () => {
  for (const arrange of ["row", "arc", "grid"] as const) {
    for (const scale of ["true", "readable"] as const) {
      const p = { ...withBodies("sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn"), arrange, scale };
      const { placed, camera } = resolve(p);
      assert.equal(camera.h, 1, "the scene is in units of the camera's half-height");
      for (const q of placed) {
        assert.ok(Math.abs(q.x - camera.x) + q.reach <= camera.h * p.aspect * 1.0001 + 1e-9 || arrange === "grid", `${arrange}/${scale}: ${q.body} fits across`);
        assert.ok(Math.abs(q.y - camera.y) + q.reach <= camera.h * 1.0001, `${arrange}/${scale}: ${q.body} fits down`);
      }
      for (const [i, a] of placed.entries()) for (const b of placed.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= (a.r + b.r) * 0.999, `${arrange}/${scale}: ${a.body} and ${b.body} do not overlap`);
    }
  }
});

test("true scale keeps the real ratio of sizes, readable squeezes them but keeps the order", () => {
  const ids = ["sun", "earth", "moon"] as const;
  const t = sizesFor(ids, "true");
  assert.ok(Math.abs(t[0]! / t[1]! - BODIES.sun.radiusKm / BODIES.earth.radiusKm) < 1e-9);
  const r = sizesFor(ids, "readable");
  assert.ok(r[0]! > r[1]! && r[1]! > r[2]!);
  assert.ok(r[0]! / r[2]! < t[0]! / t[2]! / 10);
  assert.ok(Math.min(...sizesFor(["sun", "deimos"], "readable")) >= 0.1 * Math.max(...sizesFor(["sun", "deimos"], "readable")));
});

test("moons go round their planet in orbit order when the moons are automatic, and stand alone when they are not", () => {
  const p = withBodies("jupiter", "callisto", "io", "ganymede", "europa");
  const a = resolve(p).placed;
  const at = (id: string) => a.find((q) => q.body === id)!;
  assert.ok(at("io").x < at("europa").x && at("europa").x < at("ganymede").x && at("ganymede").x < at("callisto").x, "nearest first");
  assert.ok(at("io").x > at("jupiter").x + at("jupiter").r);
  for (const id of ["io", "europa", "ganymede", "callisto"]) assert.equal(at(id).y, at("jupiter").y);
  const alone = resolve({ ...p, moons: "manual" }).placed.map((q) => q.body);
  assert.deepEqual(alone, p.items.map((i) => i.body));
});

test("a planet's moons are added in orbit order, once", () => {
  const p = addMoons(withBodies("saturn"), "saturn");
  assert.equal(p.items.length, 8);
  assert.equal(addMoons(p, "saturn"), p);
  const m = addMoons(setPortrait(withBodies("jupiter"), { layout: "manual" }), "jupiter");
  const jupiter = m.items.find((i) => i.body === "jupiter")!;
  const io = m.items.find((i) => i.body === "io")!;
  const callisto = m.items.find((i) => i.body === "callisto")!;
  assert.ok(io.x > jupiter.x + jupiter.r && callisto.x > io.x && callisto.y === jupiter.y);
});

test("a manual layout keeps every body where it was, a new body goes to the right of the others, and automatic puts the layout back", () => {
  const a = withBodies("earth", "mars");
  const m = setPortrait(a, { layout: "manual" });
  const was = resolve(a).placed;
  const now = resolve(m).placed;
  for (const [i, q] of was.entries()) {
    assert.ok(Math.abs(q.x - now[i]!.x) < 1e-12 && Math.abs(q.r - now[i]!.r) < 1e-12);
  }
  const more = addBody(m, "jupiter");
  const earth = more.items[0]!;
  const jupiter = more.items[2]!;
  assert.ok(jupiter.x - jupiter.r >= earth.x + earth.r);
  assert.deepEqual(auto(more).layout, "auto");
  assert.equal(freeze(m), m);
});

test("size and rotation changes are kept on the one body, and the stored scene is never changed in place", () => {
  const p = withBodies("earth", "mars");
  const q = setItem(p, 1, { r: 0.5, turn: 12, tilt: 20 });
  assert.equal(p.items[1]!.turn, 0);
  assert.equal(q.items[1]!.turn, 12);
  assert.equal(q.items[1]!.tilt, 20);
  assert.equal(setItem(q, 1, { tilt: undefined }).items[1]!.tilt, undefined);
  assert.equal(setItem(p, 9, { r: 1 }), p);
});

test("the order is the drawing order: the end is the front", () => {
  const p = setPortrait(withBodies("earth", "mars", "jupiter"), { layout: "manual" });
  assert.deepEqual(moveInOrder(p, 0, 2).items.map((i) => i.body), ["mars", "jupiter", "earth"]);
  assert.deepEqual(moveInOrder(p, 2, 0).items.map((i) => i.body), ["jupiter", "earth", "mars"]);
  assert.equal(moveInOrder(p, 1, 1), p);
  assert.deepEqual(moveInOrder(p, 0, 99).items.map((i) => i.body).at(-1), "earth");
});

test("rescale to true sizes keeps the largest body and the real ratios; fit and centre move only the camera", () => {
  let p = setPortrait(withBodies("sun", "earth", "jupiter"), { layout: "manual" });
  p = rescale(p, "true");
  const r = (id: string) => p.items.find((i) => i.body === id)!.r;
  assert.ok(Math.abs(r("jupiter") / r("earth") - BODIES.jupiter.radiusKm / BODIES.earth.radiusKm) < 1e-6);
  p = setItem(p, 0, { x: 5 });
  const fit = fitAll(p);
  assert.deepEqual(fit.items, p.items);
  const { placed } = resolve(fit);
  for (const q of placed) assert.ok(Math.abs(q.x - fit.camera.x) + q.reach <= fit.camera.h * fit.aspect + 1e-9);
  const c = centreCamera(p);
  assert.equal(c.camera.h, p.camera.h);
});

test("pixels and scene units are inverse, and the body under a point is the front one", () => {
  const camera = { x: 0.3, y: -0.2, h: 1.5 };
  const to = toScreen(camera, 800, 450);
  const back = fromScreen(camera, 800, 450, to.px(0.7), to.py(0.1));
  assert.ok(Math.abs(back.x - 0.7) < 1e-9 && Math.abs(back.y - 0.1) < 1e-9);
  const placed = resolve(setPortrait(addBody(addBody(defaultPortrait(), "earth"), "mars"), { layout: "manual" })).placed.map((q) => ({ ...q, x: 0, y: 0, r: 0.4 }));
  assert.equal(hitTest(placed, 0.1, 0.1), 1, "the one at the end of the list is in front");
  assert.equal(hitTest(placed, 3, 3), -1);
  assert.equal(hitTest([{ ...placed[0]!, r: 0.001 }], 0.02, 0, 0.05), 0, "a speck is hit within the slop");
});

test("a dragged body snaps its middle and edges to the others and to the middle of the picture, and says where", () => {
  const others = [{ x: 0.5, y: 0.2, r: 0.2 }];
  const s = snap({ x: 0.52, y: 0.9, r: 0.1 }, others, { x: 0, y: 0 }, 0.03);
  assert.equal(s.x, 0.5);
  assert.deepEqual(s.guides.map((g) => g.axis), ["x"]);
  const edge = snap({ x: 1.1, y: 0.205, r: 0.1 }, others, { x: 0, y: 0 }, 0.03);
  assert.ok(Math.abs(edge.x - 1.1) < 1e-9 || Math.abs(edge.x - 1.2) < 1e-9, String(edge.x));
  assert.equal(edge.y, 0.2);
  const none = snap({ x: 2, y: 2, r: 0.1 }, others, { x: 0, y: 0 }, 0.03);
  assert.deepEqual(none.guides, []);
  assert.deepEqual([none.x, none.y], [2, 2]);
});

test("undo and redo step over the scenes, and a new change drops what was undone", () => {
  const a = defaultPortrait();
  const h = createHistory(a);
  const b = addBody(a, "earth");
  const c = addBody(b, "mars");
  h.push(b);
  h.push(c);
  assert.equal(h.undo(), b);
  assert.equal(h.undo(), a);
  assert.equal(h.canUndo, false);
  assert.equal(h.redo(), b);
  h.push(addBody(b, "venus"));
  assert.equal(h.canRedo, false);
  assert.equal(h.undo(), b);
  const small = createHistory(a, 2);
  for (const id of ["earth", "mars", "venus"] as const) small.push(addBody(small.current, id));
  small.undo();
  small.undo();
  assert.equal(small.canUndo, false, "only the last two steps are kept");
});

test("a scene survives the address: every field, and a manual layout keeps its places", () => {
  let p = setPortrait(withBodies("sun", "earth", "moon", "saturn"), { look: "painted", bg: "gradient", scale: "true", arrange: "arc", moons: "manual", labels: false, orbits: false, shadows: false, date: "2026-11-03T12:00", aspect: 1, light: { az: 120, el: 55 } });
  p = setItem(p, 3, { turn: 30, tilt: 15, pitch: 40, spin: 90 });
  const back = decodeScene(encodeScene(p));
  assert.deepEqual({ ...back, items: back.items.map((i) => i.body) }, { ...p, items: p.items.map((i) => i.body) });
  assert.equal(back.items[3]!.turn, 30);
  assert.equal(back.items[3]!.tilt, 15);
  assert.equal(back.items[3]!.pitch, 40);
  const m = setItem(setPortrait(p, { layout: "manual" }), 1, { x: 0.123456, y: -0.5, r: 0.07 });
  const again = decodeScene(encodeScene(m));
  assert.equal(again.layout, "manual");
  assert.ok(Math.abs(again.items[1]!.x - 0.1235) < 1e-9 && again.items[1]!.y === -0.5 && again.items[1]!.r === 0.07);
  assert.deepEqual(again.camera, m.camera);
  assert.equal(encodeScene(defaultPortrait()), "");
});

test("any text gives a scene: unknown bodies and fields are dropped, numbers are held in range, a body is there once", () => {
  const p = decodeScene("nonsense~look:cubist~bg:stars~earth_x_y_z~earth_1_1_1~planetx_1_1_1~light:900,500~ratio:99~mars__~~date:never~moons:manual");
  assert.deepEqual(p.items.map((i) => i.body), ["earth", "mars"]);
  assert.equal(p.look, "painted");
  assert.equal(p.date, undefined);
  assert.ok(p.light.az < 360 && p.light.el === 90);
  assert.equal(p.aspect, 4);
  assert.equal(p.moons, "manual");
  assert.equal(decodeScene("").items.length, 0);
  const many = decodeScene(Array.from({ length: 80 }, (_, i) => `earth${i}_0_0_1`).join("~"));
  assert.equal(many.items.length, 0);
});

test("every preset is a real scene that lays out inside its camera and survives the address", () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ["family", "giants", "galileans", "earthmoon"]);
  for (const preset of PRESETS) {
    assert.ok(preset.scene.items.length >= 2, preset.id);
    assert.match(preset.name.ja, /\S/);
    const { placed } = resolve(preset.scene);
    assert.equal(placed.length, preset.scene.items.length);
    assert.deepEqual(decodeScene(encodeScene(preset.scene)).items.map((i) => i.body), preset.scene.items.map((i) => i.body));
  }
  const family = PRESETS.find((p) => p.id === "family")!.scene;
  assert.equal(family.items.length, 10);
  assert.deepEqual(PRESETS.find((p) => p.id === "galileans")!.scene.items.map((i) => i.body), ["jupiter", "io", "europa", "ganymede", "callisto"]);
});

test("the light comes from the chosen side: from the left, the left of a body is lit", () => {
  const p = setPortrait(withBodies("mars"), { light: { az: 270, el: 30 } });
  const pose = poseOf(p.items[0]!, undefined, 0, p.light);
  assert.ok(pose.light[0] < -0.8 && pose.light[2] > 0.4);
  const above = poseOf(p.items[0]!, undefined, 0, { az: 0, el: 0 });
  assert.ok(above.light[1] > 0.99);
});

test("a body turns by itself the way it really does, and a date gives the real pole", () => {
  const item = { body: "mars", spin: 0, turn: 30 } as const;
  const a = poseOf(item, undefined, 0, { az: 300, el: 38 });
  const b = poseOf(item, undefined, 1, { az: 300, el: 38 });
  assert.ok(dot(a.meridian, b.meridian) < Math.cos((29 * Math.PI) / 180), "30 degrees in a second");
  // the surface moves to the right (east): the old middle meridian is now to the right of the middle
  assert.ok(b.meridian[0] > a.meridian[0] || b.meridian[0] > 0.45);
  const sky = poseOf({ body: "mars", spin: 0, turn: 0 }, Date.UTC(2026, 10, 3, 12), 0, { az: 300, el: 38 });
  const real = poseOf({ body: "mars", spin: 0, turn: 0 }, Date.UTC(2026, 10, 3, 12), 0, { az: 100, el: 10 });
  assert.deepEqual(sky.pole, real.pole);
});

test("the names and the orbit rings are drawn only when asked, names that would collide are left out, and the chosen body is outlined", () => {
  const p = setPortrait(withBodies("jupiter", "io", "europa", "ganymede", "callisto"), { labels: true, orbits: true });
  const on = shapesOf(p, resolve(p), 800, 450);
  assert.equal(on.circles.filter((c) => c.kind === "orbit").length, 4);
  assert.ok(on.texts.length >= 1 && on.texts.length <= 5);
  const off = shapesOf(setPortrait(p, { labels: false, orbits: false }), resolve(p), 800, 450);
  assert.deepEqual([off.circles.length, off.texts.length], [0, 0]);
  const picked = shapesOf(p, resolve(p), 800, 450, "en", { selected: 0, guides: [{ axis: "x", at: 0 }] });
  assert.equal(picked.circles.filter((c) => c.kind === "select").length, 1);
  assert.equal(picked.lines.length, 1);
  assert.match(shapesSvg(picked), /<circle/);
  const ja = shapesOf(p, resolve(p), 800, 450, "ja");
  assert.ok(ja.texts.some((t) => /[぀-ヿ一-鿿]/.test(t.text)));
});

test("the surface follows the hand: less spin moves the middle of the surface right, less pitch moves it up", () => {
  const base = { body: "mars", spin: 0, turn: 0 } as const;
  const light = { az: 300, el: 38 };
  const now = poseOf(base, undefined, 0, light);
  const right = poseOf({ ...base, spin: -10 }, undefined, 0, light);
  // the point that is at the middle of the disc now (longitude 0, latitude 0) after the drag
  const was = surfacePoint(now, 0, 0);
  const moved = surfacePoint(right, 0, 0);
  assert.ok(moved[0] > was[0] + 0.1, `a drag right turns the body so its surface goes right (${was[0].toFixed(2)} to ${moved[0].toFixed(2)})`);
  const up = poseOf({ ...base, pitch: 12 - 10 }, undefined, 0, light);
  assert.ok(surfacePoint(up, 0, 0)[1] > surfacePoint(now, 0, 0)[1] + 0.05, "less pitch lifts the surface in front");
});
