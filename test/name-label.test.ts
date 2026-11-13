import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { BODIES } from "../src/index.ts";
import { nameLabelKey, nameLabelLook, nameLabelText, nameTone, readNameLabel } from "../src/scene/name-label.ts";
import { createPainter } from "../src/scene/painter.ts";

/** An element as `readNameLabel` reads one: its attributes in a map. */
const elementWith = (attributes: Record<string, string>) => ({
  getAttribute: (name: string): string | null => (name in attributes ? attributes[name]! : null),
  hasAttribute: (name: string): boolean => name in attributes,
});

test("the text is the body's English name in capitals, or its Japanese name as it is", () => {
  assert.equal(nameLabelText(BODIES.earth.name), "EARTH");
  assert.equal(nameLabelText(BODIES.earth.name, "en"), "EARTH");
  assert.equal(nameLabelText(BODIES.earth.name, "ja"), "地球");
  assert.equal(nameLabelText(BODIES.makemake.name), "MAKEMAKE");
  assert.equal(nameLabelText(BODIES.halley.name, "ja"), BODIES.halley.name.ja);
});

test("the family's attributes: body-label alone is the look with the defaults, and the six beside it fill the options; anything that is not a look is no label", () => {
  assert.equal(readNameLabel(elementWith({})), null);
  assert.equal(readNameLabel(elementWith({ "body-label": "" })), null);
  assert.equal(readNameLabel(elementWith({ "body-label": "bold" })), null);
  assert.deepEqual(readNameLabel(elementWith({ "body-label": "painted" })), { look: "painted" });
  assert.deepEqual(
    readNameLabel(elementWith({ "body-label": "etched", "body-label-strength": "0.8", "body-label-repeat": "both", "body-label-latitude": "-55", "body-label-facing": "", "body-label-font": "Orbitron", "body-label-fallback-font": "Noto Sans JP" })),
    { look: "etched", strength: 0.8, repeat: "both", latitude: -55, facing: true, font: "Orbitron", fallbackFont: "Noto Sans JP" },
  );
  // a strength is kept within 0 to 1; a repeat that is not one of the three, or a number that is not one, is left out; `body-label-facing="off"` is not facing
  assert.deepEqual(readNameLabel(elementWith({ "body-label": "outline", "body-label-strength": "7", "body-label-repeat": "twice", "body-label-latitude": "north", "body-label-facing": "off", "body-label-font": " " })), { look: "outline", strength: 1 });
});

test("the key changes with the text and with every setting, and reads the same for the defaults written out or left out", () => {
  const plain = nameLabelKey("EARTH", { look: "painted" });
  assert.equal(nameLabelKey("EARTH", { look: "painted", strength: 0.5, repeat: "once", latitude: 0, facing: false }), plain);
  assert.notEqual(nameLabelKey("地球", { look: "painted" }), plain);
  assert.notEqual(nameLabelKey("EARTH", { look: "etched" }), plain);
  assert.notEqual(nameLabelKey("EARTH", { look: "painted", repeat: "both" }), plain);
  assert.notEqual(nameLabelKey("EARTH", { look: "painted", latitude: 55 }), plain);
  assert.notEqual(nameLabelKey("EARTH", { look: "painted", facing: true }), plain);
  assert.notEqual(nameLabelKey("EARTH", { look: "painted", strength: 1 }), plain);
  assert.equal(nameLabelKey("EARTH", null), "");
});

