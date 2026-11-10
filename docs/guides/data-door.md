---
title: Outside data, the data door
section: how-to
order: 32
description: How to hand the package your own maps of a body or your own small bodies as a source with its own licence and credit, how to switch one off, and how a page shows whose data is on the screen. Non-commercial and share-alike sources are allowed from a caller, with the licence printed beside the credit.
---

[日本語](ja/data-door.md)

The package draws, and you bring the data. `@johnmorrisdotca/wakusei-planets/door` is the one way to hand it a finer map of a body or a list of small bodies, and the same door shows whose data is on the screen. With no source the package draws what it always drew, from its own data: the surface pictures, the finer map tiles cut from them and the series the positions come from (`OWN_SOURCES`, written from `NOTICE.md`). The package bundles only data that is clear to pass on; a source of yours may be non-commercial or share-alike, and the credit line prints that beside the licence.

The shapes (`SourceInfo`, `Licence`, `RecordSource`, `TileSource`, `Credit`, `MapPlace`, `ImageTile`) and four small functions (`validateSource`, `creditLine`, `loadRecords`, `createTileStore`) are the family's data door, one file copied unchanged into each package (`src/data-door.ts`, from kazoku-ui's `templates/data-door.ts`). The door re-exports them, so one import is enough.

## Small bodies

A source of small bodies is a list that fits in memory, at most 200,000 records (`MAX_RECORDS`), read once when the source is added. Each record is a `SmallBody`: its `name`, and the elements of its orbit at an epoch: `a` (astronomical units), `e`, `i`, `node`, `peri` and `M0` (degrees), `epoch` (a Julian date) and `H`, the absolute magnitude. `<wakusei-space>` draws them as points, all in one instanced draw: the graphics card works out where each one is from its elements and the date, so a change of date costs no work on the processor, and a brighter body (a lower `H`) is a larger point. The orbits are two-body ellipses, so a body is where its elements put it; no planet pulls it. A record with a number that is not finite, a name that is not text or an orbit that is not an ellipse is left out and counted.

`info` says who the source is: an `id` (lower-case letters, digits and hyphens, unique in the view), a `name` and a `credit` in English and Japanese (never empty), the `licence` (a name and a link, with `nonCommercial` or `shareAlike` where it is so), the source's page and the day it was retrieved.

```js
import { createSourceBook, creditLine, smallBodyAt } from "@johnmorrisdotca/wakusei-planets/door";

// A source of your own: here two small bodies held in memory (the second has a number that is not one, so it is left out). A real one would read a catalogue, and says whose it is and under what licence.
const mine = {
  kind: "records",
  info: {
    id: "my-rocks",
    name: { en: "My rocks", ja: "私の小天体" },
    credit: { en: "My rocks, A. Person (2026)", ja: "私の小天体（A. Person、2026年）" },
    licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
    url: "https://example.org/my-rocks",
    retrieved: "2026-11-10",
  },
  records: () => [
    { name: "Ceres", a: 2.7656, e: 0.0795, i: 10.588, node: 80.25, peri: 73.3, M0: 291.4, epoch: 2461000.5, H: 3.34 },
    { name: "Broken", a: Number.NaN, e: 0.1, i: 5, node: 0, peri: 0, M0: 0, epoch: 2461000.5, H: 12 },
  ],
};

// An element keeps a book like this one: `space.addSource(mine)` is `book.addSource(mine)`.
const book = createSourceBook();
book.addSource(mine);
await book.ready();
const [ceres] = book.smallBodies();
const [x, y, z] = smallBodyAt(ceres, 2461000.5);
console.log(`${book.smallBodies().length} small body, ${book.stats().records["my-rocks"].skipped} left out: ${ceres.name} is ${Math.hypot(x, y, z).toFixed(2)} au from the Sun`);
const credits = [{ source: mine.info, own: false, used: book.smallBodies().length }];
console.log(creditLine(credits, "en"));
console.log(creditLine(credits, "ja"));

book.enableSource("my-rocks", false);
console.log(`${book.smallBodies().length} small bodies with the source off`);
```

`createSourceBook` is the part of an element that keeps the sources; the element's `addSource` is the book's. A source is checked with `validateSource` when it is added, so an empty credit, no licence, a clashing id or a missing function is a `TypeError` at once, not at the first draw. `readSmallBodies(source, signal)` reads one source the way the book does, and `smallBodyAt(body, julianDate)` is where a body is on a date (heliocentric ecliptic coordinates of J2000, in astronomical units), the same orbit the point's shader solves.

