---
title: What is nearby, and when bodies come close
section: how-to
order: 18
description: The bodies nearest to a body on a date, by angle in the sky or distance in space, and the moments two bodies come closest, checked against JPL Horizons to seconds of time.
---

`/nearest` answers three questions about the Sun, the planets, the dwarf planets, the minor bodies (Vesta, Pallas, Chiron, Pholus, Halley) and the moons: *what is next to this one on a date?*, *when do these two come closest?* and *how far apart are these two, and how far apart do they get?* It is good for a game ("which planet is the Moon beside tonight?"), a calendar of conjunctions, or a label on a chart. It runs anywhere, with no browser, on the package's own positions.

```ts
import { closestApproach, conjunctions, distance, distanceRange, nearest, within } from "@johnmorrisdotca/wakusei-planets/nearest";

const date = Date.UTC(2026, 11, 27, 16);
console.log(nearest("moon", { kind: "planet", count: 2, date }).map((row) => `${row.id} ${row.angle.toFixed(2)} degrees`).join(", "));
console.log(within("jupiter", 1.5, { date }).map((row) => row.id).join(", "));
console.log(nearest("earth", { by: "space", kind: "planet", count: 1, date })[0]?.distanceAu.toFixed(2), "au");

const great = closestApproach("jupiter", "saturn", { from: Date.UTC(2020, 11, 1), to: Date.UTC(2021, 0, 1) });
console.log(great.time.toISOString(), great.angle?.toFixed(2), "degrees");
console.log(distance("earth", "mars", date).distanceAu.toFixed(2), "au now apart");
console.log(distanceRange("earth", "mars", { from: Date.UTC(1900, 0, 1), to: Date.UTC(2100, 0, 1) }).max.distanceAu.toFixed(2), "au at most");
console.log(conjunctions({ from: Date.UTC(2023, 0, 1), to: Date.UTC(2024, 0, 1), bodies: ["venus", "jupiter"], within: 2 }).length, "close approaches");
```

## The six functions

| Function | Gives |
|---|---|
| `nearest(target, options)` | the bodies nearest to `target` on a date, nearest first |
| `within(target, radius, options)` | every body inside a radius, nearest first |
| `closestApproach(a, b, { from, to })` | the moment two bodies come closest in a span, and how close |
| `conjunctions({ from, to, within, bodies })` | every close approach of every pair of bodies in a span, soonest first |
| `distance(a, b, date)` | the straight-line distance between two bodies on a date, in km and au |
| `distanceRange(a, b, { from, to })` | the least and the greatest distance of two bodies over a span, each with its moment |

