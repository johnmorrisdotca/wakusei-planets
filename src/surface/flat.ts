// The ground of a site that has no height model yet: flat at the site's datum, in memory, with nothing to fetch. It is a stand-in and says so; it carries no relief of its own and no made detail.
import type { HeightLevel, TerrainManifest } from "./height.ts";
import type { Terrain } from "./load.ts";
import type { SurfaceSite } from "./site.ts";

/** The mean radii the heights are measured from, in metres: the Moon's from LRO (1737.4 km, as the tiles of `make-moon-terrain.py`), Mars's the IAU mean (NASA's fact sheet, 3389.5 km). */
const RADIUS = { moon: 1_737_400, mars: 3_389_500 } as const;
const TILE = 256;

/** The extent each level covers, as a half side in metres: the four levels of a measured site (5 m a sample over 8 tiles, 20 m, 80 m, and the far ground at 480 m over 4), here one tile each at a wider step. */
const LEVELS = [
  { id: "h5", half: 5120 },
  { id: "h20", half: 20_480 },
  { id: "h80", half: 81_920 },
  { id: "far", half: 245_760 },
] as const;

/**
 * The manifest of a flat stand-in for a site: the same shape as a measured site's, with one tile to a level (the ground does not change, so a wider step costs nothing), no picture and no baked horizon, and the ground
 * at the datum (height 0). Its credit and accuracy lines say it is not measured.
 *
 * @param site - A site (any, though only a `flat` one is drawn from it).
 * @returns The manifest.
 *
 * @example
 * ```ts
 * import { flatManifest, siteById } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const manifest = flatManifest(siteById("perseverance")!);
 * console.log(manifest.body, manifest.radius, manifest.levels.length, manifest.accuracy);
 * ```
 */
export function flatManifest(site: SurfaceSite): TerrainManifest {
  return {
    version: 1,
    body: site.body,
    site: site.id,
    name: site.name,
    lat: site.lat,
    lon: site.lon,
    radius: RADIUS[site.body],
    tile: TILE,
    height: { min: 0, range: 1 },
    ground: 0,
    levels: LEVELS.map((level) => ({ id: level.id, res: (2 * level.half) / TILE, tiles: 1, half: level.half })),
    picture: null,
    horizon: null,
    credit: "no height model for this site yet",
    accuracy: "ground: flat stand-in until height data is added; nothing on it is measured",
  };
}

/**
 * The terrain of a flat stand-in, whole at once with nothing fetched: every level is the datum.
 *
 * @param site - The site.
 * @returns The terrain, as `loadTerrain` gives it (`complete` is already settled, no bytes were fetched).
 *
 * @example
 * ```ts
 * import { flatTerrain, groundAt, siteById } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const terrain = flatTerrain(siteById("curiosity")!);
 * console.log(terrain.bytes, groundAt(terrain.levels, terrain.manifest.height, 120, -40));
 * ```
 */
export function flatTerrain(site: SurfaceSite): Terrain {
  const manifest = flatManifest(site);
  const levels: HeightLevel[] = manifest.levels.map((info) => ({ ...info, size: TILE, data: new Uint8Array(TILE * TILE * 4) }));
  return { manifest, levels, pictures: [], horizons: [], bytes: 0, firstBytes: 0, complete: Promise.resolve() };
}