## A map of a body

A map source is a source of tiles: `need(place, detail)` names the keys of the tiles a place needs, `load(key, signal)` fetches one as an `ImageTile` (a width, a height and a picture), and `bytes(tile)` says what it holds, for the budget. It also says which `body` it is for (`"mars"`, or `"*"` for a folder of several) and which `layer`: `colour` is the picture of the surface, which the package draws, and `height` is its relief, which it does not draw yet. The place is the family's `MapPlace` (longitude and latitude in degrees), and the detail is the pixels across the whole circumference, not a level number. The pyramid is the package's own: level L is `2048 * 2^L` pixels round in 512 pixel tiles, column 0 at longitude -180 and row 0 at latitude 90, and a tile's key ends in `level/column/row`. `mapKeys(place, detail, levels)` gives those keys, so a source of your own can build its `need` on it. A map source for a body takes the place of the package's folder of tiles for that body, and the window of tiles in view is laid over the body's own 2048 pixel picture as before.

`tilesSource(base)` is the package's own folder as a source: a `manifest.json` and a tile for each body, level and place at `<body>/<level>/<column>/<row>.webp`. It is what the `tiles` attribute means, and the attribute stays as the short way to say it: `tiles="/my-tiles/"` and `addSource(tilesSource("/my-tiles/"))` are the same.

## On an element

`<wakusei-body>` takes map sources and `<wakusei-space>` takes map sources and small bodies. Both have the same calls:

```js no-run
import { creditLine } from "@johnmorrisdotca/wakusei-planets/door";
import "@johnmorrisdotca/wakusei-planets/space/element";

const space = document.querySelector("wakusei-space");
const remove = space.addSource(mine); // checked at once; returns the way to take it away
space.addEventListener("wakusei-creditschange", () => (credit.textContent = creditLine(space.credits(), "en")));
space.enableSource("my-rocks", false); // a layers panel's switch
```

`sources` is a property (never an attribute: data is not text): assign a list to replace the sources, and if one is refused nothing changes. `removeSource(id)` and the `remove()` that `addSource` returns take a source away; `enableSource(id, false)` switches it off and keeps it in the view; the attribute `data="own"` ignores every source that is not the package's own, at once.

## Whose data is on the screen

`credits()` lists the sources that gave at least one mark or tile to the last drawn frame, the package's own first: the surface picture of a painted body, the finer map tiles when a window of them is on the body, the positions in the space view, and each source of yours that gave points or tiles. `creditLine(credits, "en" | "ja")` writes them as a line with the licence beside each: "Surface pictures: ... (CC BY 4.0); My rocks, A. Person (2026) (CC BY-NC 4.0; non-commercial)." The element sends `wakusei-creditschange` with `detail: { credits }` when the set changes, not at each frame.

## Off

`remove()`, `removeSource(id)`, `enableSource(id, false)` and `data="own"` do the same: they abort that source's loads (their `AbortSignal`), free its tiles and records, take its window or points off the picture, draw again, and drop its credit. The picture is the first one again, and a source that is switched on again is read again.

## The limits

- **Memory.** One budget for all the tiles of a view, `TILE_BUDGET_BYTES`: 48 MB of decoded tiles (a picture counts with its mipmaps, 4/3 of its bytes), the least recently used out first, and never a tile the window in view needs. A window that does not fit is not drawn half made, and the body keeps the picture it has. The tiles of every body in the view share the budget.
- **Requests.** At most six loads in flight for a source (`MAX_IN_FLIGHT`), and a load starts only because the view changed: at rest the door sends nothing. A window that failed is asked for again only when the view has changed, not on a timer.
- **Bad data.** A tile that throws, comes back empty, is not a picture or has a size that is not a number is counted in the source book's `stats().failed` and never drawn. A small body with a number that is not finite is left out and counted.
- **Terms.** The package's own sources are never non-commercial or share-alike, and a test holds that. A caller's may be either, and the credit line says so.

## What stays as it was

Every attribute and function is as it was. With no source the picture is the same one, drawn from the same tiles, and `credits()` names the package's own sources only. `tiles`, `texture-base` and `texture-far-base` mean what they meant. One thing is different: a window of tiles that could not be made is no longer tried again after 30 seconds; it is tried again when the view changes.
