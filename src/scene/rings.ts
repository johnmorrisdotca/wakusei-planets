// A ring system as a strip of colour and opacity from its inner edge to its outer, for the shader to read by radius. Pure: no three.js, no canvas.
import type { BodyFacts } from "../facts.ts";

/**
 * The strip of a body's rings: RGBA bytes `width` pixels across, and the inner and outer radii in body radii.
 *
 * @example
 * ```ts
 * import { BODIES, ringStrip, type RingStrip } from "@johnmorrisdotca/wakusei-planets";
 *
 * const strip: RingStrip | null = ringStrip(BODIES.saturn, 64);
 * console.log(strip?.data.length);
 * ```
 */
export interface RingStrip {
  data: Uint8Array;
  width: number;
  inner: number;
  outer: number;
}

const PALETTE: Record<string, readonly [readonly number[], readonly number[]]> = {
  saturn: [[104, 86, 66], [243, 230, 200]],
  uranus: [[58, 62, 66], [150, 158, 162]],
};

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ripple = (x: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  return hash(i) * (1 - f) + hash(i + 1) * f;
};

/**
 * The strip of a body's rings, made from its ring bands: where each band is it stops light and has its tone, with fine ringlets in it and soft edges.
 *
 * @param facts - A body that has rings.
 * @param width - The strip's width in pixels. Default 1024.
 * @returns The RGBA bytes with the inner and outer radii in body radii, or `null` for a body with no rings.
 *
 * @example
 * ```ts
 * import { BODIES, ringStrip } from "@johnmorrisdotca/wakusei-planets";
 *
 * const strip = ringStrip(BODIES.saturn, 256);
 * console.log(strip?.width, strip?.inner.toFixed(2), strip?.outer.toFixed(2));
 * ```
 */
export function ringStrip(facts: BodyFacts, width = 1024): RingStrip | null {
  const bands = facts.rings;
  if (bands === undefined || bands.length === 0) return null;
  const from = Math.min(...bands.map((band) => band.from)) - 300;
  const to = Math.max(...bands.map((band) => band.to)) + 300;
  const [dark, light] = PALETTE[facts.id] ?? [[90, 90, 90], [170, 170, 170]];
  const data = new Uint8Array(width * 4);
  const km = (to - from) / width;
  for (let x = 0; x < width; x += 1) {
    const r = from + (x + 0.5) * km;
    let alpha = 0;
    let tone = 0;
    let weight = 0;
    for (const band of bands) {
      const soft = Math.max(km * 1.2, 120);
      const inside = smooth(band.from - soft, band.from + soft, r) * (1 - smooth(band.to - soft, band.to + soft, r));
      if (inside <= 0) continue;
      const fine = 0.78 + 0.22 * ripple(r / 380) + 0.12 * (ripple(r / 90) - 0.5);
      alpha += inside * band.alpha * Math.min(1.15, fine);
      tone += inside * band.tone * (0.9 + 0.2 * ripple(r / 650 + 7));
      weight += inside;
    }
    const t = weight > 0 ? Math.min(1, tone / weight) : 0;
    data[x * 4] = Math.round(dark![0]! + (light![0]! - dark![0]!) * t);
    data[x * 4 + 1] = Math.round(dark![1]! + (light![1]! - dark![1]!) * t);
    data[x * 4 + 2] = Math.round(dark![2]! + (light![2]! - dark![2]!) * t);
    data[x * 4 + 3] = Math.round(Math.min(1, alpha) * 255);
  }
  return { data, width, inner: from / facts.radiusKm, outer: to / facts.radiusKm };
}
