// The size line-up: the table of radii (every row cited, and every radius checked against the angular diameter and distance it comes from), the layout and the camera, and the words and labels.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES } from "../src/facts.ts";
import { LINEUP_SETS, LINEUP_STARS, lineupBodies, SUN_RADIUS_KM, type RadiusRow } from "../src/lineup/data.ts";
import { lineupKm, lineupLabels, lineupLabelsSvg, lineupText } from "../src/lineup/labels.ts";
import { lineupFocus, lineupProject, lineupView, lineupZoomFor, lineupZoomOf, placeLineup } from "../src/lineup/layout.ts";
import { starLook } from "../src/star.ts";

/** One astronomical unit in solar radii (149,597,870.7 km over the nominal 695,700 km). */
const AU = 149_597_870.7 / SUN_RADIUS_KM;

const row = (id: string): RadiusRow => LINEUP_STARS.find((one) => one.id === id)!;

test("the table holds the twelve stars asked for, smallest first, each cited with an ADS bibcode and the date it was read", () => {
  assert.deepEqual(
    LINEUP_STARS.map((one) => one.id),
    ["sun", "sirius-a", "vega", "arcturus", "aldebaran", "rigel", "antares", "betelgeuse", "vy-canis-majoris", "woh-g64", "uy-scuti", "stephenson-2-18"],
  );
  const sorted = [...LINEUP_STARS].sort((a, b) => a.radiusSun - b.radiusSun);
  assert.deepEqual(sorted.map((one) => one.id), LINEUP_STARS.map((one) => one.id), "ordered by radius");
  assert.equal(new Set(LINEUP_STARS.map((one) => one.id)).size, LINEUP_STARS.length);
  for (const one of LINEUP_STARS) {
    assert.ok(one.radiusSun > 0 && one.minus >= 0 && one.plus >= 0, one.id);
    assert.ok(one.name.en !== "" && one.name.ja !== "" && one.method.en !== "" && one.method.ja !== "" && one.cite !== "", one.id);
    assert.ok(one.bibcodes.length >= 1, one.id);
    // 19 characters: year, journal (5), volume (4), qualifier, page (4), first initial
    for (const code of one.bibcodes) assert.match(code, /^\d{4}[A-Za-z&.]{5}[\d.]{4}[A-Za-z.][\d.]{3}[\d.][A-Z]$/, `${one.id}: ${code}`);
    assert.match(one.read, /^2026-11-09$/, one.id);
    assert.ok(one.temperatureFrom !== "", one.id);
    assert.ok(one.look.temperatureK >= 3000 && one.look.temperatureK <= 13_000, one.id);
  }
});

test("a radius that is an angle times a distance is the same arithmetic as the paper's: the distance it implies is the one the paper adopted", () => {
  // the distances the papers adopt: Sirius A 2.639 pc (Bond et al. 2017: parallax 0.3789 arcsec), Vega 7.68 pc, Arcturus 11.28 pc, Aldebaran 19.96 pc, Rigel 264 pc, Antares 5.89 mas (169.8 pc),
  // Betelgeuse 222 pc (Harper et al. 2017), VY CMa 1.17 kpc (Wittkowski et al. 2012), UY Sct about 2.9 kpc (Arroyo-Torres et al. 2013). The radii are checked here against them and are not copied from them.
  const adopted: Record<string, number> = { "sirius-a": 2.639, vega: 7.68, arcturus: 11.28, aldebaran: 19.96, rigel: 264, antares: 169.8, betelgeuse: 222, "vy-canis-majoris": 1170, "uy-scuti": 2900 };
  for (const [id, parsecs] of Object.entries(adopted)) {
    const one = row(id);
    assert.ok(one.thetaMas !== undefined, id);
    const implied = one.radiusSun / ((one.thetaMas / 2) * 1e-3 * AU);
    assert.ok(Math.abs(implied / parsecs - 1) < 0.015, `${id}: the radius implies ${implied.toFixed(2)} pc, the paper adopts ${parsecs}`);
  }
  for (const one of LINEUP_STARS) if (one.thetaMas !== undefined && one.distancePc !== undefined) assert.ok(Math.abs(one.radiusSun / ((one.thetaMas / 2) * 1e-3 * one.distancePc * AU) - 1) < 0.015, `${one.id}: its own distance`);
});

