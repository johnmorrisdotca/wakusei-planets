// The sources a view holds: which are in it, which are switched off, the one tile store they share (one byte budget for all of them), the records of the record sources once read, and the credits of what was drawn.
// An element or a painter owns one. Everything here is plain TypeScript with no DOM and no three.js; the elements call it, and a test can too.
import { createTileStore, validateSource, type Credit, type DataSource, type ImageTile, type RecordSource, type SourceInfo, type TileLoader, type TileStats, type TileStore } from "../data-door.ts";
import { BODIES } from "../facts.ts";
import type { BodyMapSource, MapLayer } from "./map.ts";
import { isOwnSource } from "./own.ts";
import { readSmallBodies, type SmallBody, type SmallBodiesRead } from "./small-bodies.ts";

/**
 * Options of a view's source book.
 *
 * @example
 * ```ts
 * import type { SourceBookOptions } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const options: SourceBookOptions = { kinds: ["tiles"], budgetBytes: 24 * 1024 * 1024 };
 * console.log(options.kinds);
 * ```
 */
export interface SourceBookOptions {
  /** The kinds of source this view can draw: `tiles` (a map of a body) and `records` (small bodies). Both where left out. */
  kinds?: readonly ("tiles" | "records")[];
  /** The bytes of decoded tiles held, all sources together: 48 MB where left out. */
  budgetBytes?: number;
  /** The most tiles held, all sources together: no limit where left out. */
  maxTiles?: number;
  /** The most loads in flight for one source: 6 where left out. */
  maxInFlight?: number;
}

/**
 * What a view's sources have done: the tile store's counts, and for each record source how many records it holds and how many were left out.
 *
 * @example
 * ```ts
 * import type { SourceStats } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const loads = (stats: SourceStats): number => stats.requested;
 * console.log(typeof loads);
 * ```
 */
export type SourceStats = TileStats & { records: Record<string, { status: string; kept: number; skipped: number }> };

/**
 * A view's sources, as `<wakusei-body>` and `<wakusei-space>` keep them: `addSource`, `removeSource`, `enableSource` and `ownOnly` are the element's methods of the same names.
 *
 * @example
 * ```ts
 * import { createSourceBook } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const book = createSourceBook();
 * console.log(book.sources.length, book.stats().held);
 * ```
 */
export interface SourceBook {
  /** The sources now in the view, in the order added (the package's own folder of tiles is not among them unless a page added it). */
  readonly sources: readonly DataSource[];
  /** Adds a source. It throws a `TypeError` at once for a source `validateSource` refuses, an id already in the view, a kind this view cannot draw, or a map source with no body or layer. Returns the function that removes it. */
  addSource(source: unknown): () => void;
  /** Removes a source by id: aborts its loads, frees its tiles and records. Returns whether there was one. */
  removeSource(id: string): boolean;
  /** Switches a source off (`false`) or on: off aborts its loads and frees its tiles and records, and the source stays in the view. */
  enableSource(id: string, on: boolean): void;
  /** True while a source is in the view and switched on. */
  isEnabled(id: string): boolean;
  /** `true` ignores every source that is not the package's own, at once (the attribute `data="own"`). */
  ownOnly(on: boolean): void;
  readonly onlyOwn: boolean;
  /** The sources in use: in the view, switched on, and not ignored by `ownOnly`. */
  active(): readonly DataSource[];
  /** The map sources in use for a body and layer, the last one added first (it is the one a body is drawn from). */
  mapSources(body: string, layer?: MapLayer): readonly BodyMapSource[];
  /** The small bodies of every record source in use, read so far, in the order added. */
  smallBodies(): readonly SmallBody[];
  /** What each record source in use has read: its status and the records. */
  recordReads(): ReadonlyMap<string, SmallBodiesRead>;
  /** True for a source the package made itself. */
  isOwn(source: DataSource): boolean;
  /** The source of this id, if it is in the view. */
  get(id: string): DataSource | undefined;
  /** The tile store all the map sources share. */
  readonly store: TileStore<ImageTile>;
  /** A source seen as the store sees it, for one body: its tiles are held under `<id>/<body>`, so one source can serve several bodies. A tile that is not a picture is an error, so it is counted and never drawn. */
  loader(source: BodyMapSource, body: string, onRequest?: () => void): TileLoader<ImageTile>;
  /** Calls `listener` when something changed that a view may want to draw again for: a source added, removed or switched, a tile arrived or failed, records read. Returns the function that stops it. */
  onChange(listener: () => void): () => void;
  stats(): SourceStats;
  /** Frees everything: aborts every load, frees every tile and record. The book is not used again. */
  dispose(): void;
}

