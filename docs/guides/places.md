---
title: Places on the Moon and Mars
section: how-to
order: 20
description: "Every landing, rover, crash and impact site on the Moon and Mars and the named features of their surfaces, each with a position, a date, an operator and a source, in two tables of 33 and 36 kB gzipped; and the Sun's point, the terminator and the local solar time on any body."
---

`/places` is about where things are on the surface of the Moon and Mars. `/places/moon` and `/places/mars` are one list each: the sites where a craft reached the surface (landed, drove, crashed or was sent to hit it) and the named features (maria, mountains, valleys, large craters). Each place has a latitude and longitude, its name in English and Japanese, and where it comes from. `/places` holds the record's shape, the lookups over a list, great-circle distances, and the helpers a page needs beside them: the sub-solar point, the terminator and the local solar time at any moment. It runs anywhere, with no DOM and no three.js, and a page pays only for the body it shows: the two tables are separate entry points, and `loadPlaces("moon")` fetches one on request.

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
| `planned` | a landing announced and not yet flown | 0 | 0 |
| `feature` | a named feature of the surface, from the IAU's list | 768 | 914 |

A site's record has the `mission` (the catalogue's own name for the object), the `operator` (the agency or company's code as the catalogue gives it), its `country`, the `date` (UTC, to the minute where the source gives the time, to the day or the month where it does not), the `outcome` (`crewed`, `soft`, `hard` or `impact`) and, where there is one, the landing site's own name (`site`: `Statio Tranquillitatis`, `Octavia E. Butler Landing`), a `note` from the catalogue and, where it is known, the time it stopped working (`until`). A feature has its IAU type with a plain word for it in English and Japanese, its size in kilometres and the date its name was approved. Moon sites are the six crewed landings, the Soviet, American, Chinese, Indian, Japanese, Israeli and commercial landers, the rovers, and the impact sites of Ranger, Luna, Lunar Orbiter, the Saturn upper stages, LCROSS, GRAIL and the rest. Mars has the landers and rovers from Mars 2 to Zhurong, and the craft lost on arrival (Mars Polar Lander, the two Deep Space 2 probes, Beagle 2, Schiaparelli). The features are the maria and every type of surface feature of the Gazetteer except albedo features, plus the craters of 80 km and more and a handful of small famous ones (Aristarchus, Kepler, Jezero).

**Names.** Every place has its English name, and its Japanese name is its usual one where there is one: the maria, the lakes, bays and marshes of the Moon, the ocean, the main ranges, the craters and Mars features a reader knows (126 on the Moon, 38 on Mars: 静かの海, 嵐の大洋, アルプス谷, ティコ, オリンポス山, マリネリス峡谷, ヘラス平原). Every other feature keeps its IAU Latin name as its Japanese name (地形の名前は、よく知られたもの以外は IAU のラテン語名のままです). `findPlace` matches the English, the Japanese and the Latin form ("Mare Tranquillitatis" and "静かの海").

No **planned landing** is held yet. Their dates move, and a date is held only when an agency's own announcement has been typed in by hand with the day it was read (`planned: { date, status, read }`); none has been, so `placesOfKind(places, "planned")` is empty today.

## Where, and how sure

A place's `lat` is the planetocentric latitude, north positive, and its `lon` the east longitude from -180 to 180. The Moon's longitudes are in the mean-Earth/polar-axis frame, Mars's in the IAU frame; the Gazetteer writes Mars's from 0 to 360 east and they are converted. **Every Mars place is planetocentric.** The Gazetteer's features are. Each lander takes one source whose latitude is planetocentric, or a planetographic one is converted with tan(planetocentric) = 0.98826 x tan(planetographic) (the IAU 2000 radii, 3396.19 and 3376.2 km, differ by 0.2 degree at 20 degrees latitude and more further north), and its `source.latitude` says which: `planetocentric` (NSSDCA's Viking pages, the Mars Orbital Data Explorer's radio-tracking positions of Spirit, Opportunity and Mars Pathfinder), `converted` (Phoenix, printed as 68.22 N and taken as planetographic: 67.99 N here) or `not stated` (GCAT's rows and NASA GISS's InSight figure, whose conventions their pages do not give). Five Mars records moved from GCAT's: Viking 1 by 24 km, Mars Pathfinder and Sojourner by 22 km (GCAT has Pathfinder's planetographic 19.33 N), Phoenix by 14 km and InSight by 3 km.

On the Moon the positions of the sites are NASA's: its "Table of Anthropogenic Impacts and Spacecraft on the Moon", which carries the positions from LRO images. Where the table has one for a craft that GCAT lists, the record has the table's (`source.id` is `nssdca`), and GCAT's own figure is kept in `gcatPosition` when the two differ by more than 0.05 degree. This replaced eighteen of GCAT's lunar positions; three of them were plain errors in the catalogue, which a page would have drawn on the wrong side of the equator or the prime meridian: Surveyor 1 (the catalogue has 2.47 degrees north, NASA's table 2.47 south), IM-2 Athena (29.2 degrees west against 29.2 east) and the Apollo 16 subsatellite (listed at 0, 0). A few craft are in the table with only a rough position, or in the catalogue only with one; those records have `approximate: true`, which also marks a position given to a degree or less: the real place can be some tens of kilometres from the point (Luna 2, Luna 7, Luna 8, Hiten, Lunar Prospector, the Chandrayaan-1 impact probe; on Mars Mars 2 and Mars 6 and the Deep Space 2 and Polar Lander craft, whose positions are given to a degree or less). Luna 9 is marked too: its position is the first Soviet report's, and NASA's table says the lander is not at that spot (it differs from the catalogue's by 0.75 degree, 23 km). The other Mars sites are GCAT's.

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

A `when` that is not a `Date` or a number is a `TypeError`, an invalid or non-finite one a `RangeError`. A latitude or longitude that is not a finite number is a `RangeError`. A body that has no places (`loadPlaces("venus")`, `placeDistanceKm("venus", ...)`) is a `RangeError` that names the two that do. `findPlace` gives `undefined` for a name it does not know, `nearestPlace` for an empty list.

## Where the numbers come from

A page that shows places owes each source its credit: `PLACES_CREDITS` from `/places` has the line to print, the licence and the address for every `source.id` the tables use. The lander catalogue's is a condition of its licence: "data from GCAT (J. McDowell, planet4589.org/space/gcat)".

The positions of the Moon's sites are from NASA's NSSDCA, "Table of Anthropogenic Impacts and Spacecraft on the Moon" (<https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html>), a US government work. The dates, operators, countries, site names and the Mars sites are from GCAT, the General Catalog of Artificial Space Objects (J. McDowell; data from GCAT (J. McDowell, planet4589.org/space/gcat)), released under the Creative Commons Attribution 4.0 licence. The named features are from the IAU Gazetteer of Planetary Nomenclature kept by the USGS Astrogeology Science Center (<https://planetarynames.wr.usgs.gov/>), US public domain. `scripts/make-places-data.py` makes the two tables from the sources' files and `scripts/make-places-checks.py` the second-source file the test uses; [NOTICE.md](../../NOTICE.md) says how each was read. The names a page shows for the catalogue's technical object names, and the Japanese names, are written here.
