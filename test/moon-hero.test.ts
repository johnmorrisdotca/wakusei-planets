// The hero's arc: the main moons, farthest first, discs in diameter order, the arc running down toward the planet.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonPage } from "../src/moon-pages/index.ts";
import { HERO_ARC, HERO_SMALL, heroMoons, heroScale, heroSmall, heroZoom } from "../src/moon-pages/hero.ts";

test("the hero arc is the main moons, farthest first, and the biggest moon has the biggest disc", () => {
  const jupiter = heroMoons(moonPage("jupiter").cards, "jupiter", "en");
  assert.deepEqual(jupiter.map((moon) => moon.id), [...HERO_ARC.jupiter]);
  assert.deepEqual(jupiter.map((moon) => moon.name), ["Callisto", "Ganymede", "Europa", "Io"]);
  assert.ok(jupiter[0]!.top < jupiter[3]!.top);
  assert.ok(jupiter[0]!.left < jupiter[3]!.left);
  assert.ok(jupiter.find((moon) => moon.id === "ganymede")!.px >= jupiter.find((moon) => moon.id === "callisto")!.px);
  assert.ok(jupiter.find((moon) => moon.id === "io")!.px > jupiter.find((moon) => moon.id === "europa")!.px);

  const saturn = heroMoons(moonPage("saturn").cards, "saturn", "en");
  assert.deepEqual(saturn.map((moon) => moon.id), [...HERO_ARC.saturn]);
  const titan = saturn.find((moon) => moon.id === "titan")!;
  assert.ok(saturn.every((moon) => moon.px <= titan.px));

  const japanese = heroMoons(moonPage("jupiter").cards, "jupiter", "ja");
  assert.deepEqual(japanese.map((moon) => moon.name), ["カリスト", "ガニメデ", "エウロパ", "イオ"]);

  assert.ok(jupiter[3]!.left <= 30, "Io stays left of the planet's limb");
  assert.ok(heroZoom("jupiter") > 2);
  assert.ok(saturn.every((moon) => moon.px >= 64), "a medium moon stays large enough to see");
  assert.ok(saturn[0]!.top < 14 && saturn.at(-1)!.top > 70, "the arc uses the height of the hero");
  assert.ok(saturn[1]!.top - saturn[0]!.top > 18, "Iapetus stays clear of Titan");
  const small = heroSmall(moonPage("saturn").cards, "saturn", "en");
  assert.deepEqual(small.map((moon) => moon.id), [...HERO_SMALL.saturn]);
  assert.equal(small[0]!.name, "Pan*");
  assert.ok(!small.some((moon) => moon.id === "methone"));
  const scale = heroScale(moonPage("saturn").cards, "saturn");
  assert.deepEqual(scale.map((moon) => moon.id), [...HERO_ARC.saturn, ...HERO_SMALL.saturn]);
  const titanPx = scale.find((moon) => moon.id === "titan")!.px;
  const panPx = scale.find((moon) => moon.id === "pan")!.px;
  assert.ok(titanPx > panPx * 4);
  assert.equal(heroZoom("saturn"), 1);
  assert.equal(heroZoom("uranus"), 1);

  for (const host of ["uranus", "neptune"] as const) {
    const arc = heroMoons(moonPage(host).cards, host, "en");
    assert.deepEqual(arc.map((moon) => moon.id), [...HERO_ARC[host]]);
    const tops = arc.map((moon) => moon.top);
    assert.deepEqual(tops, [...tops].sort((a, b) => a - b));
  }
});
