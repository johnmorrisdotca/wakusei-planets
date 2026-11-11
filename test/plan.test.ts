// The top-down plan: the solar system from above and one planet's moons from above its pole. Positions are the package's own; the spacing, the marks, the edge and the SVG are checked here.
import assert from "node:assert/strict";
import { test } from "node:test";
import { heliocentric, MOONS_OF, PLANET_IDS, type MoonId } from "../src/index.ts";
import { PLAN_AU_KM, PLAN_SYSTEMS, planAt, planName, planRadius, planSunExtent, planSvg, planText, type Plan, type PlanDot } from "../src/plan/index.ts";

const T = Date.UTC(2026, 10, 11, 12);
const dotOf = (plan: Plan, id: string): PlanDot => {
  const found = plan.dots.find((dot) => dot.id === id);
  assert.ok(found, `${id} is on the plan`);
  return found;
};
const angle = (dot: PlanDot): number => (Math.atan2(dot.y, dot.x) * 180) / Math.PI;
const turn = (from: number, to: number): number => ((to - from + 540) % 360) - 180;

test("planRadius: squeezed runs from the middle to the edge and rises with distance; true is a straight proportion", () => {
  assert.equal(planRadius(0, 50, "squeezed", 0.1), 0);
  assert.ok(Math.abs(planRadius(50, 50, "squeezed", 0.1) - 1) < 1e-12);
  assert.ok(Math.abs(planRadius(25, 50, "true", 0.1) - 0.5) < 1e-12);
  let last = -1;
  for (const d of [0.1, 0.4, 1, 5, 20, 49]) {
    const r = planRadius(d, 50, "squeezed", 0.1);
    assert.ok(r > last && r < 1, `${d} au`);
    last = r;
  }
  assert.ok(planRadius(30, 50, "squeezed", 0.1) > 0.9, "Neptune is out near the edge");
  assert.ok(planRadius(0.39, 50, "squeezed", 0.1) > 0.2, "Mercury is a quarter of the way out, not on the Sun");
});

test("planSunExtent steps through 50, 100, 200, 500, 1000 and 2000 au", () => {
  assert.deepEqual([30, 50, 50.1, 83, 170, 400, 900, 1500, 9000].map(planSunExtent), [50, 50, 100, 100, 200, 500, 1000, 2000, 2000]);
});

test("the solar system from above: nine planets and the Sun at the middle, each at its own heliocentric place for the time", () => {
  const plan = planAt(T, { spacing: "true" });
  assert.equal(plan.system, "sun");
  assert.equal(plan.unit, "au");
  assert.equal(plan.extent, 50);
  assert.equal(plan.centre.id, "sun");
  assert.deepEqual(plan.dots.map((dot) => dot.id).sort(), [...PLANET_IDS].sort());
  for (const id of PLANET_IDS) {
    const dot = dotOf(plan, id);
    const [x, y] = heliocentric(id, T);
    assert.ok(Math.abs(dot.x * plan.extent - x) < 1e-9 && Math.abs(dot.y * plan.extent - y) < 1e-9, `${id} is where heliocentric puts it`);
    assert.ok(Math.abs(dot.distance - Math.hypot(x, y)) < 1e-9);
  }
  // from above the north pole the planets go anticlockwise: a day later the Earth's longitude is larger by about a degree
  const later = planAt(T + 86_400_000, { spacing: "true" });
  const step = turn(angle(dotOf(plan, "earth")), angle(dotOf(later, "earth")));
  assert.ok(step > 0.9 && step < 1.1, `${step.toFixed(3)} degrees a day`);
  // the Earth in November is near heliocentric longitude 49 degrees
  assert.ok(Math.abs(angle(dotOf(plan, "earth")) - 49) < 2);
});

