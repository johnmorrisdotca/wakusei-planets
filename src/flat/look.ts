// The two looks of the flat map, as numbers: the photo (the body's own painted picture) and the line map (the same picture turned into a few dark tones with a line where one tone meets the next), the widths of the pictures a body has, and the short credit.
// Pure: no DOM. The element reads the picture's pixels and hands them here.
import type { FlatBodyId } from "./bodies.ts";

/**
 * The two looks of the flat map: `photo`, the real surface picture the package already holds for the body, and `map`, a line map drawn from that same picture (dark tones, a line where one tone meets the next, a grid, the names).
 *
 * @example
 * ```ts
 * import { FLAT_LOOKS } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(FLAT_LOOKS.join(" / "));
 * ```
 */
export const FLAT_LOOKS = ["map", "photo"] as const;

/**
 * A look of the flat map.
 *
 * @example
 * ```ts
 * import type { FlatLook } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const look: FlatLook = "map";
 * console.log(look);
 * ```
 */
export type FlatLook = (typeof FLAT_LOOKS)[number];

/**
 * Read a `look` attribute. `map` and `photo` (any case) are themselves; anything else, and no attribute, is `photo`, the picture the element has always drawn.
 * (chikyu-earth's `<chikyu-flat>` starts on `map`: there the picture is new. Here it is the existing look, and a page that does not ask for the map changes in nothing.)
 *
 * @param value - The attribute's text, or null.
 * @returns The look.
 *
 * @example
 * ```ts
 * import { readLook } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(readLook("Map"), readLook(null), readLook("sepia"));
 * ```
 */
export function readLook(value: string | null | undefined): FlatLook {
  return value !== null && value !== undefined && value.trim().toLowerCase() === "map" ? "map" : "photo";
}

/**
 * The widths of the pictures the package holds for a body, smallest first: 1024 and 2048 pixels, and for Europa 1024 only.
 *
 * @param body - The body.
 * @returns The widths.
 *
 * @example
 * ```ts
 * import { pictureWidths } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(pictureWidths("mars"), pictureWidths("europa"));
 * ```
 */
export const pictureWidths = (body: FlatBodyId): readonly number[] => (body === "europa" ? [1024] : [1024, 2048]);

/**
 * The picture a view needs: the narrowest width that has a pixel for each one the world is across on the screen, or the widest the body has.
 *
 * @param body - The body.
 * @param pixelsAcross - How many device pixels 360 degrees of longitude is across.
 * @returns The width in pixels.
 *
 * @example
 * ```ts
 * import { pictureWidth } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(pictureWidth("mars", 900), pictureWidth("mars", 3000), pictureWidth("europa", 3000));
 * ```
 */
export function pictureWidth(body: FlatBodyId, pixelsAcross: number): number {
  const widths = pictureWidths(body);
  return widths.find((one) => one >= pixelsAcross) ?? widths[widths.length - 1]!;
}

/** The names the short credit gives, by body: a part of what `NOTICE.md` names, short enough for one small line. */
const WHO: Readonly<Record<FlatBodyId, string>> = {
  mercury: "Shady Tex",
  venus: "NASA",
  earth: "NASA",
  moon: "NASA",
  mars: "NASA / USGS",
  phobos: "USGS",
  deimos: "USGS",
  ceres: "NASA",
  vesta: "NASA",
  jupiter: "Nestaeric",
  io: "NASA",
  europa: "U.S. Geological Survey",
  ganymede: "USGS",
  callisto: "USGS",
  saturn: "Solar System Scope",
  mimas: "NASA",
  enceladus: "NASA",
  tethys: "NASA",
  dione: "NASA",
  rhea: "NASA",
  titan: "NASA",
  iapetus: "NASA",
  phoebe: "NASA",
  uranus: "NestaEric",
  neptune: "Solar System Scope",
  triton: "NASA",
  pluto: "NASA",
  charon: "NASA",
};

/**
 * Whose picture a body's map is, in a few words for one small line: `NASA / USGS` for Mars, `Nestaeric` for Jupiter. The whole credit is `picturesCredit`.
 *
 * @param body - The body.
 * @returns The names.
 *
 * @example
 * ```ts
 * import { creditWho } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(creditWho("mars"), "|", creditWho("jupiter"));
 * ```
 */