test("the radii worked out here are worked out as the row says", () => {
  const betelgeuse = row("betelgeuse");
  const half = (betelgeuse.thetaMas! / 2) * 1e-3 * AU;
  assert.equal(betelgeuse.how, "worked-out");
  assert.ok(Math.abs(betelgeuse.radiusSun - half * betelgeuse.distancePc!) < 1, "half the angle times the distance");
  assert.ok(Math.abs(betelgeuse.plus - half * 48) < 2 && Math.abs(betelgeuse.minus - half * 34) < 2, "the error is the distance's");
  // Stephenson 2-18: log L = 5.64 and 3,200 K (Fok et al. 2012), the Stefan-Boltzmann law with the Sun's 5,772 K
  const stefan = Math.sqrt(10 ** 5.64) / (3200 / 5772) ** 2;
  assert.ok(Math.abs(row("stephenson-2-18").radiusSun - stefan) / stefan < 0.005, `${stefan}`);
  assert.equal(row("stephenson-2-18").basis, "luminosity");
  // Vega's flattening is the paper's two radii (2.726 equatorial, 2.418 polar)
  assert.ok(Math.abs(row("vega").look.oblateness! - (1 - 2.418 / 2.726)) < 0.001);
  assert.equal(row("sun").radiusSun, 1);
});

test("where the literature disagrees (Betelgeuse, UY Scuti, VY CMa, WOH G64, Stephenson 2-18) the row says so, in both languages, and no value from Gaia, Hipparcos or Tycho is copied", () => {
  for (const id of ["betelgeuse", "uy-scuti", "vy-canis-majoris", "woh-g64", "stephenson-2-18"]) {
    const one = row(id);
    assert.ok(one.note !== undefined && one.note.en.length > 40 && one.note.ja.length > 20, id);
  }
  assert.equal(row("uy-scuti").basis, "weak-distance");
  assert.ok(row("uy-scuti").others!.some((other) => other.radiusSun === 909), "the revised 909 is named and not used");
  assert.equal(row("woh-g64").basis, "luminosity");
  // a distance is stored only when it is a paper's own result; the catalogue parallaxes are not copied
  for (const id of ["vega", "arcturus", "aldebaran", "rigel", "antares"]) assert.equal(row(id).distancePc, undefined, id);
  const text = JSON.stringify(LINEUP_STARS);
  assert.doesNotMatch(text, /gaia dr|tycho/i);
});

test("a set of stars, a list of ids and the planets", () => {
  assert.equal(lineupBodies().length, 12);
  assert.deepEqual(lineupBodies({ set: "bright" }).map((body) => body.id), ["sun", "sirius-a", "vega", "arcturus", "aldebaran", "rigel", "antares", "betelgeuse"]);
  assert.deepEqual(lineupBodies({ set: "largest" }).map((body) => body.id), ["sun", "betelgeuse", "vy-canis-majoris", "woh-g64", "uy-scuti", "stephenson-2-18"]);
  assert.deepEqual(lineupBodies({ set: ["rigel", "sun"] }).map((body) => body.id), ["sun", "rigel"], "sorted by radius, whatever the order given");
  assert.deepEqual(LINEUP_SETS, ["all", "bright", "largest"]);
  assert.throws(() => lineupBodies({ set: ["sun", "nova"] }), /no star called nova/);
  const withPlanets = lineupBodies({ set: "bright", planets: true });
  assert.deepEqual(withPlanets.slice(0, 3).map((body) => body.id), ["earth", "jupiter", "sun"]);
  assert.equal(withPlanets[0]!.radiusKm, BODIES.earth.radiusKm, "a planet's size is the package's own fact");
  assert.ok(Math.abs(withPlanets[1]!.radiusSun - BODIES.jupiter.radiusKm / SUN_RADIUS_KM) < 1e-12);
  assert.ok(withPlanets[0]!.radiusSun < withPlanets[1]!.radiusSun && withPlanets[1]!.radiusSun < 1);
});

test("every star can be drawn: the look takes its numbers, and a star known only from its brightness says its size is estimated", () => {
  for (const body of lineupBodies()) {
    const one = body.row!;
    const look = starLook({ ...one.look, name: one.name.en, radiusSun: one.radiusSun, estimated: one.basis === "luminosity" || one.basis === "weak-distance" ? ["radiusSun"] : [] });
    assert.ok(Math.abs(look.radiusKm - body.radiusKm) < 1e-6, one.id);
    const size = look.parts.find((part) => part.part === "size")!;
    assert.equal(size.status, one.basis === "luminosity" || one.basis === "weak-distance" ? "estimated" : "measured", one.id);
  }
});

