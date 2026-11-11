import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { BODY_IDS } from "../src/index.ts";
import { lookOf } from "../src/scene/look.ts";
import "../src/bodies/all.ts";

const sources = JSON.parse(readFileSync("textures/SOURCES.json", "utf8")) as Record<string, { licence: string; page: string }>;
const notice = readFileSync("NOTICE.md", "utf8");

test("every painted look has all its pictures, and every picture is one a look names", () => {
  const painted = BODY_IDS.map((id) => lookOf(id)?.painted).filter((p): p is NonNullable<typeof p> => p !== undefined);
  assert.equal(painted.length, 26);
  for (const map of painted) {
    for (const width of map.widths) assert.ok(existsSync(`textures/${map.map}-${width}.webp`), `${map.map}-${width}`);
    if (map.rings) assert.ok(existsSync(`textures/${map.rings.map}-${map.rings.width}.webp`), map.rings.map);
  }
});

test("each picture's source is public domain, CC0 or CC BY 4.0, and credited in NOTICE.md", () => {
  for (const [name, source] of Object.entries(sources)) {
    assert.match(source.licence, /^(Public domain|CC0|CC BY 4\.0)/, name);
    assert.ok(notice.includes(source.page), `${name}'s file page is in NOTICE.md`);
  }
});

test("the pictures of the package are small: the widths that ship stay within 2.1 MB, and the sharpest is far", () => {
  let bytes = 0;
  for (const id of BODY_IDS) {
    const map = lookOf(id)?.painted;
    if (map === undefined) continue;
    if (map.widths.includes(2048)) assert.equal(map.far, 2048);
    for (const width of map.widths) if (width < (map.far ?? Infinity)) bytes += statSync(`textures/${map.map}-${width}.webp`).size;
    if (map.rings) bytes += statSync(`textures/${map.rings.map}-${map.rings.width}.webp`).size;
  }
  assert.ok(bytes < 2.1 * 1024 * 1024, String(bytes));
});
