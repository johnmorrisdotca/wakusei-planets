// The Moon's measured heights at a site, as the tile pyramid `scripts/make-moon-terrain.py` makes: square levels centred on the landing point, each a grid of 16 bit heights, the finest
// first. Pure: no DOM; the decoding of a picture into bytes is the loader's (`load.ts`).

/**
 * One level of a site's pyramid, as the manifest says it.
 *
 * @example
 * ```ts
 * import { type HeightLevelInfo } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const info: HeightLevelInfo = { id: "h5", res: 5, tiles: 4, half: 512 };
 * console.log(`${info.id}: ${info.tiles} x ${info.tiles} tiles, ${info.res} m apart, reaching ${info.half} m each way`);
 * ```
 */
export interface HeightLevelInfo {
  /** The level's name: `h5`, `h20`, `h80`, `far`. */
  id: string;
  /** Metres between two samples. */
  res: number;
  /** Tiles across (and down). */
  tiles: number;
  /** Half the level's width in metres: the square reaches this far east, west, north and south of the site. */
  half: number;
  /** The range the level's heights are encoded over, where it is not the manifest's (the coarse level reaches over mountains and basins the site's range cannot hold). */
  height?: { min: number; range: number };
}

/**
 * What a site's `manifest.json` holds.
 *
 * @example
 * ```ts
 * import { type TerrainManifest } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const manifest: TerrainManifest = {
 *   version: 1, body: "moon", site: "apollo-17", name: { en: "Apollo 17", ja: "アポロ17号" },
 *   lat: 20.1911, lon: 30.7723, radius: 1_737_400, tile: 256, height: { min: -2000, range: 4000 }, ground: -1930,
 *   levels: [{ id: "h5", res: 5, tiles: 4, half: 512 }], credit: "made for this example", accuracy: "to the metre",
 * };
 * console.log(`${manifest.name.en}: ${manifest.levels.length} level, ${manifest.height.range} m of range`);
 * ```
 */
export interface TerrainManifest {
  version: 1;
  body: "moon";
  site: string;
  name: { en: string; ja: string };
  /** Where the viewer stands: planetocentric degrees. */
  lat: number;
  lon: number;
  /** The body's radius in metres, the sphere the heights are measured from. */
  radius: number;
  /** Samples across a tile. */
  tile: number;
  /** A height is `min + value / 65535 * range`, in metres from the sphere. */
  height: { min: number; range: number };
  /** The height of the ground at the site, in metres. */
  ground: number;
  levels: readonly HeightLevelInfo[];
  /** The ground picture, where the site has one: levels on the same grids as the first of the height levels, its credit and the Sun the mosaic was lit by (fitted to the heights; divided out). */
  picture?: { levels: readonly HeightLevelInfo[]; credit: string; sun: { azimuth: number; elevation: number; correlation: number } } | null;
  /** The measured ground's shadows, baked: for each of the first three levels a picture of `cells` x `cells` cells by `sectors / 3` slabs side by side, three directions to a slab (red, green, blue), the elevation angle of the horizon in each, 8 bits over `from` to `to` degrees. */
  horizon?: { cells: number; sectors: number; from: number; to: number; levels: readonly { id: string; file: string }[] } | null;
  /** The tiles' file type: `png` where it is left out (the made-up sites of the tests), `webp` (lossless, bit for bit the same heights in a third less) for the real ones. */
  format?: "png" | "webp";
  /** The credit the page says beside the picture. */
  credit: string;
  /** How well the heights are known, in words, for the line the page shows. */
  accuracy: string;
}

/**
 * The bytes of one level: `size` x `size` samples of four bytes (red high, green low), row 0 at the north edge.
 *
 * @example
 * ```ts
 * import { type HeightLevel } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const level: HeightLevel = { id: "h5", res: 5, tiles: 1, half: 10, size: 4, data: new Uint8Array(4 * 4 * 4) };
 * console.log(`${level.size} x ${level.size} samples, ${level.data.length} bytes`);
 * ```
 */
export interface HeightLevel extends HeightLevelInfo {
  size: number;
  data: Uint8Array;
}

/**
 * The address of a tile: `<base><site>/terrain/<level>/<column>/<row>.webp` (`.png` where the manifest has no `format`), with `base` ending in a slash and the site's body in front (`moon/apollo-17`).
 *
 * @param base - The folder the tiles are served from.
 * @param manifest - The site's manifest.
 * @param level - A level's name.
 * @param column - From the west edge, 0 first.
 * @param row - From the north edge, 0 first.
 * @returns The address.
 *
 * @example
 * ```ts
 * import { tileAddress, type TerrainManifest } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const manifest = { body: "moon", site: "apollo-17" } as TerrainManifest;
 * console.log(tileAddress("tiles/", manifest, "h5", 3, 4));
 * ```
 */