test("the row: bodies side by side, a quarter of the bigger one's radius apart, and a column the same way", () => {
  const bodies = lineupBodies({ planets: true });
  const row2 = placeLineup(bodies, "row");
  assert.equal(row2[0]!.x, 0);
  for (let i = 1; i < row2.length; i += 1) {
    const edge = row2[i]!.x - row2[i]!.r - (row2[i - 1]!.x + row2[i - 1]!.r);
    assert.ok(Math.abs(edge - 0.25 * row2[i]!.r) < 1e-9, `${bodies[i]!.id}: the gap is ${edge}`);
    assert.equal(row2[i]!.y, 0);
  }
  const stack = placeLineup(bodies, "stack");
  for (let i = 1; i < stack.length; i += 1) {
    assert.equal(stack[i]!.x, 0);
    assert.ok(Math.abs(stack[i - 1]!.y - stack[i]!.y - (stack[i - 1]!.r + 1.25 * stack[i]!.r)) < 1e-9);
  }
  assert.deepEqual(placeLineup([], "row"), []);
});

test("the zoom runs from the smallest body filling the picture to the largest filling it, smoothly, on a logarithmic scale", () => {
  const places = placeLineup(lineupBodies({ planets: true }), "row");
  const first = lineupView(places, 0);
  const last = lineupView(places, 1);
  assert.ok(Math.abs(first.h - 1.45 * places[0]!.r) < 1e-12, "Earth fills the picture at 0");
  assert.equal(first.x, places[0]!.x);
  assert.ok(Math.abs(last.h - 1.45 * places[places.length - 1]!.r) < 1e-9, "the largest star fills it at 1");
  assert.ok(Math.abs(last.x - places[places.length - 1]!.x) < 1e-9);
  assert.ok(last.h / first.h > 2e5, "from the Earth to the largest star is a factor of two hundred thousand");
  let before = lineupView(places, 0);
  for (let i = 1; i <= 2000; i += 1) {
    const view = lineupView(places, i / 2000);
    assert.ok(view.h >= before.h && view.x >= before.x, "never goes back");
    // a step of 1/2000 of the whole range changes the size by under 0.7 percent, and the centre by less than a fifth of what the camera frames
    assert.ok(view.h / before.h < 1.007, `size ${before.h} to ${view.h}`);
    assert.ok(view.x - before.x < view.h * 0.2, `centre ${before.x} to ${view.x} at ${i}`);
    before = view;
  }
  for (const place of places) {
    const t = lineupZoomOf(places, place.body.id)!;
    const view = lineupView(places, t);
    assert.ok(Math.abs(view.x - place.x) < 1e-9 * Math.max(1, place.x) && Math.abs(view.h - 1.45 * place.r) < 1e-9 * place.r, place.body.id);
    assert.equal(lineupFocus(places, t)!.body.id, place.body.id);
  }
  assert.equal(lineupZoomOf(places, "nova"), undefined);
  // a size that is no body's: the zoom that frames it, held to the ends (this is where the camera goes when its star leaves the set)
  assert.equal(lineupZoomFor(places, places[0]!.r / 10), 0);
  assert.equal(lineupZoomFor(places, places[places.length - 1]!.r * 10), 1);
  const between = lineupZoomFor(places, 80);
  assert.ok(between > lineupZoomOf(places, "aldebaran")! && between < lineupZoomOf(places, "antares")!);
  assert.ok(Math.abs(lineupView(places, between).h / 1.45 - 80) < 1e-9);
  assert.equal(lineupZoomFor([], 3), 0);
  assert.deepEqual(lineupView([], 0.5), { x: 0, y: 0, h: 1 });
  assert.equal(lineupView(places, 7).h, last.h, "held to 0..1");
  assert.equal(lineupView(places, Number.NaN).h, first.h);
});

test("a narrow picture is zoomed out so the framed body still fits across it, and the stack's camera moves down", () => {
  const places = placeLineup(lineupBodies({ set: "bright" }), "row");
  const wide = lineupView(places, 0.5, 16 / 9);
  const phone = lineupView(places, 0.5, 0.5);
  assert.ok(Math.abs(phone.h / wide.h - 2) < 1e-9);
  const stack = placeLineup(lineupBodies({ set: "bright" }), "stack");
  assert.ok(lineupView(stack, 1).y < lineupView(stack, 0).y);
  assert.equal(lineupView(stack, 1).x, 0);
});

test("projection: sizes are true, so Earth beside the Sun is a speck and the Sun is a hundred and nine Earths across", () => {
  const places = placeLineup(lineupBodies({ set: "bright", planets: true }), "row");
  const dots = lineupProject(places, lineupView(places, lineupZoomOf(places, "sun")!), 1000, 560);
  const earth = dots.find((dot) => dot.place.body.id === "earth")!;
  const sun = dots.find((dot) => dot.place.body.id === "sun")!;
  assert.ok(Math.abs(sun.cx - 500) < 1e-6 && Math.abs(sun.cy - 280) < 1e-6);
  assert.ok(Math.abs(sun.r / earth.r - SUN_RADIUS_KM / BODIES.earth.radiusKm) < 1e-6);
  assert.ok(earth.r < 2 && sun.r > 150);
});

