// The maths of the finer map tiles, with no browser and no three.js: which part of a body's surface is in view, which pyramid level the zoom needs, and which tiles make the window of
// picture that is laid over the body's 2048 pixel map. Pure. A tile set is made by `scripts/make-body-tiles.py`: level L is `2048 * 2^L` pixels across in 512 pixel tiles, `2^(L+2)` columns by
// `2^(L+1)` rows, column 0 at longitude -180 and row 0 at latitude 90, a tile at `<body>/<level>/<column>/<row>.webp`. Level 0 is the 2048 pixel map itself and is not cut.
import type { Vec3 } from "../vec.ts";

/** The side of a tile in pixels. */
export const TILE_SIZE = 512;
/** The width of the package's own map, the pyramid's level 0. */
export const BASE_WIDTH = 2048;
/** The most tiles in a window of picture (a 2048 pixel square, or 4096 by 1024 round a pole) and the most along one side: the graphics memory a window takes is about 22 MB. */
export const WINDOW_TILES = 16;
export const WINDOW_SIDE = 8;
/** How much larger than a device pixel a texel may be before the next level is wanted: 1.25 is a quarter larger. */
export const TEXEL_SLACK = 1.25;

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/** One level of a body's pyramid, from the manifest. */
export interface TileLevel {
  level: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
}

