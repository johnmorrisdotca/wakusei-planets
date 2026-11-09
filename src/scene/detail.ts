// A window of finer map laid over a body's 2048 pixel map: only the tiles in view, at the level the zoom needs, fetched a few at a time, put together into one picture (at most 16 tiles, a 2048 pixel square
// or 4096 by 1024 round a pole: about 22 MB of graphics memory with its mipmaps), freed a few seconds after the view no longer needs it. Nothing here draws: a window that is ready asks for one draw, and
// the draw's `apply` puts it on the body. three.js is passed in; nothing here imports it. See scripts/make-body-tiles.py for the tiles and docs/guides/close-zoom.md for the whole picture.
import type * as THREE from "three";
import { chooseWindow, covers, parseManifest, tilePath, visibleRegion, windowRect, windowTiles, TILE_SIZE, texelAngle, type Axes, type TileLevel, type TileManifest, type TileWindow, type ViewBox } from "./tiles.ts";

type Three = Pick<typeof THREE, "ClampToEdgeWrapping" | "DataTexture" | "LinearFilter" | "NoColorSpace">;

/** Milliseconds a window that the view no longer needs is kept (the view may come straight back) before its texture is freed. */
export const DETAIL_KEEP_MS = 4000;
/** Milliseconds a changed view must stay changed before a new window is fetched, so a drag or a pinch does not fetch what it passes. */
export const DETAIL_SETTLE_MS = 140;
/** Decoded tiles kept (about a megabyte each), those of the window first. */
export const DETAIL_TILES_KEPT = 48;
const RETRY_MS = 30_000;
const IN_FLIGHT = 6;

/** What a window is doing, for a page or a test. */
export interface DetailStats {
  /** A readable tile set was found (a body with levels in it, or not). */
  ready: boolean;
  /** The level the view wants now, or `null` when the body's own picture is sharp enough. */
  level: number | null;
  /** The level on the body now, or `null`. */
  shown: number | null;
  /** Tiles held decoded, and tiles being fetched. */
  held: number;
  loading: number;
  /** Tiles or windows that could not be made and are not tried again for a while. */
  failed: number;
  /** Tile fetches made. */
  requested: number;
  /** The width and height in pixels of the window's picture now, or 0. */
  pixels: number;
}

/** What a window gives the body when one is ready or let go: the picture and where it lies, or `null` for none. */
export interface DetailWindow {
  texture: THREE.Texture;
  /** `u0` the map coordinate of the west edge, `vTop` of the north edge, `du` and `dv` the size, all fractions of the map. */
  rect: { u0: number; du: number; vTop: number; dv: number };
  /** The softening at the window's edges as fractions of its size; 0 where the window meets a pole or goes right round. */
  fade: { u: number; v: number };
  /** The angle a texel of the window covers, in radians. */
  texel: number;
}

export interface DetailDeps {
  /** Where the tile set is, ending with a slash, or `undefined` for none. Read at every draw. */
  base: () => string | undefined;
  /** The body's name in the tile set. */
  body: string;
  /** Device pixels to a CSS pixel. */
  ratio: () => number;
  /** False on a device that should keep to the package's own pictures (little memory). */
  allowed: () => boolean;
  /** Ask for one draw. */
  redraw: () => void;
  /** Told when the tile set's levels for this body are known (`undefined` when it has none), so the zoom range can follow. */
  onLevels?: (levels: readonly TileLevel[] | undefined) => void;
  /** Put the window on the body, or take it off (`null`). */
  apply: (window: DetailWindow | null) => void;
  now?: () => number;
}

export interface Detail {
  /** Called at each draw with where the camera is and the body's axes. */
  sync(box: ViewBox, axes: Axes, viewWidth: number): void;
  readonly stats: DetailStats;
  dispose(): void;
}

// One manifest read for each tile set of the page, shared by every element.
const manifests = new Map<string, { at: number; value: Promise<TileManifest | undefined> }>();

function readManifest(base: string, now: number): Promise<TileManifest | undefined> {
  const held = manifests.get(base);
  if (held !== undefined && now - held.at < RETRY_MS) return held.value;
  const value = fetch(`${base}manifest.json`, { mode: "cors" }).then(
    async (response) => (response.ok ? parseManifest(await response.json().catch(() => undefined)) : undefined),
    () => undefined,
  );
  manifests.set(base, { at: now, value });
  return value;
}

/** Forget what was read of the tile sets (for a test that serves different ones). */
export function forgetManifests(): void {
  manifests.clear();
}

