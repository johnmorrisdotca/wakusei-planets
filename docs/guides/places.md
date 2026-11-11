---
title: Places on the Moon, Mars and 31 more bodies
section: how-to
order: 20
description: "Every landing, rover, crash, impact and atmospheric-entry site on 33 bodies and the named features of their surfaces, each with a position, a date, an operator and a source, one table of up to 37 kB gzipped for each body; the places worth suggesting first are marked famous; and the Sun's point, the terminator and the local solar time on any body."
---

`/places` is about where things are on the surface of a body. `/places/moon`, `/places/mars` and 31 more (`/places/venus`, `/places/titan`, `/places/pluto`, `/places/67p` and the rest) are one list each: the sites where a craft reached the surface (landed, drove, crashed or was sent to hit it) or was lost in an atmosphere, and the named features (maria, mountains, valleys, large craters). Each place has a latitude and longitude, its name in English and Japanese, and where it comes from, and the ones a reader has heard of are marked `famous`, for a ready-made list of suggestions. `/places` holds the record's shape, the lookups over a list, great-circle distances, and the helpers a page needs beside them: the sub-solar point, the terminator and the local solar time at any moment. It runs anywhere, with no DOM and no three.js, and a page pays only for the body it shows: every table is its own entry point, and `loadPlaces("moon")` fetches one on request.

```ts
import { PLACES_MOON } from "@johnmorrisdotca/wakusei-planets/places/moon";
import { findPlace, isDaylight, localSolarTime, nearestPlace, placeDistanceKm } from "@johnmorrisdotca/wakusei-planets/places";

const eagle = findPlace(PLACES_MOON, "Apollo 11 lunar module")!;
const taurus = findPlace(PLACES_MOON, "Apollo 17 lunar module")!;
console.log(eagle.name.en, eagle.name.ja, eagle.lat.toFixed(3), eagle.lon.toFixed(3), eagle.date, eagle.operator, eagle.source.id);
console.log(Math.round(placeDistanceKm("moon", eagle, taurus)), "km from Apollo 17");
const now = Date.UTC(2026, 10, 11, 12);
console.log("Tranquility Base:", localSolarTime("moon", eagle.lon, now).toFixed(1), "o'clock by the Sun,", isDaylight("moon", eagle.lat, eagle.lon, now) ? "daylight" : "night");
console.log("nearest visited place to 20 N, 30.7 E:", nearestPlace(PLACES_MOON, 20, 30.7, "crewed", "landing", "rover")?.place.name.en);
```

## What is in the lists

| Kind | What it is | Moon | Mars |
|---|---|---|---|
| `crewed` | a landing with people aboard (the six Apollo lunar modules) | 6 | 0 |
| `landing` | a lander that worked after touchdown | 22 | 12 |
| `rover` | a rover that drove there, at the point it reached the surface (not its drive) | 13 | 7 |
| `impact` | a craft sent to hit the surface on purpose | 14 | 0 |
| `crash` | a craft that hit it and was lost (also an upper stage, an ascent stage sent down after use, an orbiter at the end of its life) | 35 | 6 |
| `entry` | a probe or orbiter lost in an atmosphere (Venus, Jupiter, Saturn: see below) | 0 | 0 |
| `planned` | a landing announced and not yet flown | 0 | 0 |
| `feature` | a named feature of the surface, from the IAU's list | 768 | 914 |

