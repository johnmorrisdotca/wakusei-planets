---
title: Search every point of interest on every body
section: how-to
order: 21
description: "One list for each of 52 bodies, fetched only when asked for: every name the IAU Gazetteer gives (16,108 on 50 targets, with the Moon's 7,064 lettered craters), every landing, rover, crash and impact site, and the equipment left on a surface. The search is in English and Japanese, an id stays what it was, and each row says where it comes from."
---

`/places/search` is for a page that lets a reader find a point of interest and keep it: a crater on the Moon, a ridge on Mars, the parachute of a rover, Hayabusa2's target marker on Ryugu. It holds a list for each of 52 bodies. `/places/<body>` stays as it was: the full record of the larger places, with the names' origins, for the Moon, Mars and 31 more bodies. The search lists are the complete ones, and a row is small: the Moon's 9,087 Gazetteer names and 110 sites are 41 kB and 98 kB gzipped, in two lists.

```ts
import { hitToPlace, loadPlaceSearch, placeHitUrl, resolvePlaceId, searchPlaces } from "@johnmorrisdotca/wakusei-planets/places/search";

const moon = await loadPlaceSearch("moon", { satellites: true });
for (const hit of searchPlaces(moon, "tycho", { limit: 3 })) console.log(hit.id, hit.typeWord.en, hit.diameterKm, "km", hit.lat, hit.lon);
console.log(searchPlaces(moon, "静かの海")[0]?.name.en, "from Japanese");
const mars = await loadPlaceSearch("mars");
const olympus = searchPlaces(mars, "olympus mons")[0]!;
console.log(olympus.id, placeHitUrl(olympus), hitToPlace(olympus).feature?.typeWord.ja);
console.log(resolvePlaceId("mercury/kunisada-2"), "is what a favourite saved as mercury/kunisada-2 now is");
```

## The lists

`loadPlaceSearch(body)` fetches one list, as a chunk of its own the first time (a page that never searches a body does not carry it), and returns the rows: the sites first, by date, then the named features in the order of their Gazetteer ids. `searchPlaces` ranks them. The Moon's lettered craters (the Gazetteer's "satellite features", such as Tycho A: craters lettered after a nearby named crater) are 7,064 rows and a list of their own: `loadPlaceSearch("moon", { satellites: true })` adds them. Each list is also an entry point of its own, `/places/search/<body>` (`/places/search/moon-satellites` for those), for a page that imports one directly.

| Body | Named features | Sites | Planned | Hardware | kB gzipped |
|---|---|---|---|---|---|
| `moon` | 2,023 | 92 | 8 | 10 | 41 |
| `moon-satellites` | 7,064 |  |  |  | 98 |
| `mars` | 2,054 | 25 | 1 | 66 | 38 |
| `venus` | 1,985 | 18 |  |  | 30 |
| `mercury` | 613 | 1 |  |  | 13 |
| `titan` | 304 | 1 |  |  | 7 |
| `io` | 261 |  |  |  | 7 |
| `ganymede` | 196 |  |  |  | 6 |
| `ceres` | 149 |  |  |  | 5 |

The others are 3 to 4 kB each and the smallest under 3: `callisto` 154, `rhea` 144, `europa` 129, `vesta` 106, `dione` 95, `enceladus` 87, `pluto` 73, `iapetus` 70, `triton` 63, `tethys` 53, `mimas` 42, `ariel` 26, `miranda` 18, `titania` 18, `charon` 15, `umbriel` 13 and `oberon` 10 named features; `eros` 41 and 1 site, `bennu` 36 and 1 site, `dimorphos` 11 and 1 site, `ryugu` 13, 4 sites and 2 pieces of hardware; `jupiter` (2 sites), `saturn`, `tempel-1` and `67p` (1 site each, for the Gazetteer has no names there); and the 19 small bodies `lutetia` 37, `gaspra` 34, `ida` 25, `phoebe` 25, `steins` 24, `mathilde` 23, `phobos` 20, `itokawa` 17, `donaldjohanson` 10, `hyperion` 5, `dinkinesh` 4, `amalthea` 4, `janus` 4, `dactyl` 2, `deimos` 2, `didymos` 2, `epimetheus` 2, `proteus` 1 and `thebe` 1.

Every list holds about 2 kB of the decoder and the type words, which a bundler shares between the lists. The 19 small bodies at the end of the list are new: the Gazetteer names features on them, and `/places/<body>` has no full record for them, so their search list is all there is. Puck and Nix have none, because every name the Gazetteer has for them is without a position (see below).

A row (`PlaceHit`) has:

- `id`: `<body>/<slug>`, the id that `/places/<body>` uses for the same place. A favourite keeps it.
- `name` in English and Japanese. A feature's Japanese name is the package's own where it has one (the 126 on the Moon and 38 on Mars a reader knows: ティコ, オリンポス山); every other feature keeps its IAU name, as in `/places`.
- `kind` (`crewed`, `landing`, `rover`, `crash`, `impact`, `entry`, `planned`, `feature` or the new `hardware`), `typeWord` (a plain word in English and Japanese: for a feature its type, `crater`, `plain`, `satellite crater`; for a site its kind, `rover`, `crash site`), and for a feature `type`, the Gazetteer's own name for it (`Crater, craters`).
- `lat` and `lon`: planetocentric latitude and east longitude from -180 to 180, to a thousandth of a degree for a feature, as the full lists have them for a site.
- `diameterKm`: a feature's size, 0 where the Gazetteer gives none. `date` and `approximate` for a site, as in the full records.
- `source`: where the row comes from, with the date its file was read. A feature's `ref` is its Gazetteer feature id, and `placeHitUrl(hit)` is the Gazetteer's page for it (the origin of the name and its approval date are there). A site's source is one of `PLACES_CREDITS`.

