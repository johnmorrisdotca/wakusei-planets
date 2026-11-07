// The npm keywords tell search what the package does, so they stay true: lower case, no repeats, and nothing from another kind of package (astrology, other libraries' own names).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const keywords = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { keywords: string[] }).keywords;
const NOT_THIS_PACKAGE = ["astrology", "horoscope", "zodiac", "houses", "aspects", "ayanamsa", "swisseph", "swiss-ephemeris", "interstellar", "interstellar-tools", "mcp", "model-context-protocol"];

test("the keywords are lower case and have no repeats", () => {
  assert.deepEqual(keywords, keywords.map((k) => k.toLowerCase().trim()));
  assert.equal(new Set(keywords).size, keywords.length);
});

test("no keyword claims another kind of package", () => {
  for (const word of NOT_THIS_PACKAGE) assert.ok(!keywords.includes(word), `${word} is not what this package is`);
});

test("every planet and the Sun, the Moon and Pluto is a keyword", () => {
  for (const word of ["sun", "moon", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]) assert.ok(keywords.includes(word), word);
});