export function tileAddress(base: string, manifest: Pick<TerrainManifest, "body" | "site" | "format">, level: string, column: number, row: number): string {
  return `${base.endsWith("/") ? base : `${base}/`}${manifest.body}/${manifest.site}/terrain/${level}/${column}/${row}.${manifest.format ?? "png"}`;
}

/**
 * An empty level, ready to be filled tile by tile: every height the lowest the encoding holds until a tile says otherwise.
 *
 * @param info - The level as the manifest says it.
 * @param tile - Samples across a tile.
 * @returns The level with its bytes all zero.
 *
 * @example
 * ```ts
 * import { emptyLevel } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const level = emptyLevel({ id: "h5", res: 5, tiles: 2, half: 20 }, 4);
 * console.log(`${level.size} x ${level.size} samples, ${level.data.length} bytes`);
 * ```
 */
export function emptyLevel(info: HeightLevelInfo, tile: number): HeightLevel {
  const size = info.tiles * tile;
  return { ...info, size, data: new Uint8Array(size * size * 4) };
}

/**
 * Put one decoded tile (RGBA, `tile` x `tile`) into its place in a level.
 *
 * @param level - The level being filled.
 * @param tile - Samples across a tile.
 * @param column - The tile's column from the west edge.
 * @param row - The tile's row from the north edge.
 * @param rgba - The tile's bytes, row by row.
 */
export function placeTile(level: HeightLevel, tile: number, column: number, row: number, rgba: Uint8Array | Uint8ClampedArray): void {
  for (let y = 0; y < tile; y += 1) {
    const from = y * tile * 4;
    level.data.set(rgba.subarray(from, from + tile * 4), ((row * tile + y) * level.size + column * tile) * 4);
  }
}

/**
 * A height in metres from the two bytes the tiles hold.
 *
 * @param high - The high byte, from the red of a pixel.
 * @param low - The low byte, from the green of a pixel.
 * @param height - The manifest's height encoding.
 * @returns The height in metres from the sphere.
 *
 * @example
 * ```ts
 * import { decodeHeight } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(decodeHeight(128, 0, { min: -2000, range: 4000 }).toFixed(1));
 * ```
 */
export const decodeHeight = (high: number, low: number, height: TerrainManifest["height"]): number => height.min + ((high * 256 + low) / 65535) * height.range;

/**
 * One level's height at a point in metres east and north of the site, bilinear, or `undefined` where the point is outside the level.
 *
 * @param level - The level to read.
 * @param height - The manifest's height encoding (the level's own, where it has one, is used instead).
 * @param x - Metres east of the site.
 * @param y - Metres north of the site.
 * @returns The height in metres from the sphere, or `undefined` outside the level.
 *
 * @example
 * ```ts
 * import { sampleLevel } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const height = { min: -2000, range: 4000 };
 * const level = { id: "h5", res: 5, tiles: 1, half: 10, size: 4, data: new Uint8Array(4 * 4 * 4) };
 * for (let i = 0; i < 16; i += 1) level.data[i * 4] = 128; // every sample 128 * 256 / 65535 of the range up
 *
 * console.log(sampleLevel(level, height, 0, 0)?.toFixed(2), sampleLevel(level, height, 100, 0));
 * ```
 */