test("the painter takes a label, says what it would write, and lets it go: in Node, with no canvas, nothing is added to the body and nothing throws", () => {
  const painter = createPainter({ textureBase: "/none/", farBase: "/none/" });
  const mars = painter.make(THREE, "Mars", { look: "realistic", label: { look: "painted", lang: "ja" } });
  const mesh = mars.object.children[0] as THREE.Mesh;
  assert.equal(mars.label?.text, "火星");
  assert.equal(mars.label?.shown, false);
  assert.equal(mesh.children.length, 1, "the label's group is a child of the turning mesh");
  mars.update({ toSun: [0, 0, 1], ms: Date.UTC(2026, 10, 2), radiusPx: 80 });
  mars.setLabel({ look: "etched", text: "RED" });
  assert.equal(mars.label?.text, "RED");
  mars.setLabel(null);
  assert.equal(mars.label, null);
  assert.equal(mesh.children.length, 0);
  const sun = painter.make(THREE, "Sun", { label: { look: "painted" } });
  assert.equal(sun.label?.text, "SUN");
  sun.dispose();
  mars.dispose();
});

test("the tone of the letters comes from the body's own colour: dark on Venus, Saturn, Uranus, the Sun and the ice moons, pale on Mars, the Moon, the Earth and Neptune (MODULES-983)", () => {
  for (const id of ["venus", "saturn", "uranus", "sun", "io", "europa", "enceladus", "tethys", "dione", "rhea"] as const) assert.equal(nameTone(BODIES[id].colour), "dark", id);
  for (const id of ["mars", "moon", "earth", "neptune", "jupiter", "pluto", "ganymede", "callisto", "mercury", "ceres"] as const) assert.equal(nameTone(BODIES[id].colour), "light", id);
  // dark letters are the burned look and pale ones the painted look; the outline has one tone; a forced tone wins over the body's
  assert.equal(nameLabelLook({ look: "painted" }, BODIES.uranus.colour), "burned");
  // auto changes only `painted`: a look the page names is drawn as asked
  assert.equal(nameLabelLook({ look: "etched" }, BODIES.uranus.colour), "etched");
  assert.equal(nameLabelLook({ look: "painted" }, BODIES.mars.colour), "painted");
  assert.equal(nameLabelLook({ look: "burned" }, BODIES.mars.colour), "burned");
  assert.equal(nameLabelLook({ look: "painted", tone: "auto" }, BODIES.mars.colour), "painted");
  assert.equal(nameLabelLook({ look: "burned", tone: "light" }, BODIES.mars.colour), "painted");
  assert.equal(nameLabelLook({ look: "etched", tone: "dark" }, BODIES.mars.colour), "burned");
  assert.equal(nameLabelLook({ look: "burned" }, BODIES.uranus.colour), "burned");
  assert.equal(nameLabelLook({ look: "outline" }, BODIES.uranus.colour), "outline");
  assert.equal(nameLabelLook({ look: "painted", tone: "light" }, BODIES.uranus.colour), "painted");
  assert.equal(nameLabelLook({ look: "painted", tone: "dark" }, BODIES.mars.colour), "burned");
  assert.equal(nameLabelLook({ look: "painted", tone: "auto" }, BODIES.venus.colour), "burned");
  // with no colour to go by, auto leaves the look as it is
  assert.equal(nameLabelLook({ look: "painted" }), "painted");
});

test("body-label-tone is read as auto, light or dark, and anything else is left out; the key changes with it", () => {
  assert.deepEqual(readNameLabel(elementWith({ "body-label": "painted", "body-label-tone": "dark" })), { look: "painted", tone: "dark" });
  assert.deepEqual(readNameLabel(elementWith({ "body-label": "painted", "body-label-tone": "light" })), { look: "painted", tone: "light" });
  assert.deepEqual(readNameLabel(elementWith({ "body-label": "painted", "body-label-tone": "auto" })), { look: "painted", tone: "auto" });
  assert.deepEqual(readNameLabel(elementWith({ "body-label": "painted", "body-label-tone": "grey" })), { look: "painted" });
  assert.equal(nameLabelKey("EARTH", { look: "painted", tone: "auto" }), nameLabelKey("EARTH", { look: "painted" }));
  assert.notEqual(nameLabelKey("EARTH", { look: "painted", tone: "dark" }), nameLabelKey("EARTH", { look: "painted" }));
});
