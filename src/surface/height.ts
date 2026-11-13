// The Moon's measured heights at a site, as the tile pyramid `scripts/make-moon-terrain.py` makes: square levels centred on the landing point, each a grid of 16 bit heights, the finest
// first. Pure: no DOM; the decoding of a picture into bytes is the loader's (`load.ts`).

/** One level of a site's pyramid, as the manifest says it. */
export interface HeightLevelInfo {
  /** The level's name: `h5`, `h20`, `h80`, `far`. */
  id: string;
  /** Metres between two samples. */
  res: number;
  /** Tiles across (and down). */
  tiles: number;
  /** Half the level's width in metres: the square reaches this far east, west, north and south of the site. */
  half: number;
}

/** What a site's `manifest.json` holds. */
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
  /** The credit the page says beside the picture. */
  credit: string;
  /** How well the heights are known, in words, for the line the page shows. */
  accuracy: string;
}

/** The bytes of one level: `size` x `size` samples of four bytes (red high, green low), row 0 at the north edge. */
export interface HeightLevel extends HeightLevelInfo {
  size: number;
  data: Uint8Array;
}

/**
 * The address of a tile: `<base><site>/terrain/<level>/<column>/<row>.png`, with `base` ending in a slash and the site's body in front (`moon/apollo-17`).
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
export function tileAddress(base: string, manifest: Pick<TerrainManifest, "body" | "site">, level: string, column: number, row: number): string {
  return `${base.endsWith("/") ? base : `${base}/`}${manifest.body}/${manifest.site}/terrain/${level}/${column}/${row}.png`;
}

/** An empty level, ready to be filled tile by tile: every height the lowest the encoding holds until a tile says otherwise. */
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

/** A height in metres from the two bytes the tiles hold. */
export const decodeHeight = (high: number, low: number, height: TerrainManifest["height"]): number => height.min + ((high * 256 + low) / 65535) * height.range;

/** One level's height at a point in metres east and north of the site, bilinear, or `undefined` where the point is outside the level. */
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
    return decodeHeight(level.data[i]!, level.data[i + 1]!, height);
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
 */
export function groundAt(levels: readonly HeightLevel[], height: TerrainManifest["height"], x: number, y: number): number | undefined {
  for (const level of levels) {
    const h = sampleLevel(level, height, x, y);
    if (h !== undefined) return h;
  }
  return undefined;
}

/** How far the ground at `distance` metres falls away from a plane tangent at the viewer's feet: the Moon is round. */
export const drop = (distance: number, radius: number): number => (distance * distance) / (2 * radius);