test("the words: radius in Suns and kilometres with its error and its source, in English and Japanese", () => {
  const betelgeuse = lineupBodies().find((body) => body.id === "betelgeuse")!;
  assert.deepEqual(
    { ...lineupText(betelgeuse, "en"), method: "", note: "" },
    { name: "Betelgeuse", radius: "1,057 Suns (+228 −162)", km: "735 million km", source: "Haubois et al. 2009; Harper et al. 2017", method: "", note: "", estimated: false },
  );
  const ja = lineupText(betelgeuse, "ja");
  assert.equal(ja.name, "ベテルギウス");
  assert.equal(ja.radius, "太陽の1,057倍 (+228 −162)");
  assert.equal(ja.km, "7.35億 km");
  assert.ok(ja.method.length > 20 && ja.note.length > 20);
  const bodies = lineupBodies({ planets: true });
  const by = (id: string) => bodies.find((body) => body.id === id)!;
  assert.equal(lineupText(by("sun"), "en").radius, "1 Sun");
  assert.equal(lineupText(by("sirius-a"), "en").radius, "1.714 Suns (±0.009)");
  assert.equal(lineupText(by("rigel"), "en").radius, "78.9 Suns (±7.4)");
  assert.equal(lineupText(by("earth"), "en").radius, "0.00917 Suns");
  assert.equal(lineupText(by("earth"), "en").km, "6,378 km");
  assert.match(lineupText(by("earth"), "en").source, /IAU and NASA/);
  assert.match(lineupText(by("stephenson-2-18"), "en").source, /Fok et al. 2012 · estimated/);
  assert.match(lineupText(by("uy-scuti"), "ja").source, /推定/);
  assert.equal(lineupText(by("uy-scuti"), "en").estimated, true);
  assert.equal(lineupText(by("vy-canis-majoris"), "en").estimated, false);
  assert.equal(lineupKm(695_700, "en"), "695,700 km");
  assert.equal(lineupKm(1.5e9, "en"), "1.5 billion km");
  assert.equal(lineupKm(71_492, "ja"), "71,492 km");
});

test("the labels fit the picture, never cover one another, and a body too small to see has a ring", () => {
  const places = placeLineup(lineupBodies({ planets: true }), "row");
  for (const zoom of [0, 0.05, 0.15, 0.3, 0.45, 0.6, 0.8, 1]) {
    const dots = lineupProject(places, lineupView(places, zoom), 960, 540);
    const plan = lineupLabels(dots, 960, 540, "en", { keep: lineupFocus(places, zoom)!.body.id });
    for (const label of plan.labels) {
      assert.ok(label.x >= 0 && label.y >= 0 && label.x + label.width <= 960 + 1e-6 && label.y + label.height <= 540 + 1e-6, `${zoom}: ${label.id} is inside the picture`);
    }
    const kept = plan.labels;
    for (const [i, a] of kept.entries()) for (const b of kept.slice(i + 1)) assert.ok(a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height, `${zoom}: ${a.id} and ${b.id} overlap`);
    assert.ok(plan.labels.some((label) => label.id === lineupFocus(places, zoom)!.body.id), `${zoom}: the framed body is labelled`);
    for (const ring of plan.rings) assert.ok(dots.find((dot) => dot.place.body.id === ring.id)!.r < 6);
  }
  const sunZoom = lineupZoomOf(places, "sun")!;
  const plan = lineupLabels(lineupProject(places, lineupView(places, sunZoom), 960, 540), 960, 540, "en");
  assert.ok(plan.rings.some((ring) => ring.id === "earth"), "the Earth is a ring beside the Sun");
  const sunLabel = plan.labels.find((label) => label.id === "sun")!;
  assert.equal(sunLabel.lines.length, 4, "a big body has the name, the radius, the kilometres and the source");
  const svg = lineupLabelsSvg(plan);
  assert.match(svg, /^<g font-family/);
  assert.match(svg, /data-label="sun"/);
  assert.doesNotMatch(svg, /<script|onload/);
  const escaped = lineupLabelsSvg({ labels: [{ id: "a<b", lines: ["x & y"], x: 0, y: 0, width: 10, height: 10 }], rings: [] });
  assert.match(escaped, /a&lt;b/);
  assert.match(escaped, /x &amp; y/);
});