test("squeezed spacing spreads the inner planets and keeps every planet inside the edge; true spacing crowds them", () => {
  const squeezed = planAt(T);
  const real = planAt(T, { spacing: "true" });
  const radius = (plan: Plan, id: string): number => Math.hypot(dotOf(plan, id).x, dotOf(plan, id).y);
  for (const id of PLANET_IDS) assert.ok(radius(squeezed, id) < 1 && !dotOf(squeezed, id).beyond, id);
  assert.ok(radius(squeezed, "mercury") > 5 * radius(real, "mercury"));
  assert.ok(radius(real, "mercury") < 0.01, "to scale Mercury is under one percent of the way out");
  const order = PLANET_IDS.map((id) => radius(squeezed, id));
  // Pluto is nearer the Sun than Neptune at this date, so the order by distance, not by name, must hold
  const byDistance = [...PLANET_IDS].sort((a, b) => dotOf(squeezed, a).distance - dotOf(squeezed, b).distance);
  assert.deepEqual([...PLANET_IDS].sort((a, b) => radius(squeezed, a) - radius(squeezed, b)), byDistance);
  assert.ok(order.every((r) => r > 0));
});

test("the orbit lines pass through the dots, and the marked body's line is the marked one", () => {
  const plan = planAt(T, { mark: "mars" });
  for (const id of PLANET_IDS) {
    const orbit = plan.orbits.find((one) => one.id === id)!;
    const dot = dotOf(plan, id);
    const gap = Math.min(...orbit.points.map((p) => Math.hypot(p[0] - dot.x, p[1] - dot.y)));
    assert.ok(gap < 0.06, `${id}'s line is ${gap.toFixed(3)} from its dot`);
    assert.equal(orbit.marked, id === "mars");
  }
  assert.equal(plan.marked, "mars");
  assert.equal(plan.dots.filter((dot) => dot.marked).length, 1);
  assert.equal(plan.dots[plan.dots.length - 1]!.id, "mars", "the marked dot is drawn last, on top");
});

test("a mark that is a moon marks its planet in the solar system; the Sun can be marked; an unknown name marks nothing", () => {
  assert.equal(planAt(T, { mark: "io" }).marked, "jupiter");
  assert.equal(planAt(T, { mark: "moon" }).marked, "earth");
  const sun = planAt(T, { mark: "sun" });
  assert.equal(sun.marked, "sun");
  assert.equal(sun.centre.marked, true);
  const none = planAt(T, { mark: "no-such-body" });
  assert.equal(none.marked, undefined);
  assert.ok(none.dots.every((dot) => !dot.marked));
});

test("a dwarf planet, a comet or a craft that is marked joins the plan, and the edge steps out to hold it", () => {
  const ceres = planAt(T, { mark: "ceres" });
  assert.equal(ceres.extent, 50);
  assert.equal(dotOf(ceres, "ceres").kind, "dwarf-planet");
  assert.ok(ceres.orbits.some((one) => one.id === "ceres" && one.marked));
  const halley = planAt(T, { mark: "halley" });
  assert.equal(dotOf(halley, "halley").kind, "comet");
  assert.equal(planAt(T, { mark: "sedna" }).extent, 100, "Sedna is about 80 au out");
  const probe = planAt(T, { mark: "voyager1", extras: [{ id: "voyager1", au: [-40, -150, 90] }] });
  assert.equal(probe.extent, 200);
  assert.equal(dotOf(probe, "voyager1").kind, "spacecraft");
  assert.equal(dotOf(probe, "voyager1").marked, true);
  // the same craft at 2,500 au is held on the edge of the widest plan, and says so
  const far = dotOf(planAt(T, { extras: [{ id: "far", au: [2500, 0, 0] }] }), "far");
  assert.equal(far.beyond, true);
  assert.ok(Math.abs(Math.hypot(far.x, far.y) - 1) < 1e-9);
  assert.ok(PLAN_AU_KM > 1.49e8);
});

test("one planet's moons from above its north pole: every moon, nearest first by orbit, each inside the edge", () => {
  for (const host of PLAN_SYSTEMS.filter((system) => system !== "sun")) {
    const plan = planAt(T, { system: host });
    const ids: readonly MoonId[] = MOONS_OF[host as keyof typeof MOONS_OF];
    assert.equal(plan.system, host);
    assert.equal(plan.unit, "radii");
    assert.equal(plan.centre.id, host);
    assert.deepEqual(plan.dots.map((dot) => dot.id).sort(), [...ids].sort(), host);
    for (const dot of plan.dots) assert.ok(!dot.beyond && Math.hypot(dot.x, dot.y) <= 1, `${dot.id} is inside the edge`);
    for (const orbit of plan.orbits) assert.ok(orbit.points.length > 50, `${orbit.id} has an orbit line`);
  }
});

