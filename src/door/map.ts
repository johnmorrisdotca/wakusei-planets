// The map sources of the data door: the finer map tiles of a body as a `TileSource`. The package's own folder of tiles is one (`tilesSource`, what the `tiles` attribute means), and a caller's source of the same shape
// takes its place for a body. The pyramid is the package's: level L is `2048 * 2^L` pixels across in 512 pixel tiles, column 0 at longitude -180 and row 0 at latitude 90 (see `scene/tiles.ts`), and a tile's key ends
// in `level/column/row`. Pure apart from the `fetch` and `createImageBitmap` a source is given or finds: no DOM, no three.js.
import type { BodyId } from "../facts.ts";
import type { ImageTile, MapPlace, TileSource } from "../data-door.ts";
import { BASE_WIDTH, parseManifest, TILE_SIZE, type TileLevel, type TileManifest } from "../scene/tiles.ts";
import { OWN_BY_ID, madeHere } from "./own.ts";

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
/** A tile's own edge is not the next tile: places are measured to a billionth of a tile. */
const EDGE = 1e-9;

/**
 * What a map source draws: `colour` is the picture of the body's surface; `height` is its relief, which the package does not draw yet (the type is the door it will come through).
 *
 * @example
 * ```ts
 * import type { MapLayer } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const layers: MapLayer[] = ["colour", "height"];
 * console.log(layers.join(", "));
 * ```
 */
export type MapLayer = "colour" | "height";

/**
 * The place a map source is asked about: the family's `MapPlace` in degrees (longitude from `lonMin` to `lonMax`, which may pass 180 and is at most a whole turn, latitude from `latMin` to `latMax`), and the body it is for.
 *
 * @example
 * ```ts
 * import type { BodyMapPlace } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const place: BodyMapPlace = { lonMin: 170, lonMax: 190, latMin: -10, latMax: 10, body: "mars" };
 * console.log(place.body);
 * ```
 */
export type BodyMapPlace = MapPlace & { body?: string };

/**
 * A source of a body's map in tiles, for the colour of its surface or for its height: a `TileSource` of the family's map shape (the place is a `MapPlace`, the detail is the pixels across the whole circumference, a tile is an
 * `ImageTile`) that says which `body` and `layer` it is for. A `body` of `"*"` is every body of a folder (the place then names the one, in `place.body`, and the keys start with its name). The keys a source returns end in
 * `level/column/row` on the package's pyramid. `levels` says which levels the source has when that has to be asked (a folder's manifest); left out, levels 1 to 3.
 *
 * @example
 * ```ts
 * import type { BodyMapSource } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const bodies = (sources: readonly BodyMapSource[]): string[] => sources.map((source) => `${source.body}:${source.layer}`);
 * console.log(bodies([]));
 * ```
 */
export type BodyMapSource = TileSource<BodyMapPlace, number, ImageTile> & {
  body: BodyId | "*";
  layer: MapLayer;
  levels?(body: string, signal: AbortSignal): readonly TileLevel[] | undefined | Promise<readonly TileLevel[] | undefined>;
};

/**
 * The levels a source has when it does not say: the three the package's cutter makes at most.
 *
 * @example
 * ```ts
 * import { DEFAULT_LEVELS } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(DEFAULT_LEVELS.map((level) => level.width));
 * ```
 */
export const DEFAULT_LEVELS: readonly TileLevel[] = [1, 2, 3].map((level) => {
  const width = BASE_WIDTH * 2 ** level;
  return { level, width, height: width / 2, columns: width / TILE_SIZE, rows: width / 2 / TILE_SIZE };
});

const KEY_END = /(\d+)\/(\d+)\/(\d+)$/;

/**
 * The level, column and row a tile key ends in, or `undefined` for a key that does not end in three numbers.
 *
 * @param key - The tile's key.
 * @returns Where the tile is in the pyramid, or `undefined` for a key that does not end in three numbers.
 *
 * @example
 * ```ts
 * import { tileKeyParts } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(tileKeyParts("mars/3/12/5"));
 * ```
 */
export function tileKeyParts(key: string): { level: number; col: number; row: number } | undefined {
  const found = KEY_END.exec(key);
  return found === null ? undefined : { level: Number(found[1]), col: Number(found[2]), row: Number(found[3]) };
}

/**
 * The keys of the tiles that cover a place at a detail, on the package's pyramid: the level is the lowest whose width is at least `detail` pixels round (or the finest there is), and the tiles are every one the place touches.
 * Pure. A source of your own can build its `need` on it.
 *
 * @param place - The part of the map, in degrees.
 * @param detail - The pixels across the whole circumference wanted.
 * @param levels - The levels the source has, level 1 up; levels 1 to 3 where left out.
 * @param prefix - Put before each key (`"mars/"`), for a folder of several bodies.
 * @returns The keys, `[<prefix>]level/column/row`, row by row; none for a place with no area.
 *
 * @example
 * ```ts
 * import { mapKeys } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(mapKeys({ lonMin: -10, lonMax: 10, latMin: -5, latMax: 5 }, 8192));
 * ```
 */
