// The plan as an SVG string: orbits as lines, each body a dot, the one marked ringed and named, a line saying which spacing it is. Light and dark come from CSS custom properties with defaults that follow the page's colour scheme.
// Pure: a plan in, a string out. A dot is `data-id`'d so the element can turn a press into the body's id.
import { BODIES, type BodyId } from "../facts.ts";
import { chooseLabels, type LabelBox } from "../space/labels.ts";
import { SPACECRAFT, type SpacecraftId } from "../spacecraft-facts.ts";
import type { Plan, PlanDot, PlanKind } from "./layout.ts";

/**
 * A language the plan's words can be in: `en` or `ja`.
 *
 * @example
 * ```ts
 * import type { PlanLang } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const lang: PlanLang = "ja";
 * console.log(lang);
 * ```
 */
export type PlanLang = "en" | "ja";

/**
 * The words a plan says besides names: its label for a screen reader and the line saying how distances are drawn.
 *
 * @example
 * ```ts
 * import type { PlanText } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const text: PlanText = { label: "The solar system from above", scale: "Squeezed (log) to 50 au" };
 * console.log(text.scale);
 * ```
 */
export interface PlanText {
  /** What the picture is, for a screen reader: "The solar system from above, Mars marked". */
  label: string;
  /** How distances are drawn and how far the edge is: "Squeezed (log) to 50 au". */
  scale: string;
}

/** What each language says. The plan's own words are a handful: the rest are each body's name from the package's facts. */
const WORDS = {
  en: {
    sun: (marked: string | undefined): string => `The solar system from above${marked === undefined ? "" : `, ${marked} marked`}`,
    moons: (planet: string, marked: string | undefined): string => `${planet}'s moons from above its north pole${marked === undefined ? "" : `, ${marked} marked`}`,
    squeezed: (reach: string): string => `Squeezed (log) to ${reach}`,
    true: (reach: string): string => `True scale to ${reach}`,
    au: "au",
    radii: (planet: string): string => `${planet} radii`,
  },
  ja: {
    sun: (marked: string | undefined): string => `真上から見た太陽系${marked === undefined ? "" : `(${marked}に印)`}`,
    moons: (planet: string, marked: string | undefined): string => `${planet}の北極の真上から見た衛星${marked === undefined ? "" : `(${marked}に印)`}`,
    squeezed: (reach: string): string => `対数で圧縮、縁は${reach}`,
    true: (reach: string): string => `実際の縮尺、縁は${reach}`,
    au: "au",
    radii: (planet: string): string => `${planet}半径`,
  },
} as const;

const nameOf = (id: string, lang: PlanLang): string => {
  const body = (BODIES as Readonly<Record<string, (typeof BODIES)[BodyId]>>)[id];
  if (body !== undefined) return body.name[lang];
  const craft = (SPACECRAFT as Readonly<Record<string, (typeof SPACECRAFT)[SpacecraftId]>>)[id];
  return craft === undefined ? id : craft.name[lang];
};

/**
 * What a body is called on the plan, in a language: its name from the package's facts, or a craft's from `/spacecraft`; any other id is returned as it is.
 *
 * @param id - A body's id.
 * @param lang - `en` or `ja`.
 * @returns The name.
 *
 * @example
 * ```ts
 * import { planName } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * console.log(planName("jupiter", "en"), planName("jupiter", "ja"), planName("voyager1", "en"));
 * ```
 */
export function planName(id: string, lang: PlanLang = "en"): string {
  return nameOf(id, lang);
}

/** A distance for the scale line: whole, or one decimal below ten, with its unit. */
const reachOf = (plan: Plan, lang: PlanLang): string => {
  const words = WORDS[lang];
  const n = plan.extent;
  const text = n >= 100 ? n.toFixed(0) : Number(n.toFixed(n >= 10 ? 0 : 1)).toString();
  return plan.unit === "au" ? `${text} ${words.au}` : `${text} ${words.radii(nameOf(plan.system, lang))}`;
};

/**
 * The words a plan says besides names, in a language.
 *
 * @param plan - The plan.
 * @param lang - `en` or `ja`.
 * @returns The label for a screen reader and the scale line.
 *
 * @example
 * ```ts
 * import { planAt, planText } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const plan = planAt(Date.UTC(2026, 10, 11), { system: "jupiter", mark: "io", spacing: "true" });
 * console.log(planText(plan, "en"));
 * ```
 */