test("Jupiter's moons: Io, Europa, Ganymede and Callisto at their real distances in planet radii, Io marked", () => {
  const plan = planAt(T, { system: "jupiter", mark: "io", spacing: "true" });
  const distance = (id: string): number => dotOf(plan, id).distance;
  assert.ok(Math.abs(distance("io") - 5.9) < 0.3, `Io ${distance("io").toFixed(2)}`);
  assert.ok(Math.abs(distance("europa") - 9.4) < 0.4);
  assert.ok(Math.abs(distance("ganymede") - 15.0) < 0.5);
  assert.ok(Math.abs(distance("callisto") - 26.3) < 0.8);
  assert.equal(plan.marked, "io");
  assert.ok(plan.extent > distance("callisto"));
  assert.ok(Math.abs(Math.hypot(dotOf(plan, "io").x, dotOf(plan, "io").y) * plan.extent - distance("io")) < 1e-9, "true spacing is a straight proportion");
  assert.ok(plan.orbits.find((one) => one.id === "io")!.marked);
  const squeezed = planAt(T, { system: "jupiter" });
  assert.ok(Math.hypot(dotOf(squeezed, "io").x, dotOf(squeezed, "io").y) > 2 * Math.hypot(dotOf(plan, "io").x, dotOf(plan, "io").y), "squeezing lifts the inner moon off the planet");
});

test("from above the north pole a moon that goes the planet's way is seen anticlockwise and a backward one clockwise", () => {
  const hour = 3_600_000;
  const swing = (host: "jupiter" | "neptune", id: string): number => {
    const a = dotOf(planAt(T, { system: host, spacing: "true" }), id);
    const b = dotOf(planAt(T + hour, { system: host, spacing: "true" }), id);
    return turn(angle(a), angle(b));
  };
  const io = swing("jupiter", "io");
  assert.ok(io > 7 && io < 10, `Io turns ${io.toFixed(2)} degrees in an hour, anticlockwise`);
  const triton = swing("neptune", "triton");
  assert.ok(triton < -1.5 && triton > -3.5, `Triton turns ${triton.toFixed(2)} degrees in an hour, clockwise`);
});

test("the Earth's moon is about 60 Earth radii away and goes anticlockwise", () => {
  const plan = planAt(T, { system: "earth", mark: "moon", spacing: "true" });
  const moon = dotOf(plan, "moon");
  assert.ok(moon.distance > 55 && moon.distance < 64.5, `${moon.distance.toFixed(1)}`);
  assert.equal(moon.marked, true);
  const later = dotOf(planAt(T + 3_600_000, { system: "earth", spacing: "true" }), "moon");
  assert.ok(turn(angle(moon), angle(later)) > 0.4);
});

test("in a moon system the planet can be marked; a moon of another planet marks nothing", () => {
  const host = planAt(T, { system: "saturn", mark: "saturn" });
  assert.equal(host.marked, "saturn");
  assert.equal(host.centre.marked, true);
  assert.equal(planAt(T, { system: "saturn", mark: "io" }).marked, undefined);
  assert.equal(planAt(T, { system: "saturn", mark: "titan" }).marked, "titan");
});

test("the plan is the same for the same inputs, and changes with the time", () => {
  assert.deepEqual(planAt(T, { mark: "mars" }), planAt(T, { mark: "mars" }));
  const later = planAt(T + 30 * 86_400_000, { mark: "mars" });
  assert.notDeepEqual(dotOf(later, "mars"), dotOf(planAt(T, { mark: "mars" }), "mars"));
  assert.notEqual(planAt(T, { system: "jupiter" }).dots[0]!.x, planAt(T + 3_600_000, { system: "jupiter" }).dots[0]!.x);
});

