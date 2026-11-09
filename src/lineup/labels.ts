// What the line-up says about each body and where it puts the words: a radius in Suns and kilometres with its error and its source, in English or Japanese, and a plan of labels that never overlap.
// The words are SVG, so the same markup labels the live picture, the saved image and the printed poster. Pure: strings and numbers, no DOM.
import type { LineupBody } from "./data.ts";
import type { LineupDot } from "./layout.ts";

/**
 * The two languages of the words: `en` and `ja`.
 *
 * @example
 * ```ts
 * import type { LineupLang } from "@johnmorrisdotca/wakusei-planets";
 *
 * const lang: LineupLang = "ja";
 * console.log(lang);
 * ```
 */
export type LineupLang = "en" | "ja";

const group = (value: number): string => value.toLocaleString("en-US");

/** A radius in Suns with as many places as its error deserves: whole above 100, one decimal above 10, two or three below, and three figures for a planet. */
function suns(value: number, error: number): string {
  if (value >= 100) return group(Math.round(value));
  if (value >= 10) return group(Number(value.toFixed(1)));
  if (value >= 1) return String(Number(value.toFixed(error > 0 && error < 0.01 ? 3 : 2)));
  return String(Number(value.toPrecision(3)));
}

/**
 * A length in kilometres in words: grouped digits up to a million (up to a hundred million in Japanese), then `735 million km` or `7.35億 km`, and `billion` above a thousand million.
 *
 * @param km - The length in kilometres.
 * @param lang - `en` or `ja`.
 * @returns The text.
 *
 * @example
 * ```ts
 * import { lineupKm } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(lineupKm(695_700, "en"), lineupKm(735_400_000, "en"), lineupKm(735_400_000, "ja"));
 * ```
 */
export function lineupKm(km: number, lang: LineupLang): string {
  if (lang === "ja") return km >= 1e8 ? `${Number((km / 1e8).toPrecision(3))}億 km` : `${group(Math.round(km))} km`;
  if (km >= 1e9) return `${Number((km / 1e9).toPrecision(3))} billion km`;
  if (km >= 1e6) return `${Number((km / 1e6).toPrecision(3))} million km`;
  return `${group(Math.round(km))} km`;
}

/** The error: `±0.2`, `+228 -162` (with a true minus), or nothing when there is none. */
function error(minus: number, plus: number): string {
  if (minus === 0 && plus === 0) return "";
  const fmt = (v: number): string => (v >= 10 ? group(Math.round(v)) : String(Number(v.toPrecision(2))));
  return Math.abs(minus - plus) < 1e-9 ? `±${fmt(plus)}` : `+${fmt(plus)} −${fmt(minus)}`;
}

/**
 * What the line-up says about one body, in words.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupText, type LineupText } from "@johnmorrisdotca/wakusei-planets";
 *
 * const text: LineupText = lineupText(lineupBodies().find((body) => body.id === "betelgeuse")!, "en");
 * console.log(text.radius, text.km);
 * ```
 */
export interface LineupText {
  name: string;
  /** `1,057 Suns (+228 −162)`, or in Japanese `太陽の1,057倍 (+228 −162)`. */
  radius: string;
  /** `735 million km`. */
  km: string;
  /** The source, short, and `estimated` where the size is not measured. */
  source: string;
  /** How the radius was got, one sentence. Empty for a planet. */
  method: string;
  /** What the literature disagrees about, if it does. */
  note: string;
  /** True when the size is estimated (from brightness, or from a distance that is not a parallax), not measured. */
  estimated: boolean;
}

/**
 * The words for a body: its name, radius in Suns with the error, radius in kilometres, the source and (for a star) how the radius was got and what the literature disagrees about.
 *
 * @param body - A body from `lineupBodies`.
 * @param lang - `en` or `ja`.
 * @returns The words.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupText } from "@johnmorrisdotca/wakusei-planets";
 *
 * const antares = lineupBodies().find((body) => body.id === "antares")!;
 * console.log(lineupText(antares, "ja").radius);
 * ```
 */
export function lineupText(body: LineupBody, lang: LineupLang): LineupText {
  const err = error(body.minus, body.plus);
  const value = suns(body.radiusSun, Math.max(body.minus, body.plus));
  const row = body.row;
  const estimated = row !== undefined && (row.basis === "luminosity" || row.basis === "weak-distance");
  const radius = lang === "ja" ? `太陽の${value}倍${err === "" ? "" : ` (${err})`}` : `${value} ${value === "1" ? "Sun" : "Suns"}${err === "" ? "" : ` (${err})`}`;
  const cite = row === undefined ? (lang === "ja" ? "IAU・NASAの値 (赤道半径)" : "IAU and NASA (equatorial radius)") : row.cite;
  return {
    name: body.name[lang],
    radius,
    km: lineupKm(body.radiusKm, lang),
    source: estimated ? `${cite} · ${lang === "ja" ? "推定" : "estimated"}` : cite,
    method: row?.method[lang] ?? "",
    note: row?.note?.[lang] ?? "",
    estimated,
  };
}

/** How much of a label to write: `full` is the name, the radius, the kilometres and the source; `short` the name and the radius; `marker` the name only. */
type Tier = "full" | "short" | "marker";

/**
 * A label placed on the picture: a plate of lines at a place, and the dot it belongs to.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupLabels, lineupProject, lineupView, placeLineup, type LineupLabel } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies(), "row");
 * const labels: LineupLabel[] = lineupLabels(lineupProject(places, lineupView(places, 0.5), 800, 450), 800, 450, "en").labels;
 * console.log(labels.map((label) => label.id).join(", "));
 * ```
 */
