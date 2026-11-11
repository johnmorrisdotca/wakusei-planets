---
title: Close approaches to the Earth
section: how-to
order: 21
description: "Every approach of a near-Earth object within 0.05 au of the Earth from 2026 to 2036, and the close ones since 1900, from JPL's close-approach data: dates, distances, speeds and sizes. A 134 kB table that only /approaches carries."
---

`/approaches` lists 4,183 close approaches of near-Earth objects to the Earth: every one within 0.05 au (7.5 million km, 19 lunar distances) from 2026-01-01 to 2036-12-31 (3,013 approaches), and the close ones, within 0.002 au (0.8 lunar distances), from 1900 to the end of 2025 (1,170). The data is JPL's close-approach table, read on 2026-11-11. It runs anywhere, with no DOM and no three.js, reads no clock, and the table (about 134 kB gzipped) is part of this entry point only: a page that does not import `/approaches` does not carry it.

```ts
import { APPROACH_NOTE, nearestApproaches, nextApproach } from "@johnmorrisdotca/wakusei-planets/approaches";

const apophis = nextApproach("Apophis", Date.UTC(2026, 10, 11))!;
console.log(apophis.fullName, "passes on", new Date(apophis.date).toISOString(), "at", Math.round(apophis.distanceKm), "km,", apophis.distanceLunar.toFixed(3), "lunar distances, at", apophis.speedKmS.toFixed(1), "km/s");
for (const a of nearestApproaches(3, { from: Date.UTC(2026, 10, 11) })) console.log(a.fullName, new Date(a.date).toISOString().slice(0, 10), Math.round(a.distanceKm), "km");
console.log(APPROACH_NOTE.text);
```

## These are predictions

An approach is a prediction from the orbit JPL knew on the day it was read. It changes as the orbit is refined by new observations, and a body found after that day is not here: nearly all the small ones are found only days before they pass. `APPROACH_NOTE` says so in words, with the date fetched and the two parts of the table (`coverage.wide` and `coverage.close`); each record has `predicted`, true after the fetch date. Show the note wherever the table is shown. The table is refreshed by running `scripts/make-approaches-data.py --refresh`, which asks JPL again.

## What a record holds

`designation`, `number`, `name` and `fullName`; `date` (milliseconds since 1970, UTC) and `jdTdb`, with `timeSigma` (JPL's 3-sigma uncertainty of the moment in minutes, and `lessThan` where JPL gives only "under a minute"); `distanceAu`, `distanceKm` and `distanceLunar` (between the centres, nominal) with `minDistanceAu` and `maxDistanceAu` (the 3-sigma range); `speedKmS` relative to the Earth; and the size. JPL's own calendar string is in TDB, about a minute ahead of UTC: Apophis' pass is 21:46 TDB on JPL's page and 21:45 UTC here.

The size is two things. `H` is the absolute magnitude, and `sizeRange` is the diameter it implies for an albedo of 0.25 (a bright, stony body, the smaller size) and of 0.05 (a dark one, the larger), `APPROACH_ALBEDO`: the two differ by a factor of 2.2, so treat it as a range. Where JPL has a measured diameter (39 of the records) `diameterKm` and `diameterSigmaKm` hold it, and it is the better number. The close-approach table's H can differ from the orbit database's: Apophis is 19.09 here, 19.7 in `/asteroids`.

## What you can ask

| Function | Gives |
|---|---|
| `approachList()` | every approach, oldest first |
| `approachesBetween(from, to)` | those in a range of dates |
| `nearestApproaches(count, filter?)` | the closest ones, nearest first |
| `nextApproach(object, after)` | the next approach of a number, designation or name after a moment (you give the moment: the module reads no clock) |
| `approachesOf(object)` | every approach of one object |
| `approachesWhere(filter)` | by date, distance (`maxAu`, `maxLunar`), size (`minDiameterKm`, `maxDiameterKm`), object or prediction |
| `approachSizeRange(H)` and `approachDiameterKm(approach)` | the size range from H, and the best single width |

```ts
import { approachesWhere } from "@johnmorrisdotca/wakusei-planets/approaches";

const near = approachesWhere({ from: Date.UTC(2026, 10, 11), to: Date.UTC(2030, 0, 1), maxLunar: 5, minDiameterKm: 0.1 });
for (const a of near) console.log(new Date(a.date).toISOString().slice(0, 10), a.fullName, a.distanceLunar.toFixed(2), "lunar distances");
```

A width for a filter is the measured diameter, else the middle (the geometric mean) of the size range.

## Where the numbers come from

Two list requests to JPL's Close-Approach Data API (version 1.5), with the diameter and the full name asked for, made by `scripts/make-approaches-data.py` on 2026-11-11; NASA's data is a US government work and in the public domain, and [NOTICE.md](../../NOTICE.md) says so. The distance is between the centres of the body and the Earth; `/asteroids` and `/nearest` work out positions from orbits, and this table is JPL's own answer.