export function mapKeys(place: MapPlace, detail: number, levels: readonly TileLevel[] = DEFAULT_LEVELS, prefix = ""): string[] {
  if (levels.length === 0 || !(place.lonMax > place.lonMin) || !(place.latMax >= place.latMin)) return [];
  const level = levels.find((one) => one.width >= detail) ?? levels[levels.length - 1]!;
  const { columns, rows } = level;
  const span = Math.min(TAU, (place.lonMax - place.lonMin) * RAD);
  const first = Math.floor(((place.lonMin * RAD) / TAU + 0.5) * columns + EDGE);
  const count = span >= TAU - 1e-9 ? columns : Math.min(columns, Math.ceil(((place.lonMin * RAD + span) / TAU + 0.5) * columns - EDGE) - first);
  const row0 = Math.max(0, Math.floor((0.5 - (place.latMax * RAD) / Math.PI) * rows + EDGE));
  const row1 = Math.min(rows, Math.max(row0 + 1, Math.ceil((0.5 - (place.latMin * RAD) / Math.PI) * rows - EDGE)));
  const keys: string[] = [];
  for (let row = row0; row < row1; row += 1) for (let i = 0; i < count; i += 1) keys.push(`${prefix}${level.level}/${(((first + i) % columns) + columns) % columns}/${row}`);
  return keys;
}

/**
 * What `tilesSource` takes.
 *
 * @example
 * ```ts
 * import type { TilesSourceOptions } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const options: TilesSourceOptions = { fetch: (url, init) => fetch(url, init) };
 * console.log(typeof options.fetch);
 * ```
 */
export interface TilesSourceOptions {
  /** The `fetch` to use: the global one where left out. It is called as `fetch(address, { mode: "cors", signal })`. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

const slash = (base: string): string => (base.endsWith("/") ? base : `${base}/`);
const RETRY_MS = 30_000;

// One manifest read for each folder of the page, shared by every element: a folder that could not be read is asked again only after a while, and only when a view wants more than the 2048 pixel map.
const manifests = new Map<string, { at: number; value: Promise<TileManifest | undefined> }>();

function readManifest(base: string, get: NonNullable<TilesSourceOptions["fetch"]>): Promise<TileManifest | undefined> {
  const now = performance.now();
  const held = manifests.get(base);
  if (held !== undefined && now - held.at < RETRY_MS) return held.value;
  const value = get(`${base}manifest.json`, { mode: "cors" }).then(
    async (response) => (response.ok ? parseManifest(await response.json().catch(() => undefined)) : undefined),
    () => undefined,
  );
  manifests.set(base, { at: now, value });
  return value;
}

/**
 * Forget what was read of the tile folders (for a test that serves different ones).
 *
 * @example
 * ```ts no-run
 * import { forgetManifests } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * forgetManifests();
 * ```
 */
export function forgetManifests(): void {
  manifests.clear();
}

/**
 * The package's own finer map tiles as a source: a folder with a `manifest.json` and a tile for each body, level and place at `<body>/<level>/<column>/<row>.webp` (made by `scripts/make-body-tiles.py`). This is what the
 * `tiles` attribute of an element means, and what a body with no source of yours is drawn from. It is for every body in the folder (`body: "*"`); the manifest says which levels each has, and it is read once, only when a view
 * wants more than the body's own 2048 pixel map. Its `id` is `wakusei-tiles`, and a view counts it as the package's own data.
 *
 * @param base - The folder's address, with or without the closing slash.
 * @param options - The `fetch` to use.
 * @returns The source.
 *
 * @example
 * ```ts no-run
 * import { tilesSource } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const mine = tilesSource("/tiles/");
 * console.log(mine.need({ lonMin: 0, lonMax: 20, latMin: 0, latMax: 10, body: "mars" }, 8192));
 * ```
 */
export function tilesSource(base: string, options: TilesSourceOptions = {}): BodyMapSource {
  const folder = slash(base);
  const get = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const source: BodyMapSource = {
    kind: "tiles",
    body: "*",
    layer: "colour",
    info: OWN_BY_ID.get("wakusei-tiles")!,
    need(place, detail) {
      const body = place.body;
      if (typeof body !== "string" || body === "") throw new RangeError("a folder of tiles is asked for a place with its body");
      return mapKeys(place, detail, DEFAULT_LEVELS, `${body}/`);
    },
    async levels(body) {
      const manifest = await readManifest(folder, get);
      return manifest?.bodies[body];
    },
    async load(key, signal) {
      if (tileKeyParts(key) === undefined) throw new RangeError(`"${key}" is not the key of a tile`);
      const response = await get(`${folder}${key}.webp`, { mode: "cors", signal });
      if (!response.ok) throw new Error(`The tile ${key} could not be fetched (${response.status})`);
      const image = await createImageBitmap(await response.blob());
      return { width: image.width > 0 ? image.width : TILE_SIZE, height: image.height > 0 ? image.height : TILE_SIZE, image };
    },
    bytes: (tile) => imageBytes(tile),
  };
  madeHere(source);
  return source;
}

/**
 * What a decoded picture holds in memory, with its mipmaps (4/3 of its bytes): the `bytes` of a map source.
 *
 * @param tile - The tile.
 * @returns Bytes.
 *
 * @example
 * ```ts
 * import { imageBytes } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(imageBytes({ width: 512, height: 512, image: { width: 512, height: 512 } }));
 * ```
 */
export function imageBytes(tile: ImageTile): number {
  return Math.ceil(tile.width * tile.height * 4 * (4 / 3));
}