export function sampleLevel(level: HeightLevel, height: TerrainManifest["height"], x: number, y: number): number | undefined {
  const fx = (x + level.half) / level.res - 0.5;
  const fy = (level.half - y) / level.res - 0.5;
  if (fx < 0 || fy < 0 || fx > level.size - 1.001 || fy > level.size - 1.001) return undefined;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const at = (ix: number, iy: number): number => {
    const i = (iy * level.size + ix) * 4;
    return decodeHeight(level.data[i]!, level.data[i + 1]!, level.height ?? height);
  };
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * The ground's height at a point, from the finest level that holds it.
 *
 * @param levels - The levels, finest first.
 * @param height - The manifest's height encoding.
 * @param x - Metres east of the site.
 * @param y - Metres north of the site.
 * @returns The height in metres from the sphere, or `undefined` outside every level.
 *
 * @example
 * ```ts
 * import { groundAt } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const height = { min: -2000, range: 4000 };
 * const level = { id: "h5", res: 5, tiles: 1, half: 10, size: 4, data: new Uint8Array(4 * 4 * 4) };
 * for (let i = 0; i < 16; i += 1) level.data[i * 4] = 128;
 *
 * console.log(groundAt([level], height, 0, 0)?.toFixed(2), groundAt([level], height, 100, 0));
 * ```
 */
export function groundAt(levels: readonly HeightLevel[], height: TerrainManifest["height"], x: number, y: number): number | undefined {
  for (const level of levels) {
    const h = sampleLevel(level, height, x, y);
    if (h !== undefined) return h;
  }
  return undefined;
}

/**
 * How far the ground at `distance` metres falls away from a plane tangent at the viewer's feet: the Moon is round.
 *
 * @param distance - Metres from the viewer.
 * @param radius - The body's radius in metres.
 * @returns The fall in metres.
 *
 * @example
 * ```ts
 * import { drop } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * console.log(drop(1000, 1_737_400).toFixed(3));
 * ```
 */
export const drop = (distance: number, radius: number): number => (distance * distance) / (2 * radius);

/**
 * Fill the tiles of a level that have not arrived yet from a coarser level, so the ground is whole at once and gets finer as the real tiles come: heights are resampled (bilinear) from the coarser
 * level's samples and written in this level's own encoding; a picture is resampled from its grey. The tiles named by `skip` (those that have arrived) are left alone.
 *
 * @param level - The finer level, filled in place.
 * @param coarse - A coarser level, centred on the same site and holding every point of `level`.
 * @param tile - Samples across a tile.
 * @param skip - True for a tile that is already real: its column and row.
 * @param encoding - For heights, the encodings (the manifest's height or a level's own) of the coarse level and of this one; for a picture, `"grey"`.
 *
 * @example
 * ```ts
 * import { emptyLevel, fillFromCoarser } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const encoding = { min: 0, range: 1000 };
 * const coarse = emptyLevel({ id: "h20", res: 20, tiles: 1, half: 40 }, 4);
 * for (let i = 0; i < 16; i += 1) coarse.data[i * 4] = 128; // every sample about half way up the range
 * const fine = emptyLevel({ id: "h5", res: 5, tiles: 1, half: 10 }, 4);
 * fillFromCoarser(fine, coarse, 4, () => false, { from: encoding, to: encoding });
 * console.log(fine.data[0], fine.data[3]);
 * ```
 */
export function fillFromCoarser(
  level: HeightLevel,
  coarse: HeightLevel,
  tile: number,
  skip: (column: number, row: number) => boolean,
  encoding: { from: { min: number; range: number }; to: { min: number; range: number } } | "grey",
): void {
  const n = coarse.size;
  const colCell = new Int32Array(level.size);
  const colFrac = new Float32Array(level.size);
  const rowCell = new Int32Array(level.size);
  const rowFrac = new Float32Array(level.size);
  for (let i = 0; i < level.size; i += 1) {
    const x = (i + 0.5) * level.res - level.half;
    const fx = Math.min(Math.max((x + coarse.half) / coarse.res - 0.5, 0), n - 1.001);
    colCell[i] = Math.floor(fx);
    colFrac[i] = fx - colCell[i]!;
    const fy = Math.min(Math.max((coarse.half - (level.half - (i + 0.5) * level.res)) / coarse.res - 0.5, 0), n - 1.001);
    rowCell[i] = Math.floor(fy);
    rowFrac[i] = fy - rowCell[i]!;
  }
  const grey = encoding === "grey";
  const fromMin = grey ? 0 : encoding.from.min;
  const fromSpan = grey ? 0 : encoding.from.range / 65535;
  const toMin = grey ? 0 : encoding.to.min;
  const toScale = grey ? 0 : 65535 / encoding.to.range;
  const src = coarse.data;
  const value = (ix: number, iy: number): number => {
    const i = (iy * n + ix) * 4;
    return grey ? src[i]! : fromMin + (src[i]! * 256 + src[i + 1]!) * fromSpan;
  };
  for (let row = 0; row < level.tiles; row += 1) {
    for (let column = 0; column < level.tiles; column += 1) {
      if (skip(column, row)) continue;
      for (let y = row * tile; y < (row + 1) * tile; y += 1) {
        const y0 = rowCell[y]!;
        const ty = rowFrac[y]!;
        for (let x = column * tile; x < (column + 1) * tile; x += 1) {
          const x0 = colCell[x]!;
          const tx = colFrac[x]!;
          const top = value(x0, y0) * (1 - tx) + value(x0 + 1, y0) * tx;
          const bottom = value(x0, y0 + 1) * (1 - tx) + value(x0 + 1, y0 + 1) * tx;
          const v = top * (1 - ty) + bottom * ty;
          const o = (y * level.size + x) * 4;
          if (grey) {
            const g = Math.round(v);
            level.data[o] = g;
            level.data[o + 1] = g;
            level.data[o + 2] = g;
          } else {
            const code = Math.min(65535, Math.max(0, Math.round((v - toMin) * toScale)));
            level.data[o] = code >> 8;
            level.data[o + 1] = code & 255;
            level.data[o + 2] = 0;
          }
          level.data[o + 3] = 255;
        }
      }
    }
  }
}