/** The name a source's tiles are held under for one body in the store: `<id>/<body>`. */
export const accountOf = (source: { info: { id: string } }, body: string): string => `${source.info.id}/${body}`;

const isTile = (tile: unknown): tile is ImageTile => {
  if (typeof tile !== "object" || tile === null) return false;
  const one = tile as { width?: unknown; height?: unknown; image?: unknown };
  return typeof one.width === "number" && one.width > 0 && Number.isFinite(one.width) && typeof one.height === "number" && one.height > 0 && Number.isFinite(one.height) && typeof one.image === "object" && one.image !== null;
};

/**
 * Makes the sources of one view.
 *
 * @param options - The kinds the view draws, and the budget.
 * @returns The book.
 *
 * @example
 * ```ts
 * import { createSourceBook } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const book = createSourceBook({ kinds: ["tiles"] });
 * console.log(book.active().length);
 * ```
 */
export function createSourceBook(options: SourceBookOptions = {}): SourceBook {
  const kinds = new Set(options.kinds ?? ["tiles", "records"]);
  const list: DataSource[] = [];
  const off = new Set<string>();
  const controllers = new Map<string, AbortController>();
  const reads = new Map<string, SmallBodiesRead>();
  const accounts = new Map<string, Set<string>>();
  const loaders = new Map<string, { source: BodyMapSource; loader: TileLoader<ImageTile> }>();
  const listeners = new Set<() => void>();
  let onlyOwn = false;
  let gone = false;
  const notify = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const store = createTileStore<ImageTile>({
    ...(options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes }),
    ...(options.maxTiles === undefined ? {} : { maxTiles: options.maxTiles }),
    ...(options.maxInFlight === undefined ? {} : { maxInFlight: options.maxInFlight }),
    onChange: notify,
  });

  const isOwn = (source: DataSource): boolean => isOwnSource(source);
  const inUse = (source: DataSource): boolean => !off.has(source.info.id) && !(onlyOwn && !isOwn(source));
  const active = (): DataSource[] => list.filter(inUse);

  /** Aborts a source's loads and frees its tiles and records. */
  const release = (id: string): void => {
    controllers.get(id)?.abort();
    controllers.delete(id);
    reads.delete(id);
    for (const account of accounts.get(id) ?? []) {
      store.drop(account);
      loaders.delete(account);
    }
    accounts.delete(id);
  };

  /** Starts reading a record source: once, when it is added or switched on. */
  const start = (source: DataSource): void => {
    if (source.kind !== "records" || controllers.has(source.info.id)) return;
    const controller = new AbortController();
    controllers.set(source.info.id, controller);
    void readSmallBodies(source as RecordSource<SmallBody>, controller.signal).then((read) => {
      if (controllers.get(source.info.id) !== controller || read.status === "aborted") return;
      reads.set(source.info.id, read);
      notify();
    });
  };

  const check = (source: unknown): DataSource => {
    validateSource(source, list.map((one) => one.info.id));
    const id = source.info.id;
    if (!kinds.has(source.kind)) throw new TypeError(`source "${id}": this view takes ${[...kinds].join(" and ")} sources, not ${source.kind} sources`);
    if (source.kind === "tiles") {
      const map = source as Partial<BodyMapSource>;
      if (typeof map.body !== "string" || (map.body !== "*" && !(map.body in BODIES))) throw new TypeError(`source "${id}": a map source names its body (a body of this package, or "*" for a folder of them), not ${JSON.stringify(map.body)}`);
      if (map.layer !== "colour" && map.layer !== "height") throw new TypeError(`source "${id}": a map source's layer is "colour" or "height", not ${JSON.stringify(map.layer)}`);
    }
    return source;
  };

  const remove = (id: string): boolean => {
    const at = list.findIndex((source) => source.info.id === id);
    if (at < 0) return false;
    list.splice(at, 1);
    off.delete(id);
    release(id);
    notify();
    return true;
  };

  return {
    get sources() {
      return [...list];
    },
    addSource(source) {
      const one = check(source);
      list.push(one);
      if (inUse(one)) start(one);
      notify();
      return () => void remove(one.info.id);
    },
    removeSource: remove,
    enableSource(id, on) {
      const source = list.find((one) => one.info.id === id);
      if (source === undefined || off.has(id) === !on) return;
      if (on) {
        off.delete(id);
        if (inUse(source)) start(source);
      } else {
        off.add(id);
        release(id);
      }
      notify();
    },
    isEnabled: (id) => list.some((source) => source.info.id === id) && !off.has(id),
    ownOnly(on) {
      if (on === onlyOwn) return;
      onlyOwn = on;
      for (const source of list) {
        if (isOwn(source) || off.has(source.info.id)) continue;
        if (on) release(source.info.id);
        else start(source);
      }
      notify();
    },
    get onlyOwn() {
      return onlyOwn;
    },
    active,
    mapSources: (body, layer = "colour") =>
      active()
        .filter((source): source is BodyMapSource => source.kind === "tiles" && (source as BodyMapSource).layer === layer && ((source as BodyMapSource).body === body || (source as BodyMapSource).body === "*"))
        .reverse(),
    smallBodies: () => active().flatMap((source) => (reads.get(source.info.id)?.records ?? []) as readonly SmallBody[]),
    recordReads: () => new Map([...reads].filter(([id]) => list.some((source) => source.info.id === id && inUse(source)))),
    isOwn,
    get: (id) => list.find((source) => source.info.id === id),
    store,
    loader(source, body, onRequest) {
      const account = accountOf(source, body);
      const held = loaders.get(account);
      if (held !== undefined && held.source === source) return held.loader;
      const info: SourceInfo = { ...source.info, id: account };
      const loader: TileLoader<ImageTile> = {
        info,
        async load(key, signal) {
          onRequest?.();
          const tile = await source.load(key, signal);
          if (!isTile(tile)) throw new TypeError(`Source "${source.info.id}" gave a tile "${key}" that is not a picture`);
          return tile;
        },
        bytes: (tile) => source.bytes(tile),
      };
      loaders.set(account, { source, loader });
      const mine = accounts.get(source.info.id) ?? new Set<string>();
      mine.add(account);
      accounts.set(source.info.id, mine);
      return loader;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    stats() {
      const records: SourceStats["records"] = {};
      for (const [id, read] of reads) records[id] = { status: read.status, kept: read.records.length, skipped: read.skipped };
      return { ...store.stats(), records };
    },
    dispose() {
      if (gone) return;
      gone = true;
      for (const source of [...list]) release(source.info.id);
      list.length = 0;
      listeners.clear();
    },
  };
}

/**
 * The credits of a view for the last drawn frame: the package's own first, then the sources a caller added, each with the marks or tiles it gave; a source that gave none is left out.
 *
 * @param own - The package's own credits (`ownCredit`), with how many marks each gave.
 * @param book - The view's sources.
 * @param used - How many marks or tiles each source of the book gave, by id.
 * @returns The credits, own first, in a stable order.
 *
 * @example
 * ```ts
 * import { createSourceBook, creditsOf, ownCredit } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const book = createSourceBook();
 * console.log(creditsOf([ownCredit("wakusei-pictures", 1)], book, new Map()).length);
 * ```
 */
export function creditsOf(own: readonly Credit[], book: SourceBook, used: ReadonlyMap<string, number>): Credit[] {
  const mine = own.filter((credit) => credit.used > 0);
  const theirs: Credit[] = [];
  for (const source of book.active()) {
    const count = used.get(source.info.id) ?? 0;
    if (count <= 0) continue;
    const credit: Credit = { source: source.info, own: book.isOwn(source), used: count };
    if (credit.own) mine.push(credit);
    else theirs.push(credit);
  }
  return [...mine, ...theirs];
}
