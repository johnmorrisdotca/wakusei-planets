// The npm keywords tell search what the package does, so they stay true: lower case, no repeats, and nothing from another kind of package (astrology, other libraries' own names).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const keywords = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { keywords: string[] }).keywords;
const LEFT_OUT = [
  "astrology", "horoscope", "zodiac", "houses", "aspects", "ayanamsa", "swisseph", "swiss-ephemeris", "siriusx", "mcp", "model-context-protocol",
  "interstellar", "interstellar-tools", "zodiac-icons", "react-three", "g_si", "mu", "vec3", "vector3", "newtons-law-of-gravitation",
];
const ALREADY_HAD = [
  "planets", "solar-system", "sun", "moon", "moons", "jupiter", "saturn", "mars", "astronomy", "ephemeris",
  "web-component", "custom-element", "svg", "three", "webgl", "line-drawing", "typescript",
];
const ADDED_NOW = [
  "planet", "mercury", "venus", "earth", "uranus", "neptune", "pluto", "dwarf-planets", "heliocentric", "orbit", "orbits", "rotation",
  "space", "celestial", "nasa", "jpl", "javascript", "3d", "browser",
];

test("the keywords are lower case and have no repeats", () => {
  assert.deepEqual(keywords, keywords.map((k) => k.toLowerCase().trim()));
  assert.equal(new Set(keywords).size, keywords.length);
});

test("no keyword is on the left-out list", () => {
  for (const word of LEFT_OUT) assert.ok(!keywords.includes(word), `${word} is not what this package is`);
});

test("the kept and the added keywords are all there", () => {
  for (const word of [...ALREADY_HAD, ...ADDED_NOW]) assert.ok(keywords.includes(word), word);
});