export const creditWho = (body: FlatBodyId): string => WHO[body];

/** The bodies whose picture is CC BY 4.0, as `NOTICE.md` has it (the unit tests hold this to `PICTURE_CREDITS`); every other picture is public domain. */
const CC_BY: readonly FlatBodyId[] = ["mercury", "jupiter", "saturn", "uranus", "neptune"];

/**
 * The licence of a body's picture, in a language, for the credit line: `public domain` or `CC BY 4.0`.
 *
 * @param body - The body.
 * @param lang - `en` or `ja`.
 * @returns The licence's name.
 *
 * @example
 * ```ts
 * import { creditLicence } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(creditLicence("mars", "en"), "|", creditLicence("mars", "ja"), "|", creditLicence("jupiter", "en"));
 * ```
 */
export function creditLicence(body: FlatBodyId, lang: "en" | "ja"): string {
  return CC_BY.includes(body) ? "CC BY 4.0" : lang === "ja" ? "パブリックドメイン" : "public domain";
}

/**
 * A tone of the line map as red, green and blue, each 0 to 255.
 *
 * @example
 * ```ts
 * import type { Tone } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const night: Tone = [4, 8, 20];
 * console.log(night.join(","));
 * ```
 */
export type Tone = readonly [number, number, number];

/**
 * The darkest tone of the line map: the dark sea and ground tone the lines and the marks lie on. A page changes it with `--wakusei-flat-sea`.
 *
 * @example
 * ```ts
 * import { MAP_SEA } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(MAP_SEA.join(","));
 * ```
 */
export const MAP_SEA: Tone = [27, 51, 88];

/**
 * The lightest tone of the line map. A page changes it with `--wakusei-flat-land`.
 *
 * @example
 * ```ts
 * import { MAP_LAND } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(MAP_LAND.join(","));
 * ```
 */
export const MAP_LAND: Tone = [118, 158, 198];

/**
 * The colour of the line where one tone meets the next, as red, green, blue and how opaque it is (0 to 1). A page changes the colour with `--wakusei-flat-line`.
 *
 * @example
 * ```ts
 * import { MAP_LINE } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(MAP_LINE.join(","));
 * ```
 */
export const MAP_LINE: readonly [number, number, number, number] = [214, 230, 248, 0.5];

/**
 * How many tones the line map has.
 *
 * @example
 * ```ts
 * import { MAP_TONES } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(MAP_TONES);
 * ```
 */
export const MAP_TONES = 5;

/**
 * The tones of the line map: `count` colours from `sea` (the darkest ground of the picture) to `land` (the lightest), evenly between.
 *
 * @param sea - The darkest tone.
 * @param land - The lightest tone.
 * @param count - How many tones.
 * @returns The tones, darkest first.
 *
 * @example
 * ```ts
 * import { MAP_LAND, MAP_SEA, toneRamp } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(toneRamp(MAP_SEA, MAP_LAND, 3).map((tone) => tone.join(",")).join(" | "));
 * ```
 */
export function toneRamp(sea: Tone, land: Tone, count = MAP_TONES): Tone[] {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return [Math.round(sea[0] + (land[0] - sea[0]) * t), Math.round(sea[1] + (land[1] - sea[1]) * t), Math.round(sea[2] + (land[2] - sea[2]) * t)] as const;
  });
}

/** A box blur of a picture's brightness: round a row (it wraps at the seam, as longitude does) and down a column (it stops at the poles), twice, which is close to a Gaussian. */
function blur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const size = 2 * radius + 1;
  let from = values;
  let to = new Float32Array(values.length);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += from[row + ((k + width) % width)]!;
      for (let x = 0; x < width; x += 1) {
        to[row + x] = sum / size;
        sum += from[row + ((x + radius + 1) % width)]! - from[row + ((x - radius + width * 2) % width)]!;
      }
    }
    const next = new Float32Array(values.length);
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += to[Math.min(height - 1, Math.max(0, k)) * width + x]!;
      for (let y = 0; y < height; y += 1) {
        next[y * width + x] = sum / size;
        sum += to[Math.min(height - 1, y + radius + 1) * width + x]! - to[Math.max(0, y - radius) * width + x]!;
      }
    }
    from = next;
    to = new Float32Array(values.length);
  }
  return from;
}