`searchPlaces(hits, text)` matches the English name or the Japanese name, ignoring case and accents: the whole name first, then a name that starts with the text, then a word that does, then any name that holds it; the visited sites come before the features and a larger feature before a smaller one. Give it the lists of several bodies together to search them all. `hitToPlace(hit)` makes a `Place` of a row for the parts of the package that take one (`placeMarks`, a list of your own for `goToPlace`); it has no `origin` and an empty `approved`, because a search list does not hold them.

## Ids that do not change

A favourite saved today must resolve after a refresh. Every id of 0.66.0 (4,654 of them) is in the lists, and a test holds all of them. A new id is `<body>/<slug of the Gazetteer's clean name>`; where that is taken by another place, it is `<body>/<slug>-<Gazetteer feature id>`, never a count, because a count depends on the order of the rows and an id that depends on it can move.

Ten ids of 0.66.0 had a count added (`mercury/kunisada-2`, `dione/haemon-2` and eight more): the Gazetteer's shapefiles hold a feature that straddles a boundary in two parts, with one feature id, and the package had listed each part. The search lists have one row for the feature, and `resolvePlaceId` turns the old id into the one that lives on. It is also where an id would be redirected if the IAU renamed a feature (`Akasa Linea` became `Akasa Collum` on Arrokoth in December 2025). A page that stores ids calls `resolvePlaceId` on each one it reads back.

Two places that really are two (`mars/schiaparelli`, the lander, and `mars/schiaparelli-2`, the crater; `moon/falcon` and `moon/falcon-2`) keep both ids.

## The hardware

`hardware` is the new `PlaceKind`: equipment left on a surface, and hardware that fell to it. It is held in the search lists only (never in `/places/<body>`, so a page that marks places does not get it). 78 rows, every one from GCAT, J. McDowell's lander catalogue (planet4589.org/space/gcat, CC BY 4.0, updated 2026-11-18), with GCAT's position (marked `approximate` where GCAT gives it to a degree or less) and its date:

- **The Moon (10):** the Apollo 11 passive seismometer and laser reflector (EASEP), the experiment packages (ALSEP) of Apollo 12, 14, 15, 16 and 17, the Apollo 14 equipment cart (MET), EagleCam (ejected from Odysseus) and Chang'e 6's ejected camera (Yidong Xiangji).
- **Mars (66):** Tianwen-1's ejected camera (Fenli) and the pieces that fell to the surface in the descents of Mars 2, 3 and 6, Viking 1 and 2, Pathfinder, Polar Lander, Beagle 2, Spirit, Opportunity, Phoenix, Curiosity, Schiaparelli, InSight, Perseverance and Tianwen-1: heat shields, backshells, parachutes, cruise stages, aeroshells and their covers, the balance weights, the motors of the Soviet landers, the belly pan and the helicopter cover of Perseverance.
- **Ryugu (2):** Hayabusa2's target markers A and B.

Left out: GCAT's pieces with no position, spacesuits and backpacks, and pieces GCAT attaches to another record. Two rovers that rode down aboard Hakuto-R Mission 1 and were destroyed in its impact, Rashid and SORA-Q, are `rover` records in `/places/moon` (and so 15 rovers there now, not 13).

## Named, but with no position

The Gazetteer has 16 approved names that no file gives a position. They are not in the lists:

- In its shapefiles the centre is 0 N, 0 E and there are no bounds: Gleti and Metztli (Nix); Bogle, Butz and Lob (Puck); Fab Dorsum (Dinkinesh); Afar Lobus and Olduvai Lobus (Donaldjohanson).
- Arrokoth and Selam have no shapefile (the Gazetteer's page for each lists the names and gives every one the centre 0.00, 0.00): Akasa Collum, Ka'an Arcus, Sky, Weeyo Lobus and Wenu Lobus on Arrokoth; Lẹwa Lobus, Piękna Lobus and Uwoduhi Dorsum on Selam.

Sites with no position in any source are left out the same way: Venera 3, Mars Climate Orbiter, the Moon's 14 craft that NASA's table gives "Unknown", the decays of Pioneer Venus Orbiter, Magellan and Venus Express, the Fobos failures. Where a position is not in a source this page does not guess.

## Where the numbers come from

- **Features:** the IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology, public domain), the nightly centre-point shapefiles of its 50 targets as read on 2026-11-18 (16,128 rows, 16,108 features once the ones with no position and the second parts are taken off). Each has its Gazetteer feature id. The files' own words: "in east longitude, planetocentric latitude". Vesta's longitudes are in the Gazetteer's own system for the asteroid, as in `/places/vesta`. A body's list is complete: the cut of `/places/<body>` (the Moon's craters under 80 km, Venus's 25 of each type) does not apply here.
- **Sites:** the full lists of `/places/<body>`, unchanged but for Rashid and SORA-Q, and the planned landings, whose nine pages were read again on 2026-11-18: the dates and sites are as they were on 2026-11-11.
- **The plain words of the types** are the package's table; the four types the earlier lists did not need are `Satellite Feature` (satellite crater, 付随クレーター), `Saxum` (boulder, 岩塊), `Lobus` (lobe, ローブ) and `Collum` (neck, くびれ).
- **Made by** `scripts/make-places-search-data.py` (and `make-places-added-data.py` for the hardware), from the Gazetteer's files and GCAT's catalogue; nothing is fetched by the scripts.

## When the input is wrong

`loadPlaceSearch` rejects an unknown body with a `RangeError`. `searchPlaces` returns `[]` for empty text or when nothing matches. `resolvePlaceId` returns an id it does not know as it is.