export function planText(plan: Plan, lang: PlanLang = "en"): PlanText {
  const words = WORDS[lang];
  const marked = plan.marked === undefined ? undefined : nameOf(plan.marked, lang);
  return {
    label: plan.system === "sun" ? words.sun(marked) : words.moons(nameOf(plan.system, lang), marked),
    scale: words[plan.spacing === "true" ? "true" : "squeezed"](reachOf(plan, lang)),
  };
}

/**
 * How a plan is drawn: the picture's side in pixels, the language of the names, whether names show, and a prefix for the ids inside the SVG (two plans on one page need two).
 *
 * @example
 * ```ts
 * import type { PlanDrawOptions } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const options: PlanDrawOptions = { size: 240, lang: "en", names: true };
 * console.log(options.size);
 * ```
 */
export interface PlanDrawOptions {
  /** The picture's side in CSS pixels. Default 240. */
  size?: number;
  /** Default `en`. */
  lang?: PlanLang;
  /** Whether names are written beside the dots (the marked body's is always written). Default true. */
  names?: boolean;
  /** Prefixes the ids inside the SVG. Default `wp`. */
  id?: string;
}

const STYLE = [
  // The colours: the page may set --wakusei-plan-* itself; the defaults are the family's inks and follow light and dark.
  "svg{display:block;width:100%;height:100%;font:10px/12px system-ui,-apple-system,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;--wp-ink:var(--wakusei-plan-ink,light-dark(#1f2320,#ece8dc));--wp-muted:var(--wakusei-plan-muted,light-dark(#6b6f68,#a09d93));--wp-line:var(--wakusei-plan-line,light-dark(#b9b3a3,#4a4e48));--wp-sun:var(--wakusei-plan-sun,light-dark(#c98f00,#e0b43b));--wp-dot:var(--wakusei-plan-dot,light-dark(#2f5d4a,#8fd1b0));--wp-mark:var(--wakusei-plan-mark,light-dark(#b5452c,#ff8a65))}",
  ".o{fill:none;stroke:var(--wp-line);stroke-width:1}.om{fill:none;stroke:var(--wp-mark);stroke-width:1.5}",
  ".d{fill:var(--wp-dot)}.dm{fill:var(--wp-mark)}.s{fill:var(--wp-sun)}.ring{fill:none;stroke:var(--wp-mark);stroke-width:1.5}",
  ".t{fill:var(--wp-ink);paint-order:stroke;stroke:light-dark(#fbf8f1,#1d201e);stroke-width:3px;stroke-linejoin:round}.tm{font-weight:700;fill:var(--wp-mark)}.sc{fill:var(--wp-muted);font-size:9px}",
  ".hit{fill:transparent;cursor:pointer}g[data-id]:focus-visible .ring{stroke-width:2.5}g[data-id]:focus{outline:none}g[data-id]:hover .hit+*{opacity:.8}",
].join("");

/** The pixels a dot is drawn with: the Sun and a planet at the middle are larger than a body going round. */
const radiusOf = (dot: PlanDot, centre: boolean): number => (centre ? 5 : dot.marked ? 4 : dot.kind === "planet" ? 2.8 : 2.2);
const RANK: Record<PlanKind, number> = { star: 1, planet: 2, "dwarf-planet": 3, spacecraft: 3, asteroid: 4, centaur: 4, comet: 4, moon: 3 };

const n2 = (n: number): string => (Math.round(n * 100) / 100).toString();

/** The width of a name in pixels, at 10 px type: a Japanese character is as wide as it is tall. */
const widthOf = (text: string): number => [...text].reduce((sum, ch) => sum + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 10 : 5.6), 0);

/** A name's box beside its dot: to the right and a little above, or to the left when it would run off the picture, and kept inside it. */
function boxFor(id: string, text: string, x: number, y: number, size: number, offset: number, rank: number): LabelBox {
  const width = widthOf(text);
  const height = 12;
  let left = x + offset;
  if (left + width > size - 2) left = x - offset - width;
  left = Math.max(2, Math.min(size - 2 - width, left));
  const top = Math.max(2, Math.min(size - 18 - height, y - height - 1));
  return { id, x: left, y: top, width, height, rank, size: 0 };
}