/** What a tile set says it holds: the levels of each body (level 1 and up). */
export interface TileManifest {
  tileSize: number;
  bodies: Record<string, TileLevel[]>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const whole = (value: unknown, min: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= min;

/**
 * Read a tile set's `manifest.json`. A manifest that is not the shape this reads, or whose tile size is not the one the loader cuts windows for, is `undefined`: the bodies are then drawn from their own pictures.
 *
 * @param value - The parsed JSON.
 * @returns The manifest, or `undefined`.
 */
export function parseManifest(value: unknown): TileManifest | undefined {
  if (!isRecord(value) || value["tileSize"] !== TILE_SIZE || !isRecord(value["bodies"])) return undefined;
  const bodies: Record<string, TileLevel[]> = {};
  for (const [id, entry] of Object.entries(value["bodies"])) {
    if (!isRecord(entry) || !Array.isArray(entry["levels"])) continue;
    const levels: TileLevel[] = [];
    for (const item of entry["levels"]) {
      if (!isRecord(item)) continue;
      const { level, width, height, columns, rows } = item;
      if (!whole(level, 1) || !whole(width, TILE_SIZE) || !whole(height, TILE_SIZE) || !whole(columns, 1) || !whole(rows, 1)) continue;
      if (width !== BASE_WIDTH * 2 ** level || height !== width / 2 || columns !== width / TILE_SIZE || rows !== height / TILE_SIZE) continue;
      levels.push({ level, width, height, columns, rows });
    }
    levels.sort((a, b) => a.level - b.level);
    if (levels.length > 0) bodies[id] = levels;
  }
  return { tileSize: TILE_SIZE, bodies };
}

/** The part of the surface in view: longitude from `lonMin` to `lonMax` (radians, not wrapped, so `lonMax - lonMin` is the width, at most a whole turn) and latitude from `latMin` to `latMax`. */
export interface Region {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

/** A body's axes in the view: the three directions its east, pole and prime meridian point in (unit vectors, x right, y up, z toward the viewer), and the lengths of its semi-axes in the same order, in radii. */
export interface Axes {
  east: Vec3;
  pole: Vec3;
  meridian: Vec3;
  scale: Vec3;
}

/** The orthographic camera's box, in radii from the body's centre. */
export interface ViewBox {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wrapPi = (a: number): number => a - TAU * Math.floor((a + Math.PI) / TAU);
const SAMPLES = 17;

/**
 * The longitudes and latitudes of the body's surface that the camera's box shows: the front of the globe is sampled on a grid and round the limb, each point turned into the body's own frame,
 * and the two poles are looked for separately (a pole in view means every longitude is). The region is a little too large rather than too small.
 *
 * @param box - The camera's box.
 * @param axes - The body's axes in the view.
 * @param pad - The margin added all round, as a fraction of the region (and at least two degrees when it is not 0). Default 0.06.
 * @returns The region, or `undefined` when the box shows none of the disc.
 */
export function visibleRegion(box: ViewBox, axes: Axes, pad = 0.06): Region | undefined {
  const lons: number[] = [];
  const lats: number[] = [];
  const mx = (box.left + box.right) / 2;
  const my = (box.bottom + box.top) / 2;
  let nearest = Infinity;
  let ref = 0;
  const take = (x: number, y: number): void => {
    const r2 = x * x + y * y;
    if (r2 > 1) return;
    const w: Vec3 = [x, y, Math.sqrt(1 - r2)];
    const pm = dot(axes.meridian, w) / axes.scale[2];
    const pe = dot(axes.east, w) / axes.scale[0];
    const pp = dot(axes.pole, w) / axes.scale[1];
    const length = Math.hypot(pm, pe, pp) || 1;
    const lon = Math.atan2(pe, pm);
    // the middle longitude is the one of the sample nearest the middle of the box, so a spread across the antimeridian is measured from there
    const d = (x - mx) * (x - mx) + (y - my) * (y - my);
    if (d < nearest) {
      nearest = d;
      ref = lon;
    }
    lons.push(lon);
    lats.push(Math.asin(Math.max(-1, Math.min(1, pp / length))));
  };
  for (let i = 0; i < SAMPLES; i += 1) {
    for (let j = 0; j < SAMPLES; j += 1) take(box.left + ((box.right - box.left) * i) / (SAMPLES - 1), box.bottom + ((box.top - box.bottom) * j) / (SAMPLES - 1));
  }
  // the limb: where the box cuts the edge of the disc, and the edge inside the box
  for (let k = 0; k < 64; k += 1) {
    const a = (k / 64) * TAU;
    const x = Math.cos(a) * 0.999;
    const y = Math.sin(a) * 0.999;
    if (x >= box.left && x <= box.right && y >= box.bottom && y <= box.top) take(x, y);
  }
  // the points where the box's own edges cross the disc (a box that cuts the disc without a grid point on it near the edge)
  for (const x of [box.left, box.right]) {
    const half = Math.sqrt(Math.max(0, 1 - x * x));
    if (Math.abs(x) < 1) for (const y of [-half * 0.999, half * 0.999]) if (y >= box.bottom && y <= box.top) take(x, y);
  }
  for (const y of [box.bottom, box.top]) {
    const half = Math.sqrt(Math.max(0, 1 - y * y));
    if (Math.abs(y) < 1) for (const x of [-half * 0.999, half * 0.999]) if (x >= box.left && x <= box.right) take(x, y);
  }
  if (lons.length === 0) return undefined;

  let lo = Infinity;
  let hi = -Infinity;
  for (const lon of lons) {
    const rel = wrapPi(lon - ref);
    if (rel < lo) lo = rel;
    if (rel > hi) hi = rel;
  }
  let latMin = Math.min(...lats);
  let latMax = Math.max(...lats);
  // a pole in the box: its point is on the front of the disc (it faces the viewer) and inside the box
  let polar = false;
  for (const sign of [1, -1]) {
    const px = axes.pole[0] * axes.scale[1] * sign;
    const py = axes.pole[1] * axes.scale[1] * sign;
    const pz = axes.pole[2] * sign;
    if (pz > 0 && px >= box.left && px <= box.right && py >= box.bottom && py <= box.top) {
      polar = true;
      if (sign > 0) latMax = Math.PI / 2;
      else latMin = -Math.PI / 2;
    }
  }
  let lonMin = ref + lo;
  let lonMax = ref + hi;
  if (polar || hi - lo > TAU * 0.98) {
    lonMin = ref - Math.PI;
    lonMax = ref + Math.PI;
  }
  // a margin, so a small turn or pan does not at once leave the window
  const padLon = pad > 0 ? Math.max(2 * RAD, (lonMax - lonMin) * pad) : 0;
  const padLat = pad > 0 ? Math.max(2 * RAD, (latMax - latMin) * pad) : 0;
  if (lonMax - lonMin < TAU) {
    const spread = Math.min(TAU, lonMax - lonMin + 2 * padLon);
    const middle = (lonMin + lonMax) / 2;
    lonMin = middle - spread / 2;
    lonMax = middle + spread / 2;
  }
  return { lonMin, lonMax, latMin: Math.max(-Math.PI / 2, latMin - padLat), latMax: Math.min(Math.PI / 2, latMax + padLat) };
}

/** A window of picture: tiles of one level, `cols` across starting at column `col0` (the columns wrap round the far edge) and `rows` down from row `row0`. */
export interface TileWindow {
  level: number;
  col0: number;
  cols: number;
  row0: number;
  rows: number;
  columns: number;
  rowsTotal: number;
}

/** The window of a level that holds the region, or `undefined` when it would be more tiles than a window may hold. */
export function windowOf(level: TileLevel, region: Region): TileWindow | undefined {
  const { columns, rows: rowsTotal } = level;
  const full = region.lonMax - region.lonMin >= TAU - 1e-9;
  let col0 = 0;
  let cols = columns;
  if (!full) {
    const u0 = (region.lonMin / TAU + 0.5) * columns;
    const u1 = (region.lonMax / TAU + 0.5) * columns;
    const first = Math.floor(u0);
    cols = Math.min(columns, Math.ceil(u1) - first);
    col0 = ((first % columns) + columns) % columns;
  }
  const r0 = Math.max(0, Math.floor((0.5 - region.latMax / Math.PI) * rowsTotal));
  const r1 = Math.min(rowsTotal, Math.ceil((0.5 - region.latMin / Math.PI) * rowsTotal));
  const rows = Math.max(1, r1 - r0);
  if (cols * rows > WINDOW_TILES || cols > WINDOW_SIDE || rows > WINDOW_SIDE) return undefined;
  return { level: level.level, col0, cols, row0: Math.min(r0, rowsTotal - rows), rows, columns, rowsTotal };
}

/**
 * The window the view needs: the lowest level whose texels are no wider than a device pixel (a quarter wider, `TEXEL_SLACK`), or the finest there is, brought down to the finest level whose
 * window fits. `undefined` when the body's own 2048 pixel map is sharp enough, or no level has a window that fits.
 *
 * @param region - The part of the surface in view.
 * @param levels - The body's levels, level 1 up.
 * @param radiansPixels - Device pixels along one radian of the body at the middle of the view.
 * @returns The window, or `undefined`.
 */
export function chooseWindow(region: Region, levels: readonly TileLevel[], radiansPixels: number): TileWindow | undefined {
  if (levels.length === 0 || !(radiansPixels > 0)) return undefined;
  const need = radiansPixels / TEXEL_SLACK;
  if (BASE_WIDTH / TAU >= need) return undefined;
  const wanted = levels.findIndex((l) => l.width / TAU >= need);
  for (let i = wanted === -1 ? levels.length - 1 : wanted; i >= 0; i -= 1) {
    const window = windowOf(levels[i]!, region);
    if (window !== undefined) return window;
  }
  return undefined;
}

/** The window's place on the map, for the shader: `u0` the map's longitude coordinate of its west edge (0 to 1), `du` its width, `vTop` the latitude coordinate of its north edge (1 is the north pole) and `dv` its height. */
export function windowRect(window: TileWindow): { u0: number; du: number; vTop: number; dv: number } {
  return { u0: window.col0 / window.columns, du: window.cols / window.columns, vTop: 1 - window.row0 / window.rowsTotal, dv: window.rows / window.rowsTotal };
}

/** The tiles of a window, with where each goes in the window's picture (`x`, `y` in pixels from its top left). */
export function windowTiles(window: TileWindow): { level: number; col: number; row: number; x: number; y: number }[] {
  const out: { level: number; col: number; row: number; x: number; y: number }[] = [];
  for (let j = 0; j < window.rows; j += 1) {
    for (let i = 0; i < window.cols; i += 1) out.push({ level: window.level, col: (window.col0 + i) % window.columns, row: window.row0 + j, x: i * TILE_SIZE, y: j * TILE_SIZE });
  }
  return out;
}

/** `layer/level/column/row` as the tile's path under the tile set (without the `.webp`). */
export const tilePath = (body: string, tile: { level: number; col: number; row: number }): string => `${body}/${tile.level}/${tile.col}/${tile.row}`;

/** True when the region lies inside the window (the window is then still the right one for the view, whatever else changed). */
export function covers(window: TileWindow, region: Region): boolean {
  const need = region.lonMax - region.lonMin;
  const width = (window.cols / window.columns) * TAU;
  if (window.cols < window.columns) {
    const start = (window.col0 / window.columns - 0.5) * TAU;
    const shift = ((((region.lonMin - start) % TAU) + TAU) % TAU);
    // a region that starts a hair before the window's edge is a turn later
    const inside = shift + need <= width + 1e-9;
    if (!inside) return false;
  }
  const north = (0.5 - window.row0 / window.rowsTotal) * Math.PI;
  const south = (0.5 - (window.row0 + window.rows) / window.rowsTotal) * Math.PI;
  return region.latMax <= north + 1e-9 && region.latMin >= south - 1e-9;
}

/** The angle one texel of a level covers, in radians along the equator (`2 pi / width`). */
export const texelAngle = (width: number): number => TAU / width;
