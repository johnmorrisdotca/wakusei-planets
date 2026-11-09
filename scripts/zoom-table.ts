// The table of how far each body zooms, for docs/guides/close-zoom.md, worked out from the same code the element uses (src/scene/reach.ts, src/scene/extent.ts) and the tile set's own manifest
// (.cache/body-tiles-out/manifest.json, which `pnpm tiles` makes). `node scripts/zoom-table.ts write` puts it between the guide's markers, `node scripts/zoom-table.ts check` fails when the guide's
// table is not what the code gives (test/zoom-table.test.ts runs the same check, with the widths the table itself names when no tile set is built).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import "../src/bodies/all.ts";
import { BODIES, MOONS_OF, type BodyId } from "../src/facts.ts";
import { extentOf, ROOM } from "../src/scene/extent.ts";
import { detailOf, lookOf } from "../src/scene/look.ts";
import { mapWidthOf, ringWidthOf, zoomLimit } from "../src/scene/reach.ts";

const ROOT = new URL("../", import.meta.url).pathname;
export const GUIDE = `${ROOT}docs/guides/close-zoom.md`;
export const GUIDE_JA = `${ROOT}docs/guides/ja/close-zoom.md`;
export type Lang = "en" | "ja";
export const MANIFEST = `${ROOT}.cache/body-tiles-out/manifest.json`;
export const START = "<!-- zoom-table -->";
export const END = "<!-- /zoom-table -->";

/** One row: the body, the width of the widest map it has, where that comes from, and the zoom range alone and in a picture of its moons. */
export interface Row {
  id: BodyId;
  width: number;
  from: "tiles" | "map" | "shader" | "unchanged";
  alone: number;
  extent: number | undefined;
  moons: number | undefined;
}

/** The widths of the tile sets' top levels by body, from a built manifest (`undefined` when none is built). */
export function builtTiles(): Record<string, number> | undefined {
  if (!existsSync(MANIFEST)) return undefined;
  const bodies = JSON.parse(readFileSync(MANIFEST, "utf8")).bodies as Record<string, { levels: { width: number }[] }>;
  return Object.fromEntries(Object.entries(bodies).map(([id, b]) => [id, Math.max(...b.levels.map((l) => l.width))]));
}

/** The rows, with the tile sets' top widths given (by body name): the body's own map or shader otherwise. */
export function rows(tiles: Record<string, number>): Row[] {
  return (Object.keys(BODIES) as BodyId[]).map((id) => {
    const f = BODIES[id];
    const look = lookOf(id);
    const painted = look?.painted !== undefined;
    const top = tiles[look?.painted?.map ?? id];
    const levels = top === undefined ? undefined : [{ level: Math.log2(top / 2048), width: top, height: top / 2, columns: top / 512, rows: top / 1024 }];
    const width = mapWidthOf(look, painted, levels);
    const smooth = look !== undefined && detailOf(look).stretch > 1;
    const ring = painted ? ringWidthOf(look, f.radiusKm) : 0;
    const glow = look?.emissive === true;
    const alone = glow ? zoomLimit(ROOM, 0, false) : zoomLimit(ROOM, width, smooth, ring);
    const extent = id in MOONS_OF ? extentOf(f, { moons: true }) : undefined;
    const moons = extent === undefined ? undefined : zoomLimit(extent, width, smooth, ring);
    const from = glow ? "unchanged" : top !== undefined ? "tiles" : painted ? "map" : "shader";
    return { id, width: glow ? 2048 : width, from, alone, extent, moons };
  });
}

const WORDS = {
  en: { head: ["Body", "Widest map (texels round)", "It is", "Alone", "Moons picture reaches", "Moons picture"], from: { tiles: "tiles", map: "map", shader: "shader", unchanged: "unchanged" }, times: "x", radii: "radii" },
  ja: { head: ["天体", "いちばん細かい地図 (一周のテクセル数)", "細かさの出どころ", "単独", "衛星の絵が届く範囲", "衛星の絵"], from: { tiles: "タイル", map: "地図", shader: "シェーダー", unchanged: "従来どおり" }, times: "倍", radii: "天体半径" },
} as const;

/** The table as Markdown, in a language. */
export function table(list: readonly Row[], lang: Lang = "en"): string {
  const w = WORDS[lang];
  const lines = [`| ${w.head.join(" | ")} |`, "|---|---|---|---|---|---|"];
  for (const r of list) lines.push(`| ${BODIES[r.id].name[lang]} | ${r.width} | ${w.from[r.from]} | ${r.alone}${w.times} | ${r.extent === undefined ? "" : `${r.extent.toFixed(1)} ${w.radii}`} | ${r.moons === undefined ? "" : `${r.moons}${w.times}`} |`);
  return lines.join("\n");
}

/** The table the guide holds now, as lines. */
export function guideTable(text: string): string {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a < 0 || b < a) throw new Error(`a guide has no ${START} ... ${END}`);
  return text.slice(a + START.length, b).trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tiles = builtTiles();
  if (tiles === undefined) throw new Error("no tile set is built (pnpm tiles): the widths of the tile sets are read from its manifest");
  const list = rows(tiles);
  let failed = false;
  for (const [file, lang] of [[GUIDE, "en"], [GUIDE_JA, "ja"]] as const) {
    const made = table(list, lang);
    const text = readFileSync(file, "utf8");
    if (process.argv[2] === "write") {
      const a = text.indexOf(START) + START.length;
      const b = text.indexOf(END);
      writeFileSync(file, `${text.slice(0, a)}\n${made}\n${text.slice(b)}`);
      console.log(`zoom table written to ${file}`);
    } else if (guideTable(text) !== made) {
      console.error(`the zoom table of ${file} is not what the code gives: run node scripts/zoom-table.ts write`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  if (process.argv[2] !== "write") console.log("the guides' zoom tables are what the code gives");
}
