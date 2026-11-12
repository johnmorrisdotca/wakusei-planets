import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BODY_IDS, PLANET_IDS } from "../src/facts.ts";
import { DWARF_ELEMENTS } from "../src/data/dwarf.ts";
import { ORBITS } from "../src/data/orbits.ts";
import { SPACECRAFT, SPACECRAFT_IDS } from "../src/spacecraft-facts.ts";
import { loadPlaces, PLACE_BODIES } from "../src/places.ts";

const placeCount = (await Promise.all(PLACE_BODIES.map(async (body) => (await loadPlaces(body)).length))).reduce((a, b) => a + b, 0);

const names = ["bodies", "orbital-elements", "spacecraft", "spacecraft-events", "places"];
const csvRow = (line: string): string[] => {
  const out: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"' && quoted && line[i + 1] === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field); return out;
};
test("the export has the package tables, values, schemas and checksums", () => {
  const dir = mkdtempSync(join(tmpdir(), "wakusei-export-"));
  try {
    execFileSync(process.execPath, ["scripts/export-data.ts", dir], { cwd: process.cwd() });
    const files = readdirSync(dir);
    const expected: Record<string, number> = { bodies: BODY_IDS.length, "orbital-elements": PLANET_IDS.length + Object.keys(DWARF_ELEMENTS).length + Object.keys(ORBITS).length, spacecraft: SPACECRAFT_IDS.length, "spacecraft-events": SPACECRAFT_IDS.reduce((sum, id) => sum + SPACECRAFT[id].events.length, 0), places: placeCount };
    for (const name of names) {
      assert.ok(files.includes(`${name}.csv`)); assert.ok(files.includes(`${name}.schema.json`));
      const schema = JSON.parse(readFileSync(join(dir, `${name}.schema.json`), "utf8")) as { rows: number; columns: { name: string; type: string; unit: string | null; meaning: string; source: string }[] };
      const lines = readFileSync(join(dir, `${name}.csv`), "utf8").trimEnd().split("\n");
      const headers = csvRow(lines[0]!);
      assert.deepEqual(headers, schema.columns.map((c) => c.name));
      assert.equal(lines.length - 1, expected[name]); assert.equal(schema.rows, expected[name]);
      for (const col of schema.columns) { assert.ok(col.name && col.type && col.meaning && col.source); assert.ok("unit" in col); }
      const row = (id: string) => { const found = lines.slice(1).map(csvRow).find((values) => values[0] === id); assert.ok(found, id); return Object.fromEntries(headers.map((key, index) => [key, found[index]!])); };
      if (name === "places") { const eagle = row("moon/apollo-11-lunar-module"); assert.equal(eagle.body, "moon"); assert.equal(eagle.kind, "crewed"); assert.ok(Math.abs(Number(eagle.lat) - 0.674) < 0.01); assert.equal(row("mars/rosalind-franklin").plannedDateOf, "landing"); assert.equal(row("mars/olympus-mons").featureType, "Mons, montes"); }
      if (name === "bodies") { assert.equal(Number(row("earth").radiusKm), 6378.137); assert.ok(Math.abs(Number(row("jupiter").rotationHours) - 9.925) < 0.001); }
      if (name === "orbital-elements") assert.ok(Math.abs(Number(row("ceres").aAu) - 2.77) < 0.01);
    }
    assert.ok(files.includes("LICENCE-DATA.md"));
    const sums = readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n");
    assert.equal(sums.length, names.length * 2 + 1);
    for (const line of sums) { const [hash, file] = line.split("  "); assert.equal(createHash("sha256").update(readFileSync(join(dir, file!))).digest("hex"), hash); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