/**
 * Where one tone ends and the next begins: the brightnesses (0 to 255) that cut a picture's pixels into `bands` groups of the same number of pixels each, so the darkest fifth of a body is the darkest tone whatever its colour.
 *
 * @param brightness - Each pixel's brightness, 0 to 255.
 * @param bands - How many tones.
 * @returns `bands - 1` brightnesses, lowest first.
 *
 * @example
 * ```ts
 * import { bandEdges } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(bandEdges([0, 10, 20, 30, 40, 50, 60, 70, 80, 90], 5));
 * ```
 */
export function bandEdges(brightness: ArrayLike<number>, bands: number): number[] {
  const bins = new Uint32Array(256);
  for (let i = 0; i < brightness.length; i += 1) bins[Math.max(0, Math.min(255, Math.round(brightness[i]!)))]! += 1;
  const edges: number[] = [];
  let seen = 0;
  let bin = 0;
  for (let b = 1; b < bands; b += 1) {
    const target = (brightness.length * b) / bands;
    while (bin < 255 && seen + bins[bin]! < target) {
      seen += bins[bin]!;
      bin += 1;
    }
    edges.push(bin);
  }
  return edges;
}

/**
 * The line map of a picture: the picture's brightness, smoothed, cut into tones of equal area (`ramp`, darkest first), with a line in `line` along every place a tone meets the next. The same picture, so the map has the same shapes, and nothing new is fetched.
 * Darkness is the picture's own, so on Mars the dark regions are the darkest tone and on the Moon the maria; on a gas giant the bands.
 *
 * @param pixels - The picture's pixels, 4 bytes each (red, green, blue, alpha), a row at a time, as `ImageData` has them.
 * @param width - The picture's width.
 * @param height - The picture's height.
 * @param ramp - The tones, darkest first; five by default (`toneRamp(MAP_SEA, MAP_LAND)`).
 * @param line - The line's colour and how opaque it is.
 * @returns The new picture in the same layout, every pixel opaque.
 *
 * @example
 * ```ts
 * import { toneMap } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const grey = new Uint8ClampedArray(8 * 2 * 4);
 * for (let i = 0; i < 16; i += 1) grey.set([i * 16, i * 16, i * 16, 255], i * 4);
 * const out = toneMap(grey, 8, 2);
 * console.log(out.length, out[3]);
 * ```
 */
export function toneMap(pixels: ArrayLike<number>, width: number, height: number, ramp: readonly Tone[] = toneRamp(MAP_SEA, MAP_LAND), line: readonly [number, number, number, number] = MAP_LINE): Uint8ClampedArray<ArrayBuffer> {
  const n = width * height;
  const brightness = new Float32Array(n);
  for (let i = 0; i < n; i += 1) brightness[i] = 0.299 * pixels[i * 4]! + 0.587 * pixels[i * 4 + 1]! + 0.114 * pixels[i * 4 + 2]!;
  const smooth = blur(brightness, width, height, Math.max(1, Math.round(width / 512)));
  const edges = bandEdges(smooth, ramp.length);
  const band = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const value = Math.round(smooth[i]!);
    let b = 0;
    while (b < edges.length && value >= edges[b]!) b += 1;
    band[i] = b;
  }
  const out = new Uint8ClampedArray(n * 4);
  const [lr, lg, lb, la] = line;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const tone = ramp[band[i]!]!;
      // a line where the next pixel to the right (round the seam) or below is another tone
      const edge = band[y * width + ((x + 1) % width)] !== band[i] || (y + 1 < height && band[i + width] !== band[i]);
      const o = i * 4;
      out[o] = edge ? Math.round(tone[0] + (lr - tone[0]) * la) : tone[0];
      out[o + 1] = edge ? Math.round(tone[1] + (lg - tone[1]) * la) : tone[1];
      out[o + 2] = edge ? Math.round(tone[2] + (lb - tone[2]) * la) : tone[2];
      out[o + 3] = 255;
    }
  }
  return out;
}
