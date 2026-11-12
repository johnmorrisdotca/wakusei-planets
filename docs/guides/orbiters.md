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

Each path is a Kepler ellipse round the body, in the body's own equator frame (its IAU pole), whose node and periapsis drift at fitted rates: nine numbers a craft, fitted by `scripts/make-orbiter-data.py` to JPL Horizons' own track over the last days before the read date (7 days for the low orbits, 10 for Mars Express and Hope, 14 for ARTEMIS). The script is run by hand from the Mac, about monthly or after a manoeuvre, and never on a timer; the page never calls a server. In the body's frame a low orbit's inclination stays put and its node turns steadily round the pole; in the ecliptic both would swing (TGO's inclination by tens of degrees a month) and no ellipse would follow it, so the elements' inclination is the one the agencies give, to the body's equator. Positions come back in kilometres from the body's centre, ecliptic and equinox J2000, the same axes as `/roadster`; `eclipticToScene` from `/space` turns them into the space view's.

Times: a `Date` is UTC, Horizons' vectors and the fitted epoch (`epochJd`) are TDB. The package adds 69.184 s (37 s of TAI - UTC and 32.184 s of TT - TAI; TDB - TT is under 2 ms) before it uses an epoch. Left out, every craft would lag its true place by about 69 s of its motion: 110 km for LRO, 235 km for MRO.

`orbiterElements(id)` gives the elements with the window they were fitted over (`validFrom` to `fitUntil`), the end of the days the ellipse is carried on for (`validUntil`), the day Horizons was read (`retrieved`: the age of the elements), how far Horizons' tracking data reached (`trackedUntil`) and two errors against Horizons: over the fit's window (`fitErrorKm`) and over the days after it (`predictedErrorKm`), each median and worst. Both are measured by the script, in kilometres:

| Craft | Tracked: median, worst | Predicted: median, worst |
|---|---|---|
| LRO | 11, 26 | 92, 206 |
| Chandrayaan-2 | 12, 38 | 112, 244 |
| Danuri | 7, 35 | 74, 225 |
| MRO | 10, 27 | 11, 32 |
| Odyssey | 9, 15 | 19, 49 |
| Mars Express | 7, 19 | 8, 28 |
| TGO | 8, 16 | 9, 28 |
| Hope | 4, 12 | 14, 28 |

A mean ellipse cannot follow ARTEMIS P1 and P2 (about 3,000 km of a 10,000 km orbit, pulled about by the Earth), so those are marked `modelled`. These are the numbers of the file read on 2026-11-12; the script rewrites them.

## Tracked, predicted, modelled, none

`orbiterStatus(id, when)` says what a position at a moment is worth, and a page says it next to the craft:

| Status | Meaning |
|---|---|
| `tracked` | inside the window the ellipse was fitted over, up to `fitUntil`: its error against Horizons there is `fitErrorKm` |
| `predicted` | after that window, for as many days again: the same ellipse carried on, and the error there, measured against Horizons the same way, is `predictedErrorKm` (larger: for the low orbits two to five times) |
| `modelled` | a mean orbit only: outside both spans, a craft whose ellipse misses by more than the limit, or one whose track has ended (MAVEN, lost in December 2025 and ended by NASA in 2026, keeps its last orbit) |
| `none` | no path: CAPSTONE's near-rectilinear halo orbit is no ellipse and its mission is complete; Tianwen-1's only public record is a volunteers' track of its cruise, ending at arrival |

`tracked` means the ellipse follows Horizons' track over the fit's window, where the track is itself the agency's measurement, or, for the last days before the read date, its prediction (`trackedUntil` says where Horizons' tracking data ended). Never present a guess as live: a `modelled` craft is drawn dim, and so is a `predicted` one whose worst error after the fit (`predictedErrorKm.max`) is more than 2 per cent of its body's mean radius, about 35 km at the Moon and 68 km at Mars (`orbiterDim(id, when)`, `ORBITER_DIM_SHARE`); each is said to be what it is, with the error that goes with it (`orbiterNumbers(id, when).errorKm`: the worst error for the status, `null` when modelled), and one with `none` carries its facts and no marker.

## The numbers and the facts

`orbiterNumbers(id, when)` gives the height above the body's mean surface, the speed, the period and the inclination to the body's equator; `orbiterPath(id, when, points)` the orbit's points round one trip for a line; `orbiterSpeed` the speed alone. `orbiterFacts(id)` (and `ORBITER_FACTS`) holds the names in English and Japanese, a short name for a button or label (`LRO`, `TGO`), the operator, the launch (date, rocket, site), the instruments as listed, one line about the craft in our own words, and the mission's state (`flying` or `ended`, with a note). Every fact is typed from the craft's own JPL Horizons object page, read on the date `NOTICE.md` gives; a fact the page does not give is left out.

## The ground beneath, and the next pass over a place