A body is a name such as `"mars"`, `"moon"` or `"io"`, the same names as the rest of the package. The Sun, the planets, the dwarf planets, the minor bodies and the moons are all searched (a minor body's `kind` is `asteroid`, `centaur` or `comet`). Stars are in [`/stars`](stars.md); a star is not a target here.

## The options

The same options mean the same in every function, and are the names the other packages of the family use for the same things.

| Option | Meaning |
|---|---|
| `by` | `"sky"` (the default): the angle between the two bodies in the sky of the observer. `"space"`: the distance between their centres |
| `date` | a `Date` or milliseconds since 1970 (UTC); default now |
| `count` | how many to return: 5 by default, or every body inside `within` when that is given |
| `within` | only bodies this close: degrees for `by: "sky"`, kilometres for `by: "space"` |
| `kind` | only this kind (`"planet"`, `"dwarf-planet"`, `"asteroid"`, `"centaur"`, `"comet"`, `"moon"` or `"star"`, which is the Sun), or a list of kinds |
| `bodies` | search only these bodies |
| `observer` | where the sky is seen from: the Earth's centre by default; `{ latitude, longitude, heightM }` for a place on the Earth; or a body's name (`"mars"`) for the sky of that body |

Stars have a `magnitude` filter in `/stars`; this package has no brightness for a body, so there is no `magnitude` option here.

## In the sky

`by: "sky"` is the angle between the directions to the two bodies, in degrees from 0 to 180, as the observer sees them. It is worked out with an arc tangent of the cross and dot products, so it is as exact near 0 (a conjunction) and 180 (opposition) as it is at 90. The directions are astrometric, the way JPL Horizons' RA and DEC are: each body is where it was when its light left it (a little over a second ago for the Moon, hours for Neptune), seen from where the observer is now. Aberration and light bending are not added: they move two bodies that are near each other almost together.

The Moon is close enough that where you stand changes the answer by up to a degree, so give a place for it. On 27 December 2026 Ganymede is 2.3 degrees from the Moon seen from Vancouver, and 1.4 seen from the Earth's centre.

```ts
import { nearest } from "@johnmorrisdotca/wakusei-planets/nearest";

const date = Date.UTC(2026, 11, 27, 16);
const centre = nearest("moon", { bodies: ["ganymede"], date })[0];
const vancouver = nearest("moon", { bodies: ["ganymede"], date, observer: { latitude: 49.28, longitude: -123.12 } })[0];
console.log(centre?.angle.toFixed(2), vancouver?.angle.toFixed(2));
console.log(nearest("earth", { observer: "mars", count: 1, date })[0]?.id, "is next to the Earth in the sky of Mars");
```

A body is never in its own sky: the target is left out, so is the body the sky is seen from (the Earth, for an observer on it), and a sky target that is the observer's own body throws a `RangeError`.

## In space

`by: "space"` is the straight-line distance between the two centres at the date, in kilometres (`distanceKm`) and astronomical units (`distanceAu`). There is no light time in it: it is the geometry of one instant. The observer does not matter and is ignored.

## Closest approach and conjunctions

`closestApproach` and `conjunctions` look at the separation as it changes with time. They scan the span in coarse steps: the step is the fastest body's period over forty, and never more than two days (Io goes round in 1.8 days, so a search with Io steps about every hour; Mars and Jupiter step every two days). Where a separation falls and then rises they narrow the minimum with a golden-section search to about a second of time (the search stops when the bracket is under half a second).

`closestApproach(a, b, { from, to })` returns the smallest separation in the span. If the separation only falls or only rises through the span, the smaller end is returned and `atEdge` is `true`. `conjunctions` returns every minimum of every pair of `bodies` that is within `within` (5 degrees by default for the sky, all of them for space), soonest first. The default bodies are the Sun and Mercury to Neptune, less the body the sky is seen from. A minimum is of the separation of the two centres, so a pair that passes in front of each other (a transit, an occultation) is a minimum of a fraction of a degree, not zero.

```ts
import { conjunctions } from "@johnmorrisdotca/wakusei-planets/nearest";

const found = conjunctions({ from: Date.UTC(2026, 0, 1), to: Date.UTC(2027, 0, 1), within: 1 });
for (const one of found.slice(0, 5)) console.log(one.a, one.b, one.time.toISOString().slice(0, 16), one.angle?.toFixed(2));
```

## Distance, and how far apart two bodies get

`distance(a, b, date)` is `by: "space"` for any two bodies, one call: `{ a, b, time, distanceKm, distanceAu, uncertaintyKm }`. The date is a `Date` or milliseconds, and now when left out. `distanceRange(a, b, { from, to })` scans the span as `closestApproach` does and returns `{ a, b, min, max }`, each `{ time, distanceKm, distanceAu, uncertaintyKm, atEdge }`. Each turning point is narrowed to about a second of time by the same golden-section search; the greatest is the least of the negated distance. If the distance only falls or only rises through the span, the end that is the extreme is returned with `atEdge: true`.

```ts
import { distance, distanceRange } from "@johnmorrisdotca/wakusei-planets/nearest";

const { min, max } = distanceRange("earth", "mars", { from: Date.UTC(1900, 0, 1), to: Date.UTC(2100, 0, 1) });
console.log(min.time.toISOString().slice(0, 10), min.distanceAu.toFixed(3), "au;", max.time.toISOString().slice(0, 10), max.distanceAu.toFixed(3), "au");
console.log(Math.round(distance("jupiter", "io", Date.UTC(2026, 10, 8)).distanceKm), "km from Jupiter to Io");
```

### The planets, from 1900 to 2100

The least and the greatest distance of each pair of planets over the 200 years (`node scripts/distance-table.ts` prints it), in astronomical units, and the year of each. A star after a year marks an extreme at the end of the span, not a turning point inside it. Earth and Mars come to 0.373 au on 27 August 2003 and go to 2.676 au in 2066.

| Pair | Least (au) | Year | Greatest (au) | Year |
|---|---|---|---|---|
| Mercury and Venus | 0.261 | 2085 | 1.187 | 2059 |
| Mercury and Earth | 0.549 | 2061 | 1.452 | 2034 |
| Mercury and Mars | 0.966 | 1918 | 2.080 | 1908 |
| Mercury and Jupiter | 4.595 | 2010 | 5.810 | 2075 |
| Mercury and Saturn | 8.705 | 1915 | 10.379 | 1900 |
| Mercury and Uranus | 17.897 | 2051 | 20.486 | 2010 |
| Mercury and Neptune | 29.483 | 2041 | 30.656 | 1958 |
| Venus and Earth | 0.264 | 2093 | 1.736 | 1960 |
| Venus and Mars | 0.654 | 2052 | 2.394 | 2002 |
| Venus and Jupiter | 4.223 | 2070 | 6.182 | 2005 |
| Venus and Saturn | 8.295 | 1914 | 10.788 | 1900 |
| Venus and Uranus | 17.564 | 2050 | 20.818 | 2092 |
| Venus and Neptune | 29.083 | 2042 | 31.055 | 1959 |
| Earth and Mars | 0.373 | 2003 | 2.676 | 2066 |
| Earth and Jupiter | 3.949 | 1951 | 6.456 | 1945 |
| Earth and Saturn | 8.030 | 1914 | 11.051 | 1900 |
| Earth and Uranus | 17.290 | 2051 | 21.093 | 2093 |
| Earth and Neptune | 28.814 | 2041 | 31.324 | 1958 |
| Mars and Jupiter | 3.516 | 2000 | 6.887 | 1994 |
| Mars and Saturn | 7.418 | 1915 | 11.663 | 2019 |
| Mars and Uranus | 16.621 | 2049 | 21.759 | 2093 |
| Mars and Neptune | 28.304 | 1900 | 31.838 | 1983 |
| Jupiter and Saturn | 4.033 | 1921 | 15.241 | 1990 |
| Jupiter and Uranus | 12.849 | 2052 | 25.454 | 1920 |
| Jupiter and Neptune | 24.745 | 1907 | 35.393 | 1990 |
| Saturn and Uranus | 9.234 | 1988 | 29.633 | 2100* |
| Saturn and Neptune | 20.178 | 1989 | 40.007 | 2079 |
| Uranus and Neptune | 10.570 | 1994 | 49.879 | 2084 |

Each distance is good to about the uncertainty in the result: a few thousand kilometres for the inner planets and tens of thousands for Jupiter and beyond. Against JPL Horizons on three pairs (the Earth and Mars, Venus and the Earth, Jupiter and Saturn), `test/nearest.test.ts` takes the table Horizons gives for each pair's least and greatest distance in 1900 to 2100 (geometric vectors from one planet's centre to the other's, ten days at six-hour steps either side of the turning point; `scripts/fetch-horizons-distance.py` records the queries in `test/data/horizons-distance.json`) and fits a parabola to find the extreme:

| Pair | Horizons | Here | Distance | Time |
|---|---|---|---|---|
| Earth and Mars, least | 2003-08-27 09:41, 0.37272 au | 09:51, 0.37271 au | 1,410 km | 10 min |
| Earth and Mars, greatest | 2066-08-25 00:36, 2.67633 au | 00:28, 2.67631 au | 2,145 km | 8 min |
| Venus and the Earth, least | 2093-12-17 10:40, 0.26433 au | 10:40, 0.26432 au | 1,020 km | 1 s |
| Venus and the Earth, greatest | 1960-06-21 23:15, 1.73598 au | 23:27, 1.73599 au | 1,095 km | 12 min |
| Jupiter and Saturn, least | 1921-07-26 20:13, 4.03311 au | 21:21, 4.03309 au | 3,950 km | 69 min |
| Jupiter and Saturn, greatest | 1990-10-01 07:59, 15.24084 au | 09:44, 15.24086 au | 2,025 km | 105 min |

The distance is within the claimed uncertainty every time (a third to a tenth of it). The time is minutes to an hour or two for a distance that is at its flat turning point, where it changes by a few kilometres in an hour: the same small difference in position puts the vertex a little earlier or later.

## What a result holds

A sky result is `{ id, kind, angle, uncertaintyArcseconds }` and a space result `{ id, kind, distanceKm, distanceAu, uncertaintyKm }`. A close approach is `{ a, b, time, atEdge, uncertaintySeconds }` with the angle and `uncertaintyArcseconds`, or the distances and `uncertaintyKm`. `time` is a `Date`.

The uncertainty is what to expect from the theories, not a bound: it is the limits the [accuracy tests](accuracy.md) hold each body to (a planet's direction from the Sun, a moon's from its planet), turned into kilometres at the body's distance and combined. A part of the error that two bodies share cancels: a moon and its planet share the planet's, so Jupiter and Io come out good to a fraction of an arc-second, though Jupiter's own place is good to 3.6 arc-seconds; the Earth's own error, seen from the Earth, cancels between two bodies that are near each other in the sky. `uncertaintySeconds` is the angle's uncertainty over how fast the two move past each other, so two bodies that crawl past each other (Jupiter and Saturn at 0.01 arc-second a second) have minutes in it and the Moon and a planet have seconds. Without `tables`, the moons of Jupiter and Saturn are the fitted orbits, and their uncertainty says so.

## Against JPL Horizons

`test/nearest.test.ts` compares every event with Horizons' own table, fetched once (`scripts/fetch-horizons-approach.py` records each query in `test/data/horizons-approach.json`; no network in the test). Horizons' RA and DEC are astrometric, from the Earth's centre, at one-minute steps (five for Venus and Jupiter); the minimum of its separation is the vertex of a parabola fitted to the squared separation about the tabulated minimum. Measured on 8 November 2026:

| Event | Horizons | Here | Time | Angle |
|---|---|---|---|---|
| Jupiter and Saturn, the great conjunction | 2020-12-21 18:21:06, 0.10176° | 18:25:36, 0.10184° | 270 s | 0.27″ |
| Venus and Jupiter | 2023-03-02 05:05:18, 0.48915° | 05:05:41, 0.48900° | 23 s | 0.54″ |
| The Moon and Mercury, December 2026 | 12-07 19:49:59, 5.70071° | 19:50:00, 5.70086° | 1 s | 0.55″ |
| The Moon and Venus | 12-05 05:04:49, 6.59375° | 05:04:48, 6.59392° | 1 s | 0.61″ |
| The Moon and Mars | 12-28 13:29:22, 4.73649° | 13:29:29, 4.73689° | 7 s | 1.45″ |
| The Moon and Jupiter | 12-27 16:26:11, 1.38067° | 16:26:11, 1.38056° | 0.2 s | 0.40″ |
| The Moon and Saturn | 12-18 04:37:58, 6.17202° | 04:37:50, 6.17212° | 7 s | 0.33″ |
| The Moon and Uranus | 12-22 02:49:30, 5.16230° | 02:49:24, 5.16253° | 7 s | 0.80″ |
| The Moon and Neptune | 12-17 16:59:52, 4.62811° | 16:59:51, 4.62788° | 1 s | 0.85″ |

The angle is within 1.5 arc-seconds everywhere, which is the planets' own accuracy. The time is a few seconds for the Moon, which crosses the sky at half a degree an hour, and 270 s for the great conjunction, where Jupiter and Saturn close at 0.01 arc-second a second, so 0.27 arc-seconds is 270 seconds. The test holds each to a limit a little above these, and checks that the claimed uncertainty covers the difference. A place on the Earth is checked too: the Moon and Venus from Vancouver on a table of 25 half-hours is within 0.9 arc-second of Horizons' topocentric table, where the Earth's centre would be 0.85 degree off. The distances are checked against Horizons' vectors on 60 dates from 1800 to 2200: the Earth's distance to each planet is within its claimed uncertainty on every date, and at worst two thirds of it.

The search itself is checked against a brute-force scan of the same separation at one-minute steps (the minimum is within a minute and a hundred-thousandth of a degree), and the list of `conjunctions` against a six-hourly scan of each pair, which finds the same ones.

## How long it takes

`node scripts/bench-nearest.ts` times each search, the median of five runs on one machine (Node 24, an Apple laptop):

| Search | Time |
|---|---|
| `nearest`, one body against all 46 others, one date | 1 ms |
| `closestApproach`, Venus and Jupiter, one year | 2 ms |
| `conjunctions`, the Sun and the planets (28 pairs), one year | 18 ms |
| `conjunctions`, the Moon, Venus, Mars and Jupiter, one year | 46 ms |
| `conjunctions`, Jupiter and its four moons, one year | 1.1 s |

Each body is worked out once for each step, however many pairs it is in, so a longer list of bodies costs in proportion to its length, not its square. The cost is the step: Io's makes a year's search of the Galilean moons a hundred times longer than one of the planets. Give a `within` that fits the question, a short `bodies` list and a span of a few years at most for the moons.

## Limits

- The accuracy is the package's: a planet to a few arc-seconds, a moon to a degree or two on its orbit (see [accuracy](accuracy.md)), so the angle between two moons is not good to better than that.
- The scan can miss two minima of one pair closer together than its step, which no pair of these bodies has; a pair with a retrograde loop (Mars and Jupiter) is stepped at two days or less.
- A distance has no light time and a sky angle has no aberration or light bending.
- Positions outside 1800 to 2200 get worse, and a dwarf planet outside its table's years is the osculating elements of one epoch; the uncertainty says so (degrees, not arc-seconds).
- A target must be a body of this package. The nearest stars to a planet, or the constellation a planet is in, is for `/stars` and the packages that carry the constellations.
