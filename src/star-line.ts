// A star as a line drawing: the Sun's outline drawing with this star's size, shape, cells and spots, and the Sun and two orbits drawn round it, so the size can be read against what we know. Pure: one SVG string.
import { portrait } from "./pose.ts";
import { bodyGroup, mix, NAVY, type Frame, type LineOptions } from "./line.ts";
import { starLook, type StarLook, type StarNumbers } from "./star.ts";

/** What a star's size is drawn beside: the Sun, the Earth's orbit and Jupiter's orbit, in solar radii (one astronomical unit is 215.03). */
const RINGS: readonly { ratio: number; en: string; ja: string }[] = [
  { ratio: 1, en: "Sun", ja: "太陽" },
  { ratio: 215.03, en: "Earth's orbit", ja: "地球の軌道" },
  { ratio: 1118, en: "Jupiter's orbit", ja: "木星の軌道" },
];

const n = (v: number): string => (Math.round(v * 100) / 100).toString();
const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A star as a line drawing, as an SVG string: its outline (squeezed when it is oblate), its cells and spots as outlines, a ring of rays, and, drawn round it, the Sun's size and the orbits of the Earth and Jupiter
 * wherever they fall in the picture, so the size can be read against what we know. A caption under it gives the radius, the temperature and the class. It takes the options of `lineSvg` (the size, `pose`, `fill`, `zoom`,
 * `pan`, `lang` and the colours); a picture of a star with no `pose` is a portrait of the Sun's axis.
 *
 * @param star - The star's numbers, or a star already made with `starLook`.
 * @param options - The drawing's size, pose and colours.
 * @returns The SVG markup, `<svg ...>` to `</svg>`.
 *
 * @example
 * ```ts
 * import { starLineSvg } from "@johnmorrisdotca/wakusei-planets";
 *
 * const svg = starLineSvg({ name: "Betelgeuse", temperatureK: 3600, radiusSun: 760, luminosityClass: "Ia" }, { size: 320 });
 * console.log(svg.startsWith("<svg"), svg.includes("Earth's orbit"));
 * ```
 */
export function starLineSvg(star: StarNumbers | StarLook, options: LineOptions = {}): string {
  const made = "look" in star ? star : starLook(star);
  const size = options.size ?? 320;
  const lang = options.lang ?? "en";
  const stroke = options.stroke ?? mix(made.tone, "#ffffff", 0.3);
  const paper = options.paper ?? mix(made.tone, NAVY, 0.7);
  const hair = Math.max(0.6, size / 320);
  const pose = options.pose ?? portrait("sun", options);
  const fit = options.fill === undefined ? 0.94 / 1.08 : options.fill;
  const zoom = options.zoom ?? 1;
  const frame: Frame = { cx: (size / 2) * (1 - (options.panX ?? 0)), cy: (size / 2) * (1 + (options.panY ?? 0)), r: (size / 2) * fit * zoom };
  const label = lang === "ja" ? `${made.facts.name.ja}の線画 (数字から描いた絵)` : `Line drawing of ${made.facts.name.en}, drawn from its numbers`;
  const rings: string[] = [];
  for (const ring of RINGS) {
    const r = (ring.ratio / made.radiusSun) * frame.r;
    // the star's own edge is drawn already; a ring too small to see or far outside the picture is left out
    if (Math.abs(ring.ratio / made.radiusSun - 1) < 0.04 || r < 3 || r > size * 1.5) continue;
    const text = lang === "ja" ? ring.ja : ring.en;
    const x = frame.cx + r * Math.SQRT1_2;
    const y = frame.cy + r * Math.SQRT1_2;
    rings.push(
      `<circle cx="${n(frame.cx)}" cy="${n(frame.cy)}" r="${n(r)}" fill="none" stroke="${stroke}" stroke-opacity="0.5" stroke-width="${n(hair)}" stroke-dasharray="${n(hair * 4)} ${n(hair * 4)}"/>` +
        (x < size - 4 && y < size - 14 ? `<text x="${n(x)}" y="${n(y)}" font-size="${n(size / 38)}" fill="${stroke}" fill-opacity="0.85" font-family="system-ui,sans-serif">${escape(text)}</text>` : ""),
    );
  }
  const radius = made.radiusSun >= 10 ? Math.round(made.radiusSun).toLocaleString("en-US") : String(Number(made.radiusSun.toPrecision(3)));
  const caption = lang === "ja" ? `太陽の${radius}倍 · ${Math.round(made.temperatureK).toLocaleString("en-US")} K · ${made.luminosityClass}` : `${radius} × Sun · ${Math.round(made.temperatureK).toLocaleString("en-US")} K · ${made.luminosityClass}`;
  const text = `<text x="${n(size / 2)}" y="${n(size - size / 40)}" text-anchor="middle" font-size="${n(size / 34)}" fill="${stroke}" fill-opacity="0.85" font-family="system-ui,sans-serif">${escape(caption)}</text>`;
  const group = bodyGroup("sun", pose, frame, { stroke, paper }, hair, 1, made.facts, `wk-star-${[...made.key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title>${rings.join("")}${group}${text}</svg>`;
}
