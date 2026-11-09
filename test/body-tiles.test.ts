import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { bodyFragment, MICRO_DETAIL, PAINTED_SURFACE, PAINTED_SURFACE_WINDOWED, RING_FRAGMENT, RING_FRAGMENT_DETAIL } from "../src/scene/glsl.ts";
import { detailOf } from "../src/scene/look.ts";
import { tilesBase, TILES_BASE } from "../src/scene/textures.ts";

const root = new URL("../", import.meta.url).pathname;
const venv = `${root}.cache/venv/bin/python`;
const python = existsSync(venv) ? venv : "python3";
const hasPillow = spawnSync(python, ["-I", "-c", "import PIL, numpy"]).status === 0;

test("the tile script cuts a made-up map: the pyramid's shape, the base's colour, the source's detail, no seam", { skip: hasPillow ? false : "Pillow and numpy are not installed (python3 -m venv .cache/venv && .cache/venv/bin/pip install pillow numpy)" }, () => {
  const run = spawnSync(python, ["-I", `${root}scripts/make-body-tiles.py`, "selftest"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /selftest ok/);
});

test("a glowing body's shader is the program it always was, and a body's own takes the window and the generic detail", () => {
  const sun = bodyFragment(PAINTED_SURFACE, true, false, [1, 0.5, 0.2]);
  assert.ok(!sun.includes("microDetail") && !sun.includes("uDetail") && !sun.includes("gTexel"), "the Sun's shader has none of the new code");
  const mars = bodyFragment(PAINTED_SURFACE_WINDOWED, true, false, undefined, true);
  assert.ok(mars.includes("microDetail(p)") && mars.includes("uDetailRect") && mars.includes("textureGrad(uDetail"));
  assert.ok(mars.indexOf("float gTexel") < mars.indexOf("vec4 surface"), "gTexel is declared before the surface code that sets it");
  assert.ok(MICRO_DETAIL.includes("fwidth") && MICRO_DETAIL.includes("uDetailAmp"));
  const shaded = bodyFragment("vec4 surface(vec3 p) { return vec4(p, 0.0); }", false, false, undefined, true);
  assert.ok(shaded.includes("gTexel = uTexel;") && shaded.includes("s.rgb *= microDetail(p);"));
});

test("the ring's detail shader adds ringlets to the ring's shader and leaves the one that others use alone", () => {
  assert.ok(!RING_FRAGMENT.includes("uRingTexel") && !RING_FRAGMENT.includes("rnoise"));
  assert.ok(RING_FRAGMENT_DETAIL.includes("uniform float uRingTexel;") && RING_FRAGMENT_DETAIL.includes("rnoise(u / cell") && RING_FRAGMENT_DETAIL.includes("float rhash("));
  // everything the ring's own shader does is still done: the radius test, the shadow of the planet, the light
  for (const part of ["discard", "smoothstep(1.02, 0.97, closest)", "bright *= 0.38"]) assert.ok(RING_FRAGMENT_DETAIL.includes(part), part);
});

test("the generic detail is strong for a rock and soft for a gas giant, and none for a star", () => {
  assert.deepEqual(detailOf({ id: "moon", surface: "" }), { amount: 0.32, stretch: 1 });
  assert.ok(detailOf({ id: "saturn", surface: "" }).stretch > 1 && detailOf({ id: "saturn", surface: "" }).amount < 0.32);
  assert.deepEqual(detailOf({ id: "sun", surface: "", emissive: true }), { amount: 0, stretch: 1 });
  assert.deepEqual(detailOf({ id: "moon", surface: "", detail: { amount: 0.5, stretch: 2 } }), { amount: 0.5, stretch: 2 });
});

test("the tiles are looked for on the demo site by default, on the page's own folder when it says, and nowhere for a page that serves its own pictures", () => {
  const element = (attributes: Record<string, string>) => ({ getAttribute: (name: string) => attributes[name] ?? null, hasAttribute: (name: string) => name in attributes }) as unknown as Element;
  assert.equal(tilesBase(element({})), TILES_BASE);
  assert.equal(tilesBase(element({ tiles: "/maps/tiles" })), "/maps/tiles/");
  assert.equal(tilesBase(element({ tiles: "off" })), undefined);
  assert.equal(tilesBase(element({ "texture-base": "/t/" })), undefined);
  assert.equal(tilesBase(element({ "texture-base": "/t/", tiles: "tiles/" })), "tiles/");
});
