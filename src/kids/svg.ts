// One colouring sheet as one SVG measured in millimetres: the picture, the colours to colour with and the three facts (or, for the lineup, all the planets in a row at one scale). Pure: a string.
import { TYPE_PRESETS, DEFAULT_MARGIN_MM, printableSize, type Orientation, type PageName } from "@johnmorrisdotca/kazoku-ui/print";
import { BODIES, type BodyId } from "../facts.ts";
import { KIDS_BODIES, LINEUP_IDS, SAY, SWATCHES, kidsFacts, kidsName, kidsSay, lineupFacts, type KidsBody, type KidsSheet, type Lang } from "./data.ts";
import { colouringArt, colouringPicture, LINE_MM, OUTLINE_MM, reach, sheetPose } from "./picture.ts";

const PT = 25.4 / 72;
const KID = TYPE_PRESETS.kid;
const BODY_MM = KID.bodyPt * PT;
const NAME_MM = KID.namePt * PT;
/** The planets' names on the lineup: the least size the kid type allows for a name, 24 pt. */
const LABEL_MM = 24 * PT;
/** What the sheet's header, footer and gaps take from the page's height, in millimetres, as measured (a narrow page's footer is taller, for its address wraps); a browser measures the real room (`kidsSheet`). */
const FRAME_MM = 89;
const WIDE_FRAME_MM = 77;

/** The lineup is wide, so it is printed on its side. */
export const kidsOrientation = (id: KidsSheet): Orientation => (id === "lineup" ? "landscape" : "portrait");

/**
 * The room a sheet's picture has on a page, in millimetres: the page inside its margins, less the header and the footer.
 * @param page - `a4`, `letter`, `a3` or `tabloid`.
 * @param orientation - `portrait` or `landscape`.
 * @returns The width and height.
 *
 * @example
 * ```ts
 * import { kidsRoom } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * console.log(kidsRoom("a4", "portrait"));
 * ```
 */
export function kidsRoom(page: PageName, orientation: Orientation = "portrait"): { widthMm: number; heightMm: number } {
  const size = printableSize(page, orientation, DEFAULT_MARGIN_MM);
  return { widthMm: size.widthMm, heightMm: size.heightMm - (size.widthMm >= 240 ? WIDE_FRAME_MM : FRAME_MM) };
}

const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number): string => (Math.round(v * 100) / 100).toString();

