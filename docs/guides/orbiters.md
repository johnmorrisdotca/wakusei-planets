---
title: The orbiters of the Moon and Mars
section: how-to
order: 18
description: "Where thirteen spacecraft in orbit round the Moon and Mars are at a moment, from mean elements fitted to JPL Horizons, with their numbers, their facts, and an honest word on which paths are tracked, modelled or missing."
---

`/orbiters` knows the working spacecraft round the Moon and Mars: Lunar Reconnaissance Orbiter, Chandrayaan-2, Danuri, ARTEMIS P1 and P2 and CAPSTONE round the Moon; Mars Reconnaissance Orbiter, 2001 Mars Odyssey, MAVEN, Mars Express, ExoMars Trace Gas Orbiter, Hope and Tianwen-1 round Mars. For each it gives where it is at a moment, its numbers, and what is known about it. The deep-space craft (Voyager, New Horizons, Webb and the rest) are in [Spacecraft](spacecraft.md); the Earth's own satellites are chikyu-earth's.

```ts
import { ORBITER_IDS, orbiterFacts, orbiterNumbers, orbiterPosition, orbiterStatus } from "@johnmorrisdotca/wakusei-planets/orbiters";

const now = Date.UTC(2026, 10, 11, 12);
for (const id of ORBITER_IDS) {
  const facts = orbiterFacts(id);
  const numbers = orbiterNumbers(id, now);
  console.log(facts.name.en, facts.centre, orbiterStatus(id, now), numbers ? `${numbers.altitudeKm.toFixed(0)} km up at ${numbers.speedKmS.toFixed(2)} km/s` : "no path");
}
const [x, y, z] = orbiterPosition("lro", now);
console.log("LRO is", Math.hypot(x, y, z).toFixed(0), "km from the Moon's centre");
```

## Where the paths come from

Each path is a Kepler ellipse round the body whose node and periapsis drift at fitted rates: nine numbers a craft, fitted by `scripts/make-orbiter-data.py` to JPL Horizons' own track over the last days before the read date (7 days for the low orbits, 10 for Mars Express and Hope, 14 for ARTEMIS). The script is run by hand from the Mac, about monthly or after a manoeuvre, and never on a timer; the page never calls a server. Positions are kilometres from the body's centre, ecliptic and equinox J2000, the same axes as `/roadster`; `eclipticToScene` from `/space` turns them into the space view's.

Times: a `Date` is UTC, Horizons' vectors and the fitted epoch (`epochJd`) are TDB. The package adds 69.184 s (37 s of TAI - UTC and 32.184 s of TT - TAI; TDB - TT is under 2 ms) before it uses an epoch. Left out, every craft would lag its true place by about 69 s of its motion: 110 km for LRO, 235 km for MRO.

`orbiterElements(id)` gives the elements with the window they were fitted over (`validFrom` to `fitUntil`), the end of the days the ellipse is carried on for (`validUntil`), the day Horizons was read (`retrieved`: the age of the elements), how far Horizons' tracking data reached (`trackedUntil`) and two errors against Horizons: over the fit's window (`fitErrorKm`) and over the days after it (`predictedErrorKm`), each median and worst. Both are measured by the script, in kilometres:

| Craft | Tracked: median, worst | Predicted: median, worst |
|---|---|---|
| LRO | 14, 44 | 80, 235 |
| Chandrayaan-2 | 11, 33 | 99, 251 |
| Danuri | 13, 48 | 36, 144 |
| MRO | 20, 52 | 60, 146 |
| Odyssey | 17, 54 | 68, 166 |
| Mars Express | 7, 17 | 8, 27 |
| Hope | 4, 9 | 17, 33 |

A mean ellipse cannot follow TGO (146 km inside its window, 444 past it; its node swings 2.2 degrees a day) or ARTEMIS P1 and P2 (about 3,000 km of a 10,000 km orbit, pulled about by the Earth), so those are marked `modelled`. These are the numbers of the file read on 2026-11-11; the script rewrites them.

## Tracked, predicted, modelled, none

`orbiterStatus(id, when)` says what a position at a moment is worth, and a page says it next to the craft:

| Status | Meaning |
|---|---|
| `tracked` | inside the window the ellipse was fitted over, up to `fitUntil`: its error against Horizons there is `fitErrorKm` |
| `predicted` | after that window, for as many days again: the same ellipse carried on, and the error there, measured against Horizons the same way, is `predictedErrorKm` (larger: for the low orbits two to five times) |
| `modelled` | a mean orbit only: outside both spans, a craft whose ellipse misses by more than the limit, or one whose track has ended (MAVEN, lost in December 2025 and ended by NASA in 2026, keeps its last orbit) |
| `none` | no path: CAPSTONE's near-rectilinear halo orbit is no ellipse and its mission is complete; Tianwen-1's only public record is a volunteers' track of its cruise, ending at arrival |

`tracked` means the ellipse follows Horizons' track over the fit's window, where the track is itself the agency's measurement, or, for the last days before the read date, its prediction (`trackedUntil` says where Horizons' tracking data ended). Never present a guess as live: a `predicted` or `modelled` craft is drawn dim and said to be so, with the error that goes with it (`orbiterNumbers(id, when).errorKm`: the worst error for the status, `null` when modelled), and one with `none` carries its facts and no marker.

## The numbers and the facts

`orbiterNumbers(id, when)` gives the height above the body's mean surface, the speed, the period and the inclination; `orbiterPath(id, when, points)` the orbit's points round one trip for a line; `orbiterSpeed` the speed alone. `orbiterFacts(id)` (and `ORBITER_FACTS`) holds the names in English and Japanese, the operator, the launch (date, rocket, site), the instruments as listed, one line about the craft in our own words, and the mission's state (`flying` or `ended`, with a note). Every fact is typed from the craft's own JPL Horizons object page, read on the date `NOTICE.md` gives; a fact the page does not give is left out.

## Refreshing

```sh
python3 -I scripts/make-orbiter-data.py --cache <a folder outside the repository>
```

Four requests per craft (the object page, the fit's window, the days after it, and four test points asked at UTC calendar dates), two seconds apart, one at a time, with a generic User-Agent; the cache is outside the repository, so a second run asks nothing again. The script prints each fit's error and says which craft Horizons no longer tracks; it rewrites `src/data/orbiters.ts` and the test points in `test/data/orbiters-horizons.json`, and `pnpm test` checks every craft against them.

## In the space view

`<wakusei-space orbiters>` (and `space.orbiters = true`) draws each craft with a path as a small dot where the table puts it on the date shown, scaled with its body in both scales, on its orbit line, with its name beside it in the page's language, once the Moon or Mars is at least 24 CSS pixels in radius on the screen (nearer, every dot would sit on the body's own). A `modelled` or `predicted` path is drawn dim; a craft with `none` is not drawn. Off by default, and this module is loaded the first time they are shown. `stats.orbiters` says what was drawn and each craft's status. To ride along with one: `space.ride(orbiterRidePoint("lro"), { around: "moon" })`, the camera at the craft looking at the Moon ([Riding along](ride-along.md)).