export interface LineupLabel {
  id: string;
  lines: string[];
  /** The top left of the plate, in pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The labels and rings for a picture: the biggest bodies first, each with as much as fits, a label dropped when it would cover one already placed, and a ring round a body too small to see. A body outside the picture has none.
 *
 * @param dots - The bodies on the picture (`lineupProject`).
 * @param width - The picture's width in pixels.
 * @param height - The picture's height in pixels.
 * @param lang - `en` or `ja`.
 * @param options - `font` (pixels, 12 by default), `keep` (the id of a body whose label is never dropped).
 * @returns The labels and the rings (`rings`: a centre and a radius for each body under 6 pixels across).
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupLabels, lineupProject, lineupView, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies({ planets: true }), "row");
 * const plan = lineupLabels(lineupProject(places, lineupView(places, 0.05), 800, 450), 800, 450, "en");
 * console.log(plan.labels.length, plan.rings.length);
 * ```
 */
export function lineupLabels(dots: readonly LineupDot[], width: number, height: number, lang: LineupLang, options: { font?: number; keep?: string } = {}): { labels: LineupLabel[]; rings: { id: string; cx: number; cy: number; r: number }[] } {
  const font = options.font ?? 12;
  const line = font * 1.4;
  const pad = font * 0.7;
  const placed: LineupLabel[] = [];
  const rings: { id: string; cx: number; cy: number; r: number }[] = [];
  const inside = dots.filter((dot) => dot.cx + dot.r > 0 && dot.cx - dot.r < width && dot.cy + dot.r > 0 && dot.cy - dot.r < height && dot.r > 0.01);
  // the body kept is placed first, so no other label can cover it; the rest go biggest first
  const bySize = [...inside].sort((a, b) => (a.place.body.id === options.keep ? -1 : b.place.body.id === options.keep ? 1 : b.r - a.r));
  for (const dot of bySize) {
    const id = dot.place.body.id;
    const ring = dot.r < 6;
    if (ring) rings.push({ id, cx: dot.cx, cy: dot.cy, r: Math.max(6, dot.r + 3) });
    const tier: Tier = dot.r >= 70 ? "full" : dot.r >= 6 ? "short" : "marker";
    const text = lineupText(dot.place.body, lang);
    const lines = tier === "full" ? [text.name, text.radius, text.km, text.source] : tier === "short" ? [text.name, text.radius] : [text.name];
    const chars = Math.max(...lines.map((one) => [...one].reduce((sum, ch) => sum + (ch.charCodeAt(0) > 0x2e80 ? 1.9 : 0.62), 0)));
    const w = chars * font + pad * 2;
    const h = lines.length * line + pad * 1.2;
    // the visible part of the disc, so a body bigger than the picture is labelled where it can be seen
    const left = Math.max(0, dot.cx - dot.r);
    const right = Math.min(width, dot.cx + dot.r);
    const x = Math.min(width - w - 6, Math.max(6, (left + right) / 2 - w / 2));
    const base = ring ? dot.cy + Math.max(6, dot.r + 3) + 6 : dot.cy + dot.r + 8;
    const y = Math.max(6, Math.min(height - h - 6, base));
    const box: LineupLabel = { id, lines, x, y, width: w, height: h };
    const clash = placed.some((other) => box.x < other.x + other.width + 4 && box.x + box.width + 4 > other.x && box.y < other.y + other.height + 4 && box.y + box.height + 4 > other.y);
    if (!clash || id === options.keep) placed.push(box);
  }
  return { labels: placed, rings };
}

const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The labels and rings as SVG markup (the contents of an `<svg>` that is `width` by `height`): a dark plate with white lines for each label, and a thin ring and tick for each body too small to see. The first line of a
 * plate is bold.
 *
 * @param plan - What `lineupLabels` returned.
 * @param font - The pixel size of the text; the same as was given to `lineupLabels` (12 by default).
 * @returns SVG markup.
 *
 * @example
 * ```ts
 * import { lineupBodies, lineupLabels, lineupLabelsSvg, lineupProject, lineupView, placeLineup } from "@johnmorrisdotca/wakusei-planets";
 *
 * const places = placeLineup(lineupBodies(), "row");
 * const plan = lineupLabels(lineupProject(places, lineupView(places, 0.4), 800, 450), 800, 450, "en");
 * console.log(lineupLabelsSvg(plan).startsWith("<g"));
 * ```
 */
export function lineupLabelsSvg(plan: ReturnType<typeof lineupLabels>, font = 12): string {
  const line = font * 1.4;
  const pad = font * 0.7;
  const rings = plan.rings.map((ring) => `<circle cx="${ring.cx.toFixed(1)}" cy="${ring.cy.toFixed(1)}" r="${ring.r.toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="${(font / 12).toFixed(2)}"/>`).join("");
  const plates = plan.labels
    .map((label) => {
      const text = label.lines.map((one, i) => `<text x="${(label.x + pad).toFixed(1)}" y="${(label.y + pad + line * (i + 0.8)).toFixed(1)}" font-size="${font}" fill="#ffffff"${i === 0 ? ' font-weight="700"' : ' fill-opacity="0.9"'}>${esc(one)}</text>`).join("");
      return `<g data-label="${esc(label.id)}"><rect x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" width="${label.width.toFixed(1)}" height="${label.height.toFixed(1)}" rx="${(font * 0.4).toFixed(1)}" fill="#05070d" fill-opacity="0.78" stroke="#ffffff" stroke-opacity="0.2"/>${text}</g>`;
    })
    .join("");
  return `<g font-family="system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif">${rings}${plates}</g>`;
}
