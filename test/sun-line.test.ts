// The Sun's line drawing is the same markup it was before the star look was added: the hashes were taken from the code before it.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { lineSvg, type LineOptions } from "../src/line.ts";

const SETS: readonly (readonly [string, LineOptions, string])[] = [
  ["default", {}, "13f5bc7199e97db152640491f555a45a951afc736f27ea021b00cb4861c61afc"],
  ["pose", { size: 200, tilt: 10, pitch: 20, spin: 40 }, "207d52fe007ba213a80f9719cb6c628b7a6e6838936cb7760dabf4152e092c3f"],
  ["japanese and fill", { size: 320, lang: "ja", fill: 0.45 }, "334a336b183768a41dc23d0b8ce82868f862d4a562359feb54a2b8c2d6dbaf6b"],
  ["zoom, pan and colours", { size: 480, zoom: 2, panX: 0.1, panY: -0.2, stroke: "#abcdef", paper: "#101010" }, "e603e5949606b048cfe618df08fea6444712e4b6fe8ff3071bb676b5ffea6b34"],
  ["a date", { size: 320, time: Date.UTC(2026, 10, 2, 12) }, "8fbba9dbd4bd788490a4417cbc44239593a3d062944f748949744c8db3c85013"],
];

for (const [name, options, hash] of SETS) {
  test(`the Sun's line drawing is unchanged: ${name}`, () => {
    assert.equal(createHash("sha256").update(lineSvg("sun", options)).digest("hex"), hash);
  });
}
