import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BODIES, type BodyId } from "../src/facts.ts";
import { builtTiles, GUIDE, GUIDE_JA, guideTable, rows, table } from "../scripts/zoom-table.ts";

const text = readFileSync(GUIDE, "utf8");

/** The widths of the tile sets that the guide's own table names (the bodies whose map it says is `tiles`). */
function tilesNamedByTheGuide(): Record<string, number> {
  const byName = new Map((Object.keys(BODIES) as BodyId[]).map((id) => [BODIES[id].name.en, id]));
  const out: Record<string, number> = {};
  for (const line of guideTable(text).split("\n").slice(2)) {
    const [, name, width, from] = line.split("|").map((cell) => cell.trim());
    if (from === "tiles") out[byName.get(name!)!] = Number(width);
  }
  return out;
}

test("the guide's table of how far each body zooms is what the code gives, for every body", () => {
  const list = rows(tilesNamedByTheGuide());
  assert.equal(list.length, Object.keys(BODIES).length, "a row for every body");
  assert.equal(guideTable(text), table(list));
  assert.equal(guideTable(readFileSync(GUIDE_JA, "utf8")), table(list, "ja"), "and the Japanese guide's");
});

test("the tile sets the guide names are the ones the script makes", { skip: builtTiles() === undefined ? "no tile set is built (pnpm tiles)" : false }, () => {
  assert.deepEqual(tilesNamedByTheGuide(), builtTiles());
});

test("a body zooms at least as far as it always did, and the ones with finer maps further", () => {
  const byId = Object.fromEntries(rows(tilesNamedByTheGuide()).map((r) => [r.id, r]));
  for (const r of Object.values(byId)) assert.ok(r.alone >= 8 && r.alone <= 1000, `${r.id} ${r.alone}`);
  assert.ok(byId["mars"]!.alone > 4 * byId["ceres"]!.alone, "finer tiles take Mars much further than Ceres");
  assert.ok(byId["saturn"]!.moons! > 100, "Saturn in its moons picture goes far past the old stop at 8");
  assert.equal(byId["sun"]!.alone, 8, "the Sun draws as it always did");
});