test("planSvg draws the solar system: a dot for every planet and the Sun, the marked one named and ringed, the scale said", () => {
  const plan = planAt(T, { mark: "mars" });
  const svg = planSvg(plan, { size: 240 });
  assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"));
  assert.ok(!svg.includes("NaN") && !svg.includes("undefined"));
  for (const id of ["sun", ...PLANET_IDS]) assert.ok(svg.includes(`data-id="${id}"`), id);
  assert.match(svg, /data-id="mars"[^>]*data-marked=""/);
  assert.ok(svg.includes(">Mars</text>"));
  assert.ok(svg.includes("Squeezed (log) to 50 au"));
  assert.ok(svg.includes('aria-label="The solar system from above, Mars marked"'));
  assert.equal((svg.match(/class="ring"/g) ?? []).length, 1, "one ring, on the marked body");
  assert.equal((svg.match(/class="om"/g) ?? []).length, 1, "one marked orbit");
  assert.ok(svg.includes("light-dark("), "the colours follow light and dark");
  assert.equal(planSvg(plan, { size: 240 }), svg, "the same plan draws the same SVG");
  assert.ok(planSvg(plan, { size: 200 }).includes('viewBox="0 0 200 200"'));
  assert.ok(planSvg(plan, { size: 10 }).includes('viewBox="0 0 120 120"'), "never smaller than 120");
});

test("names: Japanese on request, none but the marked one's when off, and no two names overlap", () => {
  const plan = planAt(T, { mark: "earth" });
  const ja = planSvg(plan, { size: 240, lang: "ja" });
  assert.ok(ja.includes(">地球</text>"));
  assert.ok(ja.includes("対数で圧縮、縁は50 au"));
  assert.ok(ja.includes('aria-label="真上から見た太陽系(地球に印)"'));
  const quiet = planSvg(plan, { size: 240, names: false });
  assert.equal((quiet.match(/<text class="t/g) ?? []).length, 1, "only the marked body is named");
  assert.ok(quiet.includes(">Earth</text>"));
  const full = planSvg(plan, { size: 200 });
  const boxes = [...full.matchAll(/<text class="t[^"]*" x="([\d.]+)" y="([\d.]+)">([^<]+)<\/text>/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) - 10, w: m[3]!.length * 5.6, h: 12 }));
  assert.ok(boxes.length >= 3 && boxes.length <= 10);
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    const a = boxes[i]!;
    const b = boxes[j]!;
    assert.ok(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h, `names ${i} and ${j} overlap`);
  }
});

test("planSvg draws a moon system and a craft; true spacing says so", () => {
  const svg = planSvg(planAt(T, { system: "jupiter", mark: "io", spacing: "true" }), { size: 260 });
  for (const id of ["jupiter", "io", "europa", "ganymede", "callisto"]) assert.ok(svg.includes(`data-id="${id}"`), id);
  assert.ok(svg.includes("True scale to 29 Jupiter radii"));
  assert.ok(svg.includes("Jupiter's moons from above its north pole, Io marked"));
  const craft = planSvg(planAt(T, { extras: [{ id: "voyager1", au: [-40, -150, 90] }], mark: "voyager1" }), { size: 240 });
  assert.ok(craft.includes('data-id="voyager1"') && craft.includes(">Voyager 1</text>") && craft.includes("200 au"));
  const ja = planText(planAt(T, { system: "jupiter", mark: "io" }), "ja");
  assert.equal(ja.label, "木星の北極の真上から見た衛星(イオに印)");
  assert.equal(planName("io", "ja"), "イオ");
  assert.equal(planName("not-a-body"), "not-a-body");
});

test("every mark and system gives a drawable plan with no gaps in the numbers", () => {
  for (const system of PLAN_SYSTEMS) {
    const plan = planAt(T, { system });
    for (const dot of [plan.centre, ...plan.dots]) assert.ok(Number.isFinite(dot.x) && Number.isFinite(dot.y), `${system}: ${dot.id}`);
    for (const orbit of plan.orbits) for (const p of orbit.points) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${system}: ${orbit.id}`);
    assert.ok(!planSvg(plan).includes("NaN"), system);
  }
});
