// A window of finer map laid over a body's 2048 pixel map: only the tiles in view, at the level the zoom needs, put together into one picture (at most 16 tiles, a 2048 pixel square or 4096 by 1024 round a pole:
// about 22 MB of graphics memory with its mipmaps), freed a few seconds after the view no longer needs it. The tiles come from a map source of the data door (`BodyMapSource`: the package's own folder, or a caller's) and are
// held in the view's one tile store, under its one budget, a few at a time, and nothing is sent at rest: a load starts only because the window changed. Nothing here draws: a window that is ready asks for one draw, and
// the draw's `apply` puts it on the body. three.js is passed in; nothing here imports it. See scripts/make-body-tiles.py for the tiles and docs/guides/close-zoom.md for the whole picture.
import type * as THREE from "three";
import type { SourceInfo } from "../data-door.ts";
import { accountOf, type SourceBook } from "../door/book.ts";
import { DEFAULT_LEVELS, forgetManifests as forgetFolders, tileKeyParts, type BodyMapSource } from "../door/map.ts";
import { chooseWindow, covers, visibleRegion, windowRect, windowTiles, BASE_WIDTH, TEXEL_SLACK, TILE_SIZE, texelAngle, type Axes, type Region, type Seen, type TileLevel, type TileWindow, type ViewBox } from "./tiles.ts";

type Three = Pick<typeof THREE, "ClampToEdgeWrapping" | "DataTexture" | "LinearFilter" | "NoColorSpace">;

/** Milliseconds a window that the view no longer needs is kept (the view may come straight back) before its texture is freed. */
export const DETAIL_KEEP_MS = 4000;
/** Milliseconds a changed view must stay changed before a new window is fetched, so a drag or a pinch does not fetch what it passes. */
export const DETAIL_SETTLE_MS = 140;
/** Decoded tiles a view's store keeps by default (about a megabyte and a half each), those of the window first: the view's 48 MB budget (`TILE_BUDGET_BYTES`). */
export const DETAIL_TILES_KEPT = 34;
/** Milliseconds a levels read that failed waits before it is asked again, and only when a view wants more than the body's own picture. */
const RETRY_MS = 30_000;

/** What a window is doing, for a page or a test. */
export interface DetailStats {
  /** The source's levels for this body were read (a body with levels in it, or not). */
  ready: boolean;
  /** The level the view wants now, or `null` when the body's own picture is sharp enough. */
  level: number | null;
  /** The level on the body now, or `null`. */
  shown: number | null;
  /** Tiles of the window held decoded, and tiles of it being fetched. */
  held: number;
  loading: number;
  /** Windows that could not be made: they are tried again only when the view changes. */
  failed: number;
  /** Tile fetches made. */
  requested: number;
  /** The width and height in pixels of the window's picture now, or 0. */
  pixels: number;
  /** The source whose tiles are on the body now, and how many tiles of the window it gave: for the credit line. `undefined` for none. */
  source: SourceInfo | undefined;
  used: number;
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
  /** The map source the body is drawn from now, or `undefined` for none (the body's own 2048 pixel picture). Read at every draw, so a source added, removed or switched off is taken up at the next one. */
  source: () => BodyMapSource | undefined;
  /** The view's sources: their tiles are held in its one store, under its one budget. */
  book: SourceBook;
  /** The body's name in the tile set. */
  body: string;
  /** Device pixels to a CSS pixel. */
  ratio: () => number;
  /** False on a device that should keep to the package's own pictures (little memory). */
  allowed: () => boolean;
  /** Ask for one draw. */
  redraw: () => void;
  /** Told when the source's levels for this body are known (`undefined` when it has none), so the zoom range can follow. */
  onLevels?: (levels: readonly TileLevel[] | undefined) => void;
  /** Put the window on the body, or take it off (`null`). */
  apply: (window: DetailWindow | null) => void;
  now?: () => number;
}