```ts
import { orbiterElements, orbiterGround, orbiterGroundTrack, orbiterNextPass } from "@johnmorrisdotca/wakusei-planets/orbiters";

const now = Date.UTC(2026, 10, 12);
const below = orbiterGround("mro", now)!;
console.log("MRO is over", below.lat.toFixed(1), below.lon.toFixed(1));
const trip = orbiterElements("mro")!.periodDays * 86_400_000;
console.log(orbiterGroundTrack("mro", now, now + trip, 120).length, "points of one trip's ground track");
// Jezero crater, where Perseverance landed (a place from /places fits)
const pass = orbiterNextPass("mro", { lat: 18.4446, lon: 77.4508 }, now)!;
console.log("next over Jezero at", new Date(pass.highest).toISOString(), pass.elevationDeg.toFixed(0), "degrees up,", pass.status);
```

`orbiterGround(id, when)` is the point straight below the craft (planetocentric latitude and east longitude), from the body's IAU pole and prime meridian; the Moon's small wobbles, a degree or two, are left out. `orbiterGroundTrack(id, from, to, points)` is the line of those points: the body turns beneath the orbit, so each trip crosses the equator further west (about 27 degrees a trip for MRO). `orbiterNextPass(id, place, when, { minElevationDeg, withinDays })` finds the first time from `when` the craft is above `minElevationDeg` (10 by default) as seen from a place on the body's mean sphere, with its rise, its highest moment and elevation, and its set, searched up to `withinDays` ahead (30 by default: a polar orbit round the slow-turning Moon comes back over a place about every two weeks). When the craft is already up at `when`, that pass is the one given. A low orbiter is up for two or three minutes; Hope, far out, for hours. A pass far past the data's days is worked out on a `modelled` path, and says so in its `status`.

## Refreshing

```sh
pnpm orbiters:refresh
```

That runs `python3 -I scripts/make-orbiter-data.py --brief --cache ~/.cache/wakusei-planets/horizons-orbiters` and ends with one line a craft: its status, its worst error over the fit and after it, and the dates they reach (without `--brief` the script prints its working too). The fits are good for a week or two past the day they are read, so the maintainer runs it from the Mac about once a month and releases a patch; no workflow runs it, and a page never calls a server for them. Four requests per craft (the object page, the fit's window, the days after it, and four test points asked at UTC calendar dates), two seconds apart, one at a time, with a generic User-Agent; the cache is outside the repository, so a second run asks nothing again. The script prints each fit's error and says which craft Horizons no longer tracks; it rewrites `src/data/orbiters.ts` and the test points in `test/data/orbiters-horizons.json`, and `pnpm test` checks every craft against them.

## In the space view

`<wakusei-space orbiters>` (and `space.orbiters = true`) draws each craft with a path as a small dot where the table puts it on the date shown, scaled with its body in both scales, on its orbit line, with its name beside it in the page's language, once the Moon or Mars is at least 24 CSS pixels in radius on the screen (nearer, every dot would sit on the body's own). A path `orbiterDim` calls dim (a `modelled` one, or a `predicted` one with a large error) is drawn dim; a craft with `none` is not drawn. Off by default, and this module is loaded the first time they are shown. `stats.orbiters` says what was drawn: how many craft, each one's status, which were drawn dim, how many orbit lines and how many points of ground track.

- `orbiter="mro"` (and `space.orbiter`) picks one craft out: its line is drawn brighter.
- `orbiter-lines="all|chosen|none"` (and `space.orbiterLines`) draws every craft's orbit line (the default), the chosen one's only, or none. It is apart from `orbits`, the planets' and moons' lines.
- `orbiter-track` (and `space.orbiterTrack = true`) draws the chosen craft's ground track on its body, from one trip before the moment to one trip after.
- To ride along with one: `space.ride(orbiterRidePoint("lro"), { around: "moon" })`, the camera at the craft looking at the Moon ([Riding along](ride-along.md)).

The demo's Orbiters switch opens a row of the craft by body (their short names, `orbiterFacts(id).short`), the line and track switches, a ride along with the chosen craft, and a card with its facts, its numbers, where its path comes from and until when, and its next pass over Apollo 11's landing site or Perseverance's, all kept in the address.

`space.paint = { id: "lro", length: "1d", swath: "track" }` paints that craft's ground track on the body it goes round. `length` is `1d` (the default), `1w` or `1m`, in the clock's time. `swath` is `track` (the point under the craft) or `coverage` (the ground where the craft is at least 10° above the horizon). `space.clearPaint()` takes it off, and choosing another craft clears the old trail. Parts older than `length` fade and are dropped. The line is filled in between frames, so a fast clock stays continuous, and a clock run backwards paints backwards. One picture is uploaded each frame while time moves, and nothing is uploaded at rest or while paint is off, when the picture and its sphere are given back to the graphics card. Samples are taken often enough (at most a third of a trip apart) that the line follows the orbit however fast the clock runs. The date-line split and the swath radius are `@johnmorrisdotca/wakusei-planets/ground-track`, with no DOM and no three.js.