interface Held {
  key: string;
  window: TileWindow;
  texture: THREE.Texture;
  canvas: HTMLCanvasElement;
}

const keyOf = (w: TileWindow): string => `${w.level}:${w.col0}:${w.cols}:${w.row0}:${w.rows}`;

/** Make the window of finer map for one body. */
export function createDetail(T: Three, deps: DetailDeps): Detail {
  const clock = deps.now ?? (() => performance.now());
  const cache = new Map<string, { bitmap: ImageBitmap; used: number }>();
  const inFlight = new Map<string, AbortController>();
  const failed = new Map<string, number>();
  let manifest: TileManifest | undefined;
  let manifestFor = "";
  let manifestAsked = false;
  let askedAt = 0;
  let levels: readonly TileLevel[] | undefined;
  let held: Held | undefined;
  let loading: { key: string; window: TileWindow } | undefined;
  let pending: { key: string; timer: ReturnType<typeof setTimeout> } | undefined;
  let freeTimer: ReturnType<typeof setTimeout> | undefined;
  let wantLevel: number | null = null;
  let requested = 0;
  let gone = false;
  // The Texture class of the three.js module the page handed over: `DataTexture` extends it, and a page's subset of three need not name it.
  const TextureClass = Object.getPrototypeOf(T.DataTexture) as new (image: unknown) => THREE.Texture;

  const forgetTiles = (keep: ReadonlySet<string>): void => {
    if (cache.size <= DETAIL_TILES_KEPT) return;
    const order = [...cache.entries()].filter(([k]) => !keep.has(k)).sort((a, b) => a[1].used - b[1].used);
    for (const [k, entry] of order) {
      if (cache.size <= DETAIL_TILES_KEPT) break;
      entry.bitmap.close();
      cache.delete(k);
    }
  };

  const release = (): void => {
    if (held === undefined) return;
    held.texture.dispose();
    held.canvas.width = 0;
    held.canvas.height = 0;
    held = undefined;
  };

  const cancelPending = (): void => {
    if (pending !== undefined) clearTimeout(pending.timer);
    pending = undefined;
  };

  const cancelLoading = (): void => {
    for (const controller of inFlight.values()) controller.abort();
    inFlight.clear();
    loading = undefined;
  };

  const install = (window: TileWindow): void => {
    const tiles = windowTiles(window);
    const canvas = document.createElement("canvas");
    canvas.width = window.cols * TILE_SIZE;
    canvas.height = window.rows * TILE_SIZE;
    const context = canvas.getContext("2d");
    if (context === null) return;
    for (const tile of tiles) {
      const entry = cache.get(tilePath(deps.body, tile));
      if (entry === undefined) return;
      context.drawImage(entry.bitmap, tile.x, tile.y);
    }
    const texture = new TextureClass(canvas);
    texture.flipY = false;
    texture.wrapS = T.ClampToEdgeWrapping;
    texture.wrapT = T.ClampToEdgeWrapping;
    texture.magFilter = T.LinearFilter;
    texture.colorSpace = T.NoColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    const old = held;
    held = { key: keyOf(window), window, texture, canvas };
    const rect = windowRect(window);
    const full = window.cols >= window.columns;
    // a window that reaches a pole has no edge there: its rectangle goes a little past the pole and the picture is clamped
    const northPole = window.row0 === 0;
    const southPole = window.row0 + window.rows >= window.rowsTotal;
    const grow = 0.06 * rect.dv;
    const vTop = northPole ? rect.vTop + grow : rect.vTop;
    const dv = rect.dv + (northPole ? grow : 0) + (southPole ? grow : 0);
    deps.apply({
      texture,
      rect: { u0: rect.u0, du: rect.du, vTop, dv },
      fade: { u: full ? 0 : 0.03, v: northPole && southPole ? 0 : 0.03 },
      texel: texelAngle(window.columns * TILE_SIZE),
    });
    if (old !== undefined) {
      old.texture.dispose();
      old.canvas.width = 0;
      old.canvas.height = 0;
    }
    forgetTiles(new Set(tiles.map((t) => tilePath(deps.body, t))));
    deps.redraw();
  };

  const load = (window: TileWindow): void => {
    const key = keyOf(window);
    if (loading?.key === key) return;
    cancelLoading();
    loading = { key, window };
    const base = deps.base();
    if (base === undefined) return;
    const tiles = windowTiles(window).map((t) => ({ t, path: tilePath(deps.body, t) }));
    const todo = tiles.filter(({ path }) => !cache.has(path));
    for (const { path } of tiles) {
      const entry = cache.get(path);
      if (entry !== undefined) entry.used = clock();
    }
    const done = (): void => {
      if (gone || loading?.key !== key) return;
      if (tiles.every(({ path }) => cache.has(path))) {
        loading = undefined;
        install(window);
      }
    };
    if (todo.length === 0) {
      done();
      return;
    }
    let next = 0;
    const start = (): void => {
      while (inFlight.size < IN_FLIGHT && next < todo.length) {
        const { path } = todo[next]!;
        next += 1;
        const controller = new AbortController();
        inFlight.set(path, controller);
        requested += 1;
        void fetch(`${base}${path}.webp`, { mode: "cors", signal: controller.signal })
          .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
          .then((blob) => createImageBitmap(blob))
          .then(
            (bitmap) => {
              inFlight.delete(path);
              if (gone || loading?.key !== key) {
                bitmap.close();
                return;
              }
              cache.set(path, { bitmap, used: clock() });
              start();
              done();
            },
            (error: unknown) => {
              inFlight.delete(path);
              if (gone || (error instanceof DOMException && error.name === "AbortError")) return;
              // a tile that cannot be had spoils the window: leave the picture as it is and try again after a while
              failed.set(key, clock());
              cancelLoading();
            },
          );
      }
    };
    start();
  };

  const dropTiles = (): void => {
    for (const entry of cache.values()) entry.bitmap.close();
    cache.clear();
  };

  // not wanted any more (zoomed out, or out of sight): after a few seconds the picture and every decoded tile are let go
  const scheduleFree = (): void => {
    if ((held === undefined && cache.size === 0) || freeTimer !== undefined) return;
    freeTimer = setTimeout(() => {
      freeTimer = undefined;
      if (gone) return;
      cancelLoading();
      dropTiles();
      if (held === undefined) return;
      release();
      deps.apply(null);
      deps.redraw();
    }, DETAIL_KEEP_MS);
  };
  const cancelFree = (): void => {
    if (freeTimer !== undefined) clearTimeout(freeTimer);
    freeTimer = undefined;
  };

  const ask = (base: string): void => {
    if (manifestAsked && manifestFor === base && (manifest !== undefined || clock() - askedAt < RETRY_MS)) return;
    manifestAsked = true;
    manifestFor = base;
    askedAt = clock();
    void readManifest(base, clock()).then((read) => {
      if (gone || manifestFor !== base) return;
      manifest = read;
      levels = read?.bodies[deps.body];
      deps.onLevels?.(levels);
      if (levels !== undefined) deps.redraw();
    });
  };

  return {
    sync(box, axes, viewWidth) {
      if (gone) return;
      const base = deps.base();
      if (base === undefined || !deps.allowed()) {
        wantLevel = null;
        scheduleFree();
        return;
      }
      ask(base);
      if (levels === undefined) return;
      const region = visibleRegion(box, axes);
      const radiansPixels = (deps.ratio() * viewWidth) / Math.max(1e-9, box.right - box.left);
      const want = region === undefined ? undefined : chooseWindow(region, levels, radiansPixels);
      wantLevel = want?.level ?? null;
      if (want === undefined) {
        cancelPending();
        scheduleFree();
        return;
      }
      cancelFree();
      const inside = visibleRegion(box, axes, 0);
      if (held !== undefined && held.window.level >= want.level && inside !== undefined && covers(held.window, inside)) {
        cancelPending();
        return;
      }
      const key = keyOf(want);
      if (held?.key === key || loading?.key === key || pending?.key === key) return;
      const lastFailed = failed.get(key);
      if (lastFailed !== undefined && clock() - lastFailed < RETRY_MS) return;
      cancelPending();
      pending = {
        key,
        timer: setTimeout(() => {
          pending = undefined;
          if (!gone) load(want);
        }, DETAIL_SETTLE_MS),
      };
    },
    get stats() {
      return {
        ready: manifest !== undefined,
        level: wantLevel,
        shown: held?.window.level ?? null,
        held: cache.size,
        loading: inFlight.size,
        failed: failed.size,
        requested,
        pixels: held === undefined ? 0 : held.window.cols * TILE_SIZE * held.window.rows * TILE_SIZE,
      };
    },
    dispose() {
      gone = true;
      cancelPending();
      cancelLoading();
      cancelFree();
      release();
      dropTiles();
    },
  };
}