export interface Detail {
  /** Called at each draw with where the camera is and the body's axes (an orthographic camera looking straight at the body, as `<wakusei-body>` has). The source's levels are read at the first call. */
  sync(box: ViewBox, axes: Axes, viewWidth: number): void;
  /**
   * Called at each draw of a body seen by any camera (`seenRegion`): what the camera sees of it, or `undefined` for none. The source's levels are read only once the 2048 pixel map is not sharp enough for the view.
   */
  follow(seen: Seen | undefined): void;
  /** Called at a draw when the body is too small in the view to want tiles at all: nothing is read, and what is held is let go after a few seconds. */
  rest(): void;
  readonly stats: DetailStats;
  dispose(): void;
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
export const forgetManifests = forgetFolders;

interface Held {
  key: string;
  window: TileWindow;
  texture: THREE.Texture;
  canvas: HTMLCanvasElement;
  source: SourceInfo;
  tiles: number;
}

const keyOf = (w: TileWindow): string => `${w.level}:${w.col0}:${w.cols}:${w.row0}:${w.rows}`;

/** The window as a place on the map, in degrees, pulled in a hair so that a tile's own edge does not count as the next tile. */
function placeOf(window: TileWindow): { lonMin: number; lonMax: number; latMin: number; latMax: number } {
  const lonMin = (window.col0 / window.columns - 0.5) * 360;
  const latMax = 90 - (window.row0 / window.rowsTotal) * 180;
  const inset = 1e-6;
  return { lonMin: lonMin + inset, lonMax: lonMin + (window.cols / window.columns) * 360 - inset, latMax: latMax - inset, latMin: latMax - (window.rows / window.rowsTotal) * 180 + inset };
}

/** Make the window of finer map for one body. */
export function createDetail(T: Three, deps: DetailDeps): Detail {
  const clock = deps.now ?? (() => performance.now());
  const store = deps.book.store;
  /** This drawing of the body: its tiles are held under its own name in the store. */
  const owner = {};
  const failed = new Map<string, number>();
  /** The bitmaps this body has seen come out of the store, to close the ones the store has let go. */
  const seen = new Map<string, { image: { close?(): void }; account: string }>();
  let active: BodyMapSource | undefined;
  let levels: readonly TileLevel[] | undefined;
  let levelsRead = false;
  let levelsAsked = false;
  let askedAt = 0;
  let held: Held | undefined;
  let loading: { key: string; window: TileWindow; keys: readonly string[]; tiles: ReadonlyMap<string, string>; source: BodyMapSource } | undefined;
  let pending: { key: string; timer: ReturnType<typeof setTimeout> } | undefined;
  let freeTimer: ReturnType<typeof setTimeout> | undefined;
  let wantLevel: number | null = null;
  let wantKey = "";
  let requested = 0;
  let gone = false;
  let lastKeys: { source: BodyMapSource; account: string; keys: readonly string[] } | undefined;
  let watching = false;
  // The Texture class of the three.js module the page handed over: `DataTexture` extends it, and a page's subset of three need not name it.
  const TextureClass = Object.getPrototypeOf(T.DataTexture) as new (image: unknown) => THREE.Texture;

  const heldTiles = (): number => (lastKeys === undefined ? 0 : lastKeys.keys.filter((key) => store.get(lastKeys!.account, key) !== undefined).length);

  /** Closes the bitmaps the store no longer holds. */
  const prune = (): void => {
    for (const [key, one] of seen) {
      const at = key.indexOf("\u0000");
      if (store.get(one.account, key.slice(at + 1)) !== undefined) continue;
      one.image.close?.();
      seen.delete(key);
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

  /** Stops the window being fetched: its loads are aborted (the tiles already here stay in the store until it needs the room). */
  const cancelLoading = (): void => {
    if (loading !== undefined) {
      const at = accountOf(loading.source, deps.body, owner);
      if (lastKeys?.account === at) store.want(deps.book.loader(loading.source, deps.body, owner), []);
    }
    loading = undefined;
  };

  /** Frees every tile of this body held in the store, and the bitmaps. */
  const dropTiles = (): void => {
    if (lastKeys !== undefined) deps.book.dropAccount(lastKeys.source, deps.body, owner);
    for (const one of seen.values()) one.image.close?.();
    seen.clear();
    lastKeys = undefined;
  };

  const install = (window: TileWindow, source: BodyMapSource, tiles: ReadonlyMap<string, string>): boolean => {
    const placed = windowTiles(window);
    const canvas = document.createElement("canvas");
    canvas.width = window.cols * TILE_SIZE;
    canvas.height = window.rows * TILE_SIZE;
    const context = canvas.getContext("2d");
    if (context === null) return false;
    const account = accountOf(source, deps.body, owner);
    for (const tile of placed) {
      const key = tiles.get(`${tile.level}:${tile.col}:${tile.row}`);
      const got = key === undefined ? undefined : store.get(account, key);
      if (got === undefined) return false;
      try {
        context.drawImage(got.image as unknown as CanvasImageSource, tile.x, tile.y, TILE_SIZE, TILE_SIZE);
      } catch {
        return false;
      }
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
    held = { key: keyOf(window), window, texture, canvas, source: source.info, tiles: placed.length };
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
    deps.redraw();
    return true;
  };

  /** Looks at the window being fetched: whole, it goes on the body; if nothing more is coming and it is not whole, it failed. */
  const check = (): void => {
    if (gone || loading === undefined) return;
    const now = loading;
    const loader = deps.book.loader(now.source, deps.body, owner);
    const got = store.want(loader, now.keys);
    const account = accountOf(now.source, deps.body, owner);
    for (const [key, tile] of got) seen.set(`${account}\u0000${key}`, { image: tile.image as { close?(): void }, account });
    if (now.keys.every((key) => got.has(key))) {
      loading = undefined;
      if (!install(now.window, now.source, now.tiles)) failed.set(now.key, clock());
      prune();
      // a window that arrives when the view no longer wants one is let go after the usual while: no draw may come to say so
      if (wantLevel === null) scheduleFree();
      return;
    }
    const stats = store.stats();
    if (stats.inFlight === 0 && stats.queued === 0) {
      // a tile that cannot be had spoils the window: leave the picture as it is, and try again only when the view has changed
      failed.set(now.key, clock());
      cancelLoading();
      prune();
      return;
    }
    // the store says a tile has failed before it has let go of it: look again when nothing is running
    if (!watching) {
      watching = true;
      void store.idle().then(() => {
        watching = false;
        check();
      });
    }
  };

  const unwatch = deps.book.onChange(check);

  const load = (window: TileWindow, source: BodyMapSource): void => {
    const key = keyOf(window);
    if (loading?.key === key) return;
    cancelLoading();
    let keys: readonly string[];
    try {
      const wanted = source.need({ ...placeOf(window), body: deps.body }, window.columns * TILE_SIZE);
      keys = Array.isArray(wanted) ? wanted.filter((one): one is string => typeof one === "string") : [];
    } catch {
      failed.set(key, clock());
      return;
    }
    const tiles = new Map<string, string>();
    for (const one of keys) {
      const at = tileKeyParts(one);
      if (at !== undefined) tiles.set(`${at.level}:${at.col}:${at.row}`, one);
    }
    const need = windowTiles(window);
    if (!need.every((tile) => tiles.has(`${tile.level}:${tile.col}:${tile.row}`))) {
      failed.set(key, clock());
      return;
    }
    const wanted = need.map((tile) => tiles.get(`${tile.level}:${tile.col}:${tile.row}`)!);
    loading = { key, window, keys: wanted, tiles, source };
    lastKeys = { source, account: accountOf(source, deps.body, owner), keys: wanted };
    // the store starts what is not held and aborts what is no longer wanted; what is held comes back at once
    store.want(deps.book.loader(source, deps.body, owner, () => (requested += 1)), wanted);
    check();
  };

  // not wanted any more (zoomed out, or out of sight): after a few seconds the picture and every decoded tile are let go
  const scheduleFree = (): void => {
    if ((held === undefined && lastKeys === undefined) || freeTimer !== undefined) return;
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

  const ask = (source: BodyMapSource): void => {
    if (levelsAsked && (levelsRead || clock() - askedAt < RETRY_MS)) return;
    levelsAsked = true;
    askedAt = clock();
    const controller = new AbortController();
    // read once the view has settled, and only if the body is still drawn from this source: a page that changes `tiles` just after the element starts is not asked for a manifest it has just said it does not want
    setTimeout(() => {
      if (gone || active !== source || deps.source() !== source) {
        // not wanted now: ask again for whatever the view is drawn from, at the draw this asks for
        if (!gone && active === source) {
          levelsAsked = false;
          deps.redraw();
        }
        return;
      }
      void Promise.resolve()
        .then(() => (source.levels === undefined ? DEFAULT_LEVELS : source.levels(deps.body, controller.signal)))
        .then(
          (read) => {
            if (gone || active !== source) return;
            levelsRead = read !== undefined;
            levels = read !== undefined && read.length > 0 ? read : undefined;
            deps.onLevels?.(levels);
            // a draw tells this the view as it is now (never as it was): the window is chosen then
            if (levels !== undefined) deps.redraw();
          },
          () => undefined,
        );
    }, DETAIL_SETTLE_MS);
  };

  const idle = (): void => {
    wantLevel = null;
    cancelPending();
    scheduleFree();
  };

  /** The source for this draw. A change of source (one added, removed or switched off) lets go of the window of the old one and starts again with the new. */
  const take = (): BodyMapSource | undefined => {
    const source = deps.source();
    if (source === active) return source;
    // the new source is the active one before anything is told to draw, so a draw that comes back here finds nothing more to change
    active = source;
    cancelPending();
    cancelLoading();
    dropTiles();
    failed.clear();
    wantKey = "";
    levels = undefined;
    levelsRead = false;
    levelsAsked = false;
    if (held !== undefined) {
      release();
      deps.apply(null);
      deps.redraw();
    }
    if (source === undefined) deps.onLevels?.(undefined);
    return source;
  };

  // what the view needs, whoever works out the region: the window, loaded after the view has settled
  const track = (source: BodyMapSource, region: Region | undefined, inside: Region | undefined, radiansPixels: number): void => {
    const want = region === undefined ? undefined : chooseWindow(region, levels!, radiansPixels);
    wantLevel = want?.level ?? null;
    if (want === undefined) {
      cancelPending();
      scheduleFree();
      return;
    }
    cancelFree();
    if (held !== undefined && held.window.level >= want.level && inside !== undefined && covers(held.window, inside)) {
      cancelPending();
      return;
    }
    const key = keyOf(want);
    if (held?.key === key || loading?.key === key || pending?.key === key) return;
    // a window that failed is not asked for again while the view wants the same one; a changed view clears it
    if (key !== wantKey) {
      if (wantKey !== "") failed.clear();
      wantKey = key;
    }
    if (failed.has(key)) return;
    cancelPending();
    pending = {
      key,
      timer: setTimeout(() => {
        pending = undefined;
        if (!gone && active === source) load(want, source);
      }, DETAIL_SETTLE_MS),
    };
  };

  return {
    sync(box, axes, viewWidth) {
      if (gone) return;
      const source = take();
      if (source === undefined || !deps.allowed()) {
        idle();
        return;
      }
      ask(source);
      if (levels === undefined) return;
      const region = visibleRegion(box, axes);
      track(source, region, region === undefined ? undefined : visibleRegion(box, axes, 0), (deps.ratio() * viewWidth) / Math.max(1e-9, box.right - box.left));
    },
    follow(seen_) {
      if (gone) return;
      const source = take();
      if (source === undefined || !deps.allowed()) {
        idle();
        return;
      }
      // the levels are read when the view wants more than the 2048 pixel map gives, not before: a page that never gets that close fetches nothing
      const radiansPixels = seen_ === undefined ? 0 : seen_.radiansPixels * deps.ratio();
      if (seen_ !== undefined && radiansPixels / TEXEL_SLACK > BASE_WIDTH / (2 * Math.PI)) ask(source);
      if (levels === undefined) {
        idle();
        return;
      }
      track(source, seen_?.region, seen_?.inside, radiansPixels);
    },
    rest() {
      if (!gone) idle();
    },
    get stats() {
      return {
        ready: levelsRead,
        level: wantLevel,
        shown: held?.window.level ?? null,
        held: heldTiles(),
        loading: loading === undefined ? 0 : loading.keys.filter((key) => store.get(accountOf(loading!.source, deps.body, owner), key) === undefined).length,
        failed: failed.size,
        requested,
        pixels: held === undefined ? 0 : held.window.cols * TILE_SIZE * held.window.rows * TILE_SIZE,
        source: held?.source,
        used: held?.tiles ?? 0,
      };
    },
    dispose() {
      gone = true;
      unwatch();
      cancelPending();
      cancelLoading();
      cancelFree();
      release();
      dropTiles();
    },
  };
}