/**
 * The plan as an SVG string, for a square of `size` pixels: the orbit lines, the Sun or planet at the middle, a dot for each body (the marked one larger, ringed and named), the names that do not overlap, and a line at the foot
 * saying how distances are drawn. Each body is a `<g data-id>` with a `role="button"`, so a page can turn a press into the body's id; the colours are CSS custom properties (`--wakusei-plan-ink`, `-muted`, `-line`, `-sun`, `-dot`, `-mark`)
 * that default to the family's and follow light and dark with the page's `color-scheme`.
 *
 * @param plan - The plan from `planAt`.
 * @param options - The size, the language and whether names show.
 * @returns The SVG text.
 *
 * @example
 * ```ts
 * import { planAt, planSvg } from "@johnmorrisdotca/wakusei-planets/plan";
 *
 * const svg = planSvg(planAt(Date.UTC(2026, 10, 11), { mark: "mars" }), { size: 240, lang: "en" });
 * console.log(svg.startsWith("<svg"), svg.includes('data-id="mars"'));
 * ```
 */
export function planSvg(plan: Plan, options: PlanDrawOptions = {}): string {
  const size = Math.max(120, Math.round(options.size ?? 240));
  const lang = options.lang ?? "en";
  const names = options.names !== false;
  const prefix = options.id ?? "wp";
  const text = planText(plan, lang);
  // the disc: a 4 px margin above, the scale line below
  const R = (size - 20) / 2;
  const cx = size / 2;
  const cy = 4 + R;
  const at = (x: number, y: number): [number, number] => [cx + x * R, cy - y * R];
  const path = (points: readonly (readonly [number, number])[]): string => points.map((p, i) => `${i === 0 ? "M" : "L"}${n2(cx + p[0] * R)} ${n2(cy - p[1] * R)}`).join("") + "Z";
  const clip = `${prefix}-clip`;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="group" aria-label="${esc(text.label)}"><style>${STYLE}</style>`);
  out.push(`<defs><clipPath id="${clip}"><circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(R + 1)}"/></clipPath></defs>`);
  out.push(`<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(R)}" fill="none" stroke="var(--wp-line)" stroke-width="1" stroke-dasharray="2 3"/>`);
  out.push(`<g clip-path="url(#${clip})">`);
  for (const orbit of plan.orbits) if (!orbit.marked && orbit.points.length > 1) out.push(`<path class="o" d="${path(orbit.points)}"/>`);
  for (const orbit of plan.orbits) if (orbit.marked && orbit.points.length > 1) out.push(`<path class="om" d="${path(orbit.points)}"/>`);
  out.push("</g>");

  // the middle, then the bodies, the marked one last so it lies on top
  const everyone = [{ dot: plan.centre, centre: true }, ...plan.dots.map((dot) => ({ dot, centre: false }))];
  const boxes: LabelBox[] = [];
  const scaleBox: LabelBox = { id: "\0scale", x: 2, y: size - 14, width: widthOf(text.scale) * 0.9, height: 12, rank: -1, size: 0 };
  boxes.push(scaleBox);
  for (const { dot, centre } of everyone) {
    const [x, y] = at(dot.x, dot.y);
    const wantName = dot.marked || names;
    if (wantName) boxes.push(boxFor(dot.id, nameOf(dot.id, lang), x, y, size, radiusOf(dot, centre) + 3, dot.marked ? 0 : RANK[dot.kind]));
  }
  const shown = chooseLabels(boxes);
  for (const { dot, centre } of everyone) {
    const [x, y] = at(dot.x, dot.y);
    const r = radiusOf(dot, centre);
    const name = nameOf(dot.id, lang);
    const colour = dot.marked ? "dm" : dot.kind === "star" ? "s" : "d";
    const shape = dot.kind === "spacecraft" ? `<rect class="${colour}" x="${n2(x - r)}" y="${n2(y - r)}" width="${n2(2 * r)}" height="${n2(2 * r)}" transform="rotate(45 ${n2(x)} ${n2(y)})"/>` : `<circle class="${colour}" cx="${n2(x)}" cy="${n2(y)}" r="${n2(r)}"/>`;
    const ring = dot.marked ? `<circle class="ring" cx="${n2(x)}" cy="${n2(y)}" r="${n2(r + 4)}"/>` : "";
    const box = boxes.find((one) => one.id === dot.id);
    const label = box !== undefined && shown.has(dot.id) ? `<text class="t${dot.marked ? " tm" : ""}" x="${n2(box.x)}" y="${n2(box.y + 10)}">${esc(name)}</text>` : "";
    out.push(`<g data-id="${esc(dot.id)}" data-kind="${dot.kind}"${dot.marked ? ' data-marked=""' : ""} role="button" tabindex="0" aria-label="${esc(name)}"><circle class="hit" cx="${n2(x)}" cy="${n2(y)}" r="11"/>${shape}${ring}${label}</g>`);
  }
  out.push(`<text class="sc" x="2" y="${size - 4}">${esc(text.scale)}</text></svg>`);
  return out.join("");
}

function esc(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
