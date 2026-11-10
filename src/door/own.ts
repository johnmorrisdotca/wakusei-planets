// The package's own data as sources of the data door, written from the rows of NOTICE.md: the surface pictures, the finer map tiles and the numbers the positions come from. The credit of what a view draws is written from these,
// so the package's data and a caller's go through one path. A test holds that none is non-commercial or share-alike, so the package can pass all of it on under the MIT licence. Pure: no DOM, no three.js.
import type { Credit, SourceInfo } from "../data-door.ts";

const NOTICE = "https://github.com/johnmorrisdotca/wakusei-planets/blob/main/NOTICE.md";

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) for (const inner of Object.values(value)) freeze(inner);
  return Object.freeze(value);
}

/**
 * The package's own data, as sources, written from the rows of `NOTICE.md`: `wakusei-pictures` (the surface pictures of the bodies), `wakusei-tiles` (the finer map tiles cut from the same maps) and `wakusei-orbits` (the series and
 * tables the positions come from). A test holds that none is non-commercial or share-alike, so the package can pass all of it on under the MIT licence. A view's credit line is written from these and from the sources a caller handed in.
 *
 * @example
 * ```ts
 * import { OWN_SOURCES } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(OWN_SOURCES.map((source) => `${source.id}: ${source.licence.name}`));
 * ```
 */
export const OWN_SOURCES: readonly SourceInfo[] = freeze([
  {
    id: "wakusei-pictures",
    name: { en: "Surface pictures", ja: "表面の地図" },
    credit: {
      en: "Surface pictures: maps by NASA, USGS and JPL (public domain), Solar System Scope and Nestaeric",
      ja: "表面の地図：NASA、USGS、JPLの地図（パブリックドメイン）、Solar System ScopeとNestaericの地図",
    },
    licence: { name: "CC BY 4.0", url: `${NOTICE}#surface-pictures`, spdx: "CC-BY-4.0" },
    url: "https://github.com/johnmorrisdotca/wakusei-planets/tree/main/textures",
    retrieved: "2026-11-02",
  },
  {
    id: "wakusei-tiles",
    name: { en: "Finer map tiles", ja: "細かい地図のタイル" },
    credit: {
      en: "Finer map tiles: maps by NASA, USGS and JPL (public domain), cut by Wakusei Planets",
      ja: "細かい地図のタイル：NASA、USGS、JPLの地図（パブリックドメイン）、Wakusei Planetsで切り出したもの",
    },
    licence: { name: "Public domain", url: `${NOTICE}#finer-map-tiles` },
    url: "https://johnmorrisdotca.github.io/wakusei-planets/tiles/",
    retrieved: "2026-11-09",
  },
  {
    id: "wakusei-orbits",
    name: { en: "Positions", ja: "天体の位置" },
    credit: {
      en: "Positions: VSOP87B and ELP2000-82B (IMCCE, Observatoire de Paris), JPL Horizons (NASA/JPL-Caltech)",
      ja: "位置：VSOP87BとELP2000-82B（パリ天文台IMCCE）、JPL Horizons（NASA/JPL-Caltech）",
    },
    licence: { name: "Published for use with credit", url: `${NOTICE}#the-numbers` },
    url: "https://ftp.imcce.fr/pub/ephem/planets/vsop87/",
    retrieved: "2026-11-07",
  },
]);

/** The rows of `OWN_SOURCES` by id. */
export const OWN_BY_ID: ReadonlyMap<string, SourceInfo> = new Map(OWN_SOURCES.map((source) => [source.id, source]));

/** The source objects this package made itself: only these are its own, whatever id a caller's source gives itself. */
const MADE_HERE = new WeakSet<object>();

/** Marks a source object as made by this package. */
export function madeHere<T extends object>(source: T): T {
  MADE_HERE.add(source);
  return source;
}

/** True for a source object this package made (`tilesSource`), false for any other. */
export const isOwnSource = (source: object): boolean => MADE_HERE.has(source);

/**
 * The credit of one of the package's own sources, for a page that draws something itself: the pictures and positions of the elements are credited by the elements' own `credits()`, and a page that draws a body from the
 * painter puts `ownCredit("wakusei-pictures", 1)` in its credit line.
 *
 * @param id - `wakusei-pictures`, `wakusei-tiles` or `wakusei-orbits`.
 * @param used - How many marks were drawn from it.
 * @returns The credit, marked as the package's own.
 * @throws RangeError for an id that is not one of `OWN_SOURCES`.
 *
 * @example
 * ```ts
 * import { creditLine, ownCredit } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * console.log(creditLine([ownCredit("wakusei-tiles", 6)], "en"));
 * ```
 */
export function ownCredit(id: string, used: number): Credit {
  const source = OWN_BY_ID.get(id);
  if (source === undefined) throw new RangeError(`"${id}" is not one of the package's own sources`);
  return { source, own: true, used };
}