A site's record has the `mission` (the catalogue's own name for the object), the `operator` (the agency or company's code as the catalogue gives it), its `country`, the `date` (UTC, to the minute where the source gives the time, to the day or the month where it does not), the `outcome` (`crewed`, `soft`, `hard` or `impact`) and, where there is one, the landing site's own name (`site`: `Statio Tranquillitatis`, `Octavia E. Butler Landing`), a `note` from the catalogue and, where it is known, the time it stopped working (`until`). A feature has its IAU type with a plain word for it in English and Japanese, its size in kilometres and the date its name was approved. Moon sites are the six crewed landings, the Soviet, American, Chinese, Indian, Japanese, Israeli and commercial landers, the rovers, and the impact sites of Ranger, Luna, Lunar Orbiter, the Saturn upper stages, LCROSS, GRAIL and the rest. Mars has the landers and rovers from Mars 2 to Zhurong, and the craft lost on arrival (Mars Polar Lander, the two Deep Space 2 probes, Beagle 2, Schiaparelli). The features are the maria and every type of surface feature of the Gazetteer except albedo features, plus the craters of 80 km and more and a handful of small famous ones (Aristarchus, Kepler, Jezero).

## The other 31 bodies

Each has its own table, and the same record. The tables are made by `scripts/make-places-more-data.py` from the Gazetteer's files of 2026-11-11 and from the sources named in each site's `source`:

| Body | Sites | Named features kept | The cut | Famous | gzipped kB |
|---|---|---|---|---|---|
| Mercury | 1 | 401 of 621 | largest, from 69 km | 11 | 26 |
| Venus | 18 | 386 of 1,985 | 25 largest of each type | 13 | 21 |
| Io |  | 261 |  | 8 | 14 |
| Europa |  | 129 |  | 9 | 7 |
| Ganymede |  | 196 |  | 9 | 10 |
| Callisto |  | 154 |  | 4 | 7 |
| Titan | 1 | 304 |  | 15 | 17 |
| Enceladus |  | 87 |  | 7 | 6 |
| Mimas |  | 42 |  | 1 | 3 |
| Tethys |  | 53 |  | 2 | 3 |
| Dione |  | 98 |  | 3 | 6 |
| Rhea |  | 144 |  | 4 | 9 |
| Iapetus |  | 70 |  | 5 | 4 |
| Miranda |  | 18 |  | 4 | 1 |
| Ariel |  | 26 |  | 3 | 2 |
| Umbriel |  | 13 |  | 3 | 1 |
| Titania |  | 18 |  | 3 | 1 |
| Oberon |  | 10 |  | 4 | under 1 |
| Triton |  | 63 |  | 7 | 4 |
| Pluto |  | 73 |  | 7 | 8 |
| Charon |  | 15 |  | 3 | 3 |
| Ceres |  | 149 |  | 8 | 10 |
| Vesta |  | 106 |  | 5 | 7 |
| Eros | 1 |  |  | 1 | under 1 |
| Ryugu | 4 |  |  | 2 | under 1 |
| Bennu | 1 |  |  | 1 | under 1 |
| Dimorphos | 1 |  |  | 1 | under 1 |
| Tempel 1 | 1 |  |  | 1 | under 1 |
| 67P | 1 |  |  | 1 | under 1 |
| Jupiter | 2 |  |  | 1 | under 1 |
| Saturn | 1 |  |  | 1 | under 1 |

**Sites.** Venus has the Soviet landers Venera 7 to 14 and the two Vega landers (Venera 8, 9, 10, 13, 14 and Vega 1 and 2 at the positions Basilevsky and Weitz updated from Magellan's radar images; Venera 7, 11 and 12 from GCAT), the four Pioneer Venus probes (the large probe, the north, day and night probes, at the impact positions of the PDS's Pioneer Venus page, and the day probe the only one that kept sending, for about an hour) and the carrier; and the `entry` sites of Venera 4, 5 and 6, whose descent craft were crushed in the atmosphere. Mercury has MESSENGER's impact; Titan Huygens; Eros NEAR Shoemaker's touchdown; Ryugu Hayabusa2's two touchdowns, the impactor's artificial crater and MASCOT; Bennu OSIRIS-REx's sampling at Nightingale; Dimorphos DART's impact; comet Tempel 1 Deep Impact's impactor; comet 67P Philae's final resting place at Abydos; Jupiter the Galileo probe and the orbiter that was sent in after it; and Saturn Cassini's last plunge (the last three are `entry`: there is no surface to put them on). A `date` is UTC to the minute where a source gives the time. The Moon and Mars already held theirs.

**Features.** From the IAU Gazetteer of Planetary Nomenclature: its type, a plain word for it in English and Japanese, the size in kilometres (the diameter, or the length of a line; **0 where the Gazetteer gives none**, as for most features on Triton), the date the name was approved and, new here, `origin`: where the Gazetteer says the name comes from (English; the tables of the Moon and Mars do not carry it). **The cut:** a body with up to 400 features keeps all of them (Titan's 304 and Io's 261 are the largest); Mercury has 621 and keeps the 400 largest, those of 69 km and more; Venus has 1,985 and keeps the 25 largest of each of its 21 types (its sizes are widths for some types and lengths for others, so one cut on size would drop all the craters and coronae), 386 in all; and the famous ones are always in. The Moon and Mars keep what they had. Japanese names are given to the few that have a usual one in katakana (about 60 across the bodies, for review); the rest keep the IAU's Latin or other name, as on the Moon and Mars.

**Famous** (`famous: true`) marks the places a page can suggest first, on every body including the Moon (30: the six Apollo lunar modules, Luna 2 and 9, Surveyor 1, Lunokhod 1, Chang'e 4 and 5, Chandrayaan-3, SLIM, Odysseus, Tycho, Copernicus, Aristarchus, Kepler, Shackleton, Clavius, Plato, Tsiolkovskiy and the large maria) and Mars (28: the landers and rovers from Mars 3 to Zhurong, Olympus Mons, Valles Marineris, Gale, Jezero, Hellas, the Tharsis volcanoes and the great plains). It is a short list on each body (no more than 30): Caloris Planitia and MESSENGER's impact on Mercury, Maxwell Montes, Maat Mons and Venera 9 on Venus, Loki Patera and Pele on Io, Conamara Chaos on Europa, Kraken Mare and Huygens on Titan, Sputnik Planitia on Pluto, Occator and Ahuna Mons on Ceres.

**Names.** Every place has its English name, and its Japanese name is its usual one where there is one: the maria, the lakes, bays and marshes of the Moon, the ocean, the main ranges, the craters and Mars features a reader knows (126 on the Moon, 38 on Mars: 静かの海, 嵐の大洋, アルプス谷, ティコ, オリンポス山, マリネリス峡谷, ヘラス平原). Every other feature keeps its IAU Latin name as its Japanese name (地形の名前は、よく知られたもの以外は IAU のラテン語名のままです). `findPlace` matches the English, the Japanese and the Latin form ("Mare Tranquillitatis" and "静かの海").

No **planned landing** is held yet. Their dates move, and a date is held only when an agency's own announcement has been typed in by hand with the day it was read (`planned: { date, status, read }`); none has been, so `placesOfKind(places, "planned")` is empty today.

## Where, and how sure

A place's `lat` is the planetocentric latitude, north positive, and its `lon` the east longitude from -180 to 180. The Moon's longitudes are in the mean-Earth/polar-axis frame, Mars's in the IAU frame; the Gazetteer writes Mars's from 0 to 360 east and they are converted. **Every Mars place is planetocentric.** The Gazetteer's features are. Each lander takes one source whose latitude is planetocentric, or a planetographic one is converted with tan(planetocentric) = 0.98826 x tan(planetographic) (the IAU 2000 radii, 3396.19 and 3376.2 km, differ by 0.2 degree at 20 degrees latitude and more further north), and its `source.latitude` says which: `planetocentric` (NSSDCA's Viking pages, the Mars Orbital Data Explorer's radio-tracking positions of Spirit, Opportunity and Mars Pathfinder), `converted` (Phoenix, printed as 68.22 N and taken as planetographic: 67.99 N here) or `not stated` (GCAT's rows and NASA GISS's InSight figure, whose conventions their pages do not give). Five Mars records moved from GCAT's: Viking 1 by 24 km, Mars Pathfinder and Sojourner by 22 km (GCAT has Pathfinder's planetographic 19.33 N), Phoenix by 14 km and InSight by 3 km.

On the Moon the positions of the sites are NASA's: its "Table of Anthropogenic Impacts and Spacecraft on the Moon", which carries the positions from LRO images. Where the table has one for a craft that GCAT lists, the record has the table's (`source.id` is `nssdca`), and GCAT's own figure is kept in `gcatPosition` when the two differ by more than 0.05 degree. This replaced eighteen of GCAT's lunar positions; three of them were plain errors in the catalogue, which a page would have drawn on the wrong side of the equator or the prime meridian: Surveyor 1 (the catalogue has 2.47 degrees north, NASA's table 2.47 south), IM-2 Athena (29.2 degrees west against 29.2 east) and the Apollo 16 subsatellite (listed at 0, 0). A few craft are in the table with only a rough position, or in the catalogue only with one; those records have `approximate: true`, which also marks a position given to a degree or less: the real place can be some tens of kilometres from the point (Luna 2, Luna 7, Luna 8, Hiten, Lunar Prospector, the Chandrayaan-1 impact probe; on Mars Mars 2 and Mars 6 and the Deep Space 2 and Polar Lander craft, whose positions are given to a degree or less). Luna 9 is marked too: its position is the first Soviet report's, and NASA's table says the lander is not at that spot (it differs from the catalogue's by 0.75 degree, 23 km). The other Mars sites are GCAT's.

**Beyond the Moon and Mars.** Every feature is the Gazetteer's centre point: its shapefiles are "in east longitude, planetocentric latitude" (the Gazetteer's own page says so), kept as east from -180 to 180 (Venus's, Mercury's and the moons' 0 to 360 are converted); Vesta's longitudes are in the Gazetteer's own system for the asteroid. A site's `source.latitude` is `not stated` where its source does not say (every site on these bodies except NEAR's, which the PDS file calls planetocentric), and the gas giants' entry points are as NASA prints them (Galileo's probe 6.5 N, 4.4 W; Cassini 9.4 N, 53 W: neither page names the system). Where a source's position is better than GCAT's it is used and GCAT's stays in `gcatPosition` when the two differ by more than 0.05 degree: Venera 9 and 10 by 1.0 and 0.8 degree, Vega 2 by 3.5, the Pioneer Venus bus by 6, Cassini by 7.5, and the Pioneer Venus north probe by 69 degrees, because GCAT seems to have its latitude and longitude the wrong way round (4.4 N, 60.1 E against the PDS's 59.3 N, 4.8 E). MESSENGER, Huygens and DART agree with GCAT's. **Less sure:** Venera 4 to 7, 11 and 12, Bennu's Nightingale and Jupiter's Galileo orbiter are GCAT's rounded figures (`approximate`); NEAR's touchdown on Eros is typed from NASA's PDS file (37.2 S, 278.4 W, that is 81.6 E), a file that refused automated reading, so it is not checked against the page; Philae's Abydos is the paper's own quote of an earlier paper, in the comet-fixed frame; Tempel 1's impact point is in the shape-model frame of 2013 (it was 26 S, 15 E in the older one); the Galileo orbiter's longitude is the catalogue's. The sites of Itokawa (Hayabusa's two touchdowns and Minerva), Philae's first touchdown at Agilkia, Rosetta's final descent, the Minerva-II rovers and the Magellan, Pioneer Venus Orbiter and Venus Express ends are not held: no position was found that could be checked. The test pins each of these positions as typed, with the source named in the record.

The test holds twenty-one positions to sources other than the ones the table takes them from: NASA's Apollo 11, Apollo 17 and Viking 1 pages, the IAU Gazetteer's named landing sites (Statio Tranquillitatis, Guang Han Gong and the Stations of Chang'e 4, 5 and 6 and Chandrayaan-3), NASA GISS's list of Mars landers (Curiosity, Perseverance, Spirit, Opportunity, Phoenix, Zhurong), the Mars Orbital Data Explorer's Viking positions and NSSDCA's Mars Pathfinder page (a planetographic figure the test converts). They agree to 0.012 degree (700 m on Mars, 360 m on the Moon) except Luna 9 (0.8) and Mars Pathfinder (0.3, an estimate made from Viking pictures before the landing).

## Lookups

```ts
import { PLACES_MARS } from "@johnmorrisdotca/wakusei-planets/places/mars";
import { findPlace, listPlaces, placesNear, placesOfKind } from "@johnmorrisdotca/wakusei-planets/places";

console.log(placesOfKind(PLACES_MARS, "rover").map((place) => place.name.en).join(", "));
const jezero = findPlace(PLACES_MARS, "Jezero")!;
console.log(jezero.feature?.diameterKm, "km;", placesNear(PLACES_MARS, jezero.lat, jezero.lon, 3).filter((n) => n.place.kind !== "feature").map((n) => n.place.name.en));
console.log((await listPlaces("moon", "crash", "impact")).length, "crash and impact sites on the Moon");
```

`findPlace(list, text)` takes an id (`mars/perseverance`), an English name in any case or a Japanese name; `placesOfKind(list, ...kinds)` filters; `placesNear(list, lat, lon, withinDeg)` gives the places within an angle, nearest first, and `nearestPlace(list, lat, lon, ...kinds)` the nearest of some kinds (the named features crowd the Apollo sites, so give the visited kinds when you want a landing). `listPlaces(body, ...kinds)` and `loadPlaces(body)` load the table on request. `placeDistanceKm(body, a, b)` is the great-circle distance over the surface on a sphere of the body's equatorial radius (a place or a `{ lat, lon }` each).

## The Sun on a body

```ts
import { subSolarPoint, terminator } from "@johnmorrisdotca/wakusei-planets/places";

const day = Date.UTC(2026, 10, 11, 12);
const sun = subSolarPoint("mars", day);
console.log("The Sun is overhead at", sun.lat.toFixed(1), "N,", sun.lon.toFixed(1), "E on Mars");
console.log(terminator("moon", day, 36).length, "points on the Moon's terminator");
```

`subSolarPoint(body, when)` is where the Sun is overhead, from the package's own ephemeris and the body's IAU pole and prime meridian; `terminator(body, when, points)` is the great circle 90 degrees from it, for a line on a map or a globe; `localSolarTime(body, lon, when)` is the hour of the body's own solar day at a longitude (12 under the Sun, an hour later for every 15 degrees east); `isDaylight(body, lat, lon, when)` is whether the Sun's centre is above a smooth horizon. They work for any body the package has a pole for, not only these two; `angleBetween` is the angle between two points.

## When the input is wrong

A `when` that is not a `Date` or a number is a `TypeError`, an invalid or non-finite one a `RangeError`. A latitude or longitude that is not a finite number is a `RangeError`. A body that has no places (`loadPlaces("earth")`, `placeDistanceKm("earth", ...)`) is a `RangeError` that names the bodies that do, and so is a distance on a body with no radius in `BODIES` (Eros, Ryugu, Bennu, Dimorphos and the two comets: they are not spheres). `findPlace` gives `undefined` for a name it does not know, `nearestPlace` for an empty list.

## Where the numbers come from

A page that shows places owes each source its credit: `PLACES_CREDITS` from `/places` has the line to print, the licence and the address for every `source.id` the tables use. The lander catalogue's is a condition of its licence: "data from GCAT (J. McDowell, planet4589.org/space/gcat)".

The positions of the Moon's sites are from NASA's NSSDCA, "Table of Anthropogenic Impacts and Spacecraft on the Moon" (<https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html>), a US government work. The dates, operators, countries, site names and the Mars sites are from GCAT, the General Catalog of Artificial Space Objects (J. McDowell; data from GCAT (J. McDowell, planet4589.org/space/gcat)), released under the Creative Commons Attribution 4.0 licence. The named features are from the IAU Gazetteer of Planetary Nomenclature kept by the USGS Astrogeology Science Center (<https://planetarynames.wr.usgs.gov/>), US public domain. The other bodies' sites are typed from NASA's Photojournal and mission pages (MESSENGER, Huygens, Galileo, Cassini), the Planetary Data System's Pioneer Venus summary, NASA's Technical Reports Server (Venus's landers), and the papers named in each record's `source.url` (DART, Tempel 1, Philae), with the dates, operators and the rest from GCAT. `scripts/make-places-data.py` makes the Moon's and Mars's tables and `scripts/make-places-more-data.py` the others' from the sources' files and `scripts/make-places-checks.py` the second-source file the test uses; [NOTICE.md](../../NOTICE.md) says how each was read. The names a page shows for the catalogue's technical object names, and the Japanese names, are written here.