/** The width of a text in millimetres, estimated on the wide side so a font that is wider than the rounded ones (a fallback on a server) still fits: a full-width character is as wide as the type is tall, a Latin capital or a digit 0.82 of it, a small letter 0.7 (DejaVu Sans Bold, the usual fallback on a server, is that wide), a space or a stop 0.38. */
export function textWidth(text: string, sizeMm: number): number {
  let total = 0;
  for (const ch of text) total += /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/.test(ch) ? sizeMm : /[ .,:;!'|]/.test(ch) ? 0.38 * sizeMm : /[A-Z0-9]/.test(ch) ? 0.82 * sizeMm : 0.7 * sizeMm;
  return total;
}

/** Break a sentence into lines no wider than `maxMm`: at spaces for English, after a full stop (or anywhere) for Japanese. */
export function wrap(text: string, maxMm: number, sizeMm: number): string[] {
  const japanese = /[぀-ヿ一-鿿]/.test(text);
  const pieces = japanese ? (text.match(/[^。]+。?/g) ?? [text]) : text.split(" ");
  const joiner = japanese ? "" : " ";
  const lines: string[] = [];
  let line = "";
  for (const piece of pieces) {
    const next = line === "" ? piece : line + joiner + piece;
    if (line !== "" && textWidth(next, sizeMm) > maxMm) {
      lines.push(line);
      line = piece;
    } else line = next;
  }
  if (line !== "") lines.push(line);
  return japanese ? lines.flatMap((one) => cut(one, maxMm, sizeMm)) : lines;
};

function cut(line: string, maxMm: number, sizeMm: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (current !== "" && textWidth(current + ch, sizeMm) > maxMm) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  return current === "" ? out : [...out, current];
}

interface Block {
  markup: string;
  height: number;
}

const text = (x: number, y: number, size: number, body: string, extra = ""): string => `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" font-weight="700" fill="#000"${extra}>${esc(body)}</text>`;

/** The facts as numbered dots and lines of words. */
function facts(list: readonly string[], width: number, y: number, numbered = true): Block {
  const dot = 4.6;
  const left = 2 * dot + 4;
  const lineHeight = BODY_MM * 1.3;
  const out: string[] = [];
  let at = y;
  list.forEach((fact, i) => {
    const lines = wrap(fact, width - left, BODY_MM);
    const rowHeight = Math.max(2 * dot, lines.length * lineHeight);
    const mid = at + rowHeight / 2;
    out.push(`<circle cx="${n(dot)}" cy="${n(mid)}" r="${dot}" fill="#000"/>`, numbered ? `<text x="${n(dot)}" y="${n(mid + BODY_MM * 0.36)}" font-size="${n(BODY_MM)}" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>` : "");
    lines.forEach((line, k) => out.push(text(left, mid - (lines.length * lineHeight) / 2 + lineHeight * (k + 0.72), BODY_MM, line, ' data-fact=""')));
    at += rowHeight + 3.5;
  });
  return { markup: `<g data-facts="">${out.join("")}</g>`, height: at - y - 3.5 };
}

/** The colours to colour with: the heading at the left, then a square of each real colour with its name under it. */
function swatches(id: KidsBody, lang: Lang, width: number, y: number): Block {
  const list = SWATCHES[id];
  const head = NAME_MM * 0.9;
  const headWidth = 52;
  const cell = (width - headWidth) / list.length;
  const square = 14;
  const out = [text(1.2, y + square / 2 + head * 0.35, head, SAY[lang].colour, ' data-colour-head=""')];
  list.forEach((one, i) => {
    const cx = headWidth + cell * i + cell / 2;
    out.push(`<rect x="${n(cx - square / 2 - 1)}" y="${n(y)}" width="${n(square + 2)}" height="${n(square)}" rx="3" fill="${one.hex}" stroke="#000" stroke-width="${LINE_MM}" data-swatch="${one.hex}"/>`);
    out.push(text(cx, y + square + 2 + BODY_MM * 0.85, BODY_MM, one[lang], ' text-anchor="middle" data-swatch-name=""'));
  });
  return { markup: `<g data-swatches="">${out.join("")}</g>`, height: square + 2 + BODY_MM * 1.2 };
}

/** The sheet of one body: the picture on top, then the colours, then the facts. */
function bodySheet(id: KidsBody, lang: Lang, width: number, height: number): string {
  const list = kidsFacts(id, lang);
  const probe = facts(list, width, 0);
  const colours = swatches(id, lang, width, 0);
  const gap = 7;
  const art = colouringPicture(id, width, height - probe.height - colours.height - 2 * gap);
  const top = height - probe.height - colours.height - 2 * gap;
  const parts = [art.markup, `<g transform="translate(0 ${n(top + gap)})">${colours.markup}</g>`, `<g transform="translate(0 ${n(top + colours.height + 2 * gap)})">${facts(list, width, 0).markup}</g>`];
  return parts.join("");
}

/** What a planet takes of the row: its width, or its rings'. */
const extentKm = (id: BodyId): number => 2 * reach(id, sheetPose(id)).x * BODIES[id].radiusKm;

/** The lineup: every planet on one line at one scale, each with a number under it and a line to the number; below, the numbers with the names in the order from the Sun; and three facts. */
function lineupSheet(lang: Lang, width: number, height: number): string {
  const ext = LINEUP_IDS.map((id) => extentKm(id));
  const badge = 4.4;
  const reachKm = ext.reduce((total, e) => total + e, 0);
  const rows = 2;
  const pitch = LABEL_MM * 1.5;
  const factsFor = (k: number): Block => facts(lineupFacts(lang, k), width, 0, false);
  const tall = (k: number): number => 2 * BODIES.jupiter.radiusKm * k;
  // the gaps keep the numbers apart, then the rest of the width is shared
  const gapsAt = (k: number): number[] => ext.slice(1).map((e, i) => Math.max(3, 2 * badge + 2 - ((ext[i]! + e) * k) / 2));
  let k = (width - 2 * badge - 3 * (ext.length - 1)) / reachKm;
  for (let pass = 0; pass < 6; pass += 1) {
    const spare = width - 2 * badge - reachKm * k - gapsAt(k).reduce((t, g) => t + g, 0);
    if (spare < 0) k += spare / reachKm;
  }
  k = Math.min(k, (height - factsFor(k).height - rows * pitch - 2 * badge - 12) / tall(1));
  const gaps = gapsAt(k);
  const extra = (width - 2 * badge - reachKm * k - gaps.reduce((t, g) => t + g, 0)) / gaps.length;
  const axis = tall(k) / 2 + OUTLINE_MM / 2;
  const badgeY = axis + tall(k) / 2 + 3 + badge;
  const out: string[] = [];
  let x = badge;
  LINEUP_IDS.forEach((id, i) => {
    const extent = ext[i]! * k;
    const cx = x + extent / 2;
    const r = BODIES[id].radiusKm * k;
    const thick = r * 2 >= 24 ? OUTLINE_MM : Math.max(1, Math.min(OUTLINE_MM, r / 4));
    out.push(colouringArt(id, cx, axis, r, thick));
    out.push(`<path d="M${n(cx)} ${n(axis + (reach(id, sheetPose(id)).y * BODIES[id].radiusKm * k) + 1.5)}L${n(cx)} ${n(badgeY - badge)}" fill="none" stroke="#000" stroke-width="0.8" stroke-linecap="round" data-leader=""/>`);
    out.push(`<circle cx="${n(cx)}" cy="${n(badgeY)}" r="${badge}" fill="#000" data-badge="${i + 1}"/>`, `<text x="${n(cx)}" y="${n(badgeY + BODY_MM * 0.36)}" font-size="${n(BODY_MM)}" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>`);
    x += extent + (gaps[i] ?? 0) + extra;
  });
  const legendTop = badgeY + badge + 8;
  const columns = LINEUP_IDS.length / rows;
  const cell = width / columns;
  LINEUP_IDS.forEach((id, i) => {
    const column = i % columns;
    const row = Math.floor(i / columns);
    const y = legendTop + row * pitch + LABEL_MM;
    out.push(`<circle cx="${n(column * cell + badge)}" cy="${n(y - LABEL_MM * 0.33)}" r="${badge}" fill="#000"/>`, `<text x="${n(column * cell + badge)}" y="${n(y - LABEL_MM * 0.33 + BODY_MM * 0.36)}" font-size="${n(BODY_MM)}" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text>`);
    out.push(text(column * cell + 2 * badge + 2, y, LABEL_MM, kidsSay(id, lang), ' data-planet-name=""'));
  });
  const block = factsFor(k);
  out.push(`<g transform="translate(0 ${n(height - block.height)})">${block.markup}</g>`);
  return out.join("");
}

/**
 * One sheet as an SVG string measured in millimetres: the picture of the body, the colours to colour it with and three facts, in English or Japanese; or the lineup of all the planets at one scale. `widthMm` and
 * `heightMm` are the room it is drawn for (`kidsRoom`), and the viewBox is that room, so a millimetre is a millimetre on paper.
 * @param id - A body with a sheet, or `lineup`.
 * @param options - The room, and the language.
 * @returns The `<svg>` markup.
 *
 * @example
 * ```ts
 * import { kidsRoom, kidsSvg } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * const room = kidsRoom("a4");
 * console.log(kidsSvg("saturn", { ...room, lang: "en" }).includes("Colour me!"));
 * ```
 */
export function kidsSvg(id: KidsSheet, options: { widthMm: number; heightMm: number; lang?: Lang }): string {
  const lang = options.lang ?? "en";
  const { widthMm: w, heightMm: h } = options;
  const label = id === "lineup" ? SAY[lang].lineup : kidsName(id, lang);
  const inner = id === "lineup" ? lineupSheet(lang, w, h) : bodySheet(id, lang, w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}" data-kids-sheet="${id}" font-family="inherit"><title>${esc(label)}</title>${inner}</svg>`;
}

export { KIDS_BODIES };
