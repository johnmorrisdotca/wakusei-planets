---
title: Famous spacecraft
section: how-to
order: 17
description: Ten famous spacecraft, from Pioneer 10 to the Webb telescope: facts, the events of the voyage, and where each one is on any date, fitted to JPL Horizons. Each craft is a table of its own, 2 to 127 kB gzipped.
---

`/spacecraft` answers two questions about ten famous craft: where is it on a date, and what happened on its voyage? The craft are Voyager 1 and 2, New Horizons, Pioneer 10 and 11, Cassini, Galileo, Juno, Parker Solar Probe and the James Webb Space Telescope. Each one's path is a table fitted to JPL Horizons over the whole of Horizons' own record of it, from about an hour after launch to the end of the mission (or, for a craft still flying, to the end of Horizons' predicted path). It runs anywhere, with no DOM and no three.js, and a craft's table loads only when you ask for it.

```ts
import { loadSpacecraft, SPACECRAFT, spacecraftLightTime, spacecraftPosition, spacecraftSpeed, spacecraftSunDistance } from "@johnmorrisdotca/wakusei-planets/spacecraft";

await loadSpacecraft("voyager1");
const day = Date.UTC(2026, 10, 8);
console.log(SPACECRAFT.voyager1.name.en, "is", (spacecraftSunDistance("voyager1", day) / 149597870.7).toFixed(1), "au from the Sun");
console.log("a radio signal takes", (spacecraftLightTime("voyager1", day) / 3600).toFixed(1), "hours to reach it, and it moves at", spacecraftSpeed("voyager1", day).toFixed(1), "km/s");
console.log("x, y, z in au:", spacecraftPosition("voyager1", day).map((km) => (km / 149597870.7).toFixed(1)).join(", "));
```

## The ten craft

| Id | Craft | Horizons' record | Table, gzipped |
|---|---|---|---|
| `voyager1` | Voyager 1 | 1977-09-05 to 2099-12-31 | 3.2 kB |
| `voyager2` | Voyager 2 | 1977-08-20 to 2099-12-31 | 4.7 kB |
| `newhorizons` | New Horizons | 2006-01-19 to 2049-12-31 | 2.0 kB |
| `pioneer10` | Pioneer 10 | 1972-03-03 to 2049-12-31 | 2.6 kB |
| `pioneer11` | Pioneer 11 | 1973-04-06 to 2049-12-31 | 3.7 kB |
| `cassini` | Cassini | 1997-10-15 to 2017-09-15 | 127 kB |
| `galileo` | Galileo | 1989-10-19 to 2003-09-30 | 25 kB |
| `juno` | Juno | 2011-08-05 to 2028-09-02 | 77 kB |
| `parker` | Parker Solar Probe | 2018-08-12 to 2029-12-31 | 27 kB |
| `webb` | James Webb Space Telescope | 2021-12-25 to 2031-11-01 | 3.3 kB |

The record's first and last moments are the ones Horizons itself gives for each craft (`SPACECRAFT.<id>.record`, in milliseconds since 1970, UTC). A date outside it throws a `RangeError` that names the date and the record. The record starts about an hour after the launch, and its end for a craft still flying (and for Pioneer 10 and 11, whose contact ended) is Horizons' predicted path, so a date after today is a prediction.

A craft that went round a planet needs far more numbers than one that flew by: Cassini went round Saturn nearly 300 times, and each pass close to the planet needs its own short pieces of the fit. The tables are separate files, and `loadSpacecraft()` with no arguments loads all of them (about 275 kB gzipped); a page that draws only Voyager 1 asks for `"voyager1"` and loads 3 kB.

## What you can ask

| Function | Gives |
|---|---|
| `SPACECRAFT` and `SPACECRAFT_IDS` | the facts of each craft: name in English and Japanese, launch date and site and vehicle, agency, end of mission, status, NASA's mission page, Horizons' number, the record and the voyage's events |
| `loadSpacecraft(...ids)` | loads the tables (all ten when you pass none); call it once and wait |
| `spacecraftPosition(id, when)` | x, y, z in kilometres from the Sun, in the J2000 ecliptic frame (the axes of `heliocentric`, which is in astronomical units) |
| `spacecraftVelocity(id, when)` and `spacecraftSpeed(id, when)` | the velocity in km/s relative to the Sun, and its length |
| `spacecraftSunDistance(id, when)` and `spacecraftEarthDistance(id, when)` | the distance in kilometres from the Sun's centre and from the Earth's centre |
| `spacecraftLightTime(id, when)` | seconds a radio signal takes from the Earth to the craft |
| `spacecraftErrorKm(id)` | the worst error of the loaded path against Horizons, measured when it was made |

`when` is a `Date` or milliseconds since 1970 (UTC), as everywhere in this package. A table that is not loaded throws an `Error` that says to call `loadSpacecraft`, an unknown craft or a date that is not a number throws a `RangeError`.

## The voyage

Each craft's `events` list its launch, each flyby, each time it went into orbit round a planet, where it arrived (the Webb telescope at the Sun–Earth second Lagrange point) and the end of the mission, in order, with names in English and Japanese. A flyby gives the planet in `body` and the closest distance NASA's page gives, above the planet's cloud tops or the body's surface. The `precision` is `"minute"` where the page gives a time and `"day"` where it gives only a date.

```ts
import { loadSpacecraft, SPACECRAFT, spacecraftEarthDistance, spacecraftSunDistance } from "@johnmorrisdotca/wakusei-planets/spacecraft";

await loadSpacecraft("voyager2");
for (const event of SPACECRAFT.voyager2.events) {
  const when = Math.max(event.date, SPACECRAFT.voyager2.record.start);
  const sun = spacecraftSunDistance("voyager2", when) / 149597870.7;
  const earth = spacecraftEarthDistance("voyager2", when) / 149597870.7;
  console.log(new Date(event.date).toISOString().slice(0, 10), event.name.en.padEnd(14), sun.toFixed(1), "au from the Sun,", earth.toFixed(1), "au from the Earth");
}
```

To draw a path from the launch to a date, step through the dates between `record.start` and the date and call `spacecraftPosition`; break the line at each of the craft's `joins` (next section).

## How exact it is

Each table was fitted so that every sample of Horizons' record stays within a limit: 1,000 km near a planet or a target the craft flew by and while it orbited Saturn or Jupiter, and elsewhere a millionth of its distance from the Sun (about 0.2 arc-seconds seen from the Sun, 25,000 km for Voyager 1 today) but never less than 1,000 km. Within a table the segments are as long as that limit allows, from seconds near a planet to years in cruise. Speed is held to 1 per cent of the speed on the samples. Measured on samples held back from the fit, and on 240 fresh samples at random times that were never on the fitting grid:

| Craft | Worst held back | Worst on fresh samples |
|---|---|---|
| Voyager 1 | 42,000 km (in 2100, at 370 au) | 24,000 km |
| Voyager 2 | 35,000 km (in 2100) | 26,000 km |
| New Horizons | 8,800 km (in 2050) | 6,800 km |
| Pioneer 10 | 13,000 km (in 2050) | 8,500 km |
| Pioneer 11 | 11,000 km (in 2050) | 7,100 km |
| Cassini | 931 km | 802 km |
| Galileo | 844 km | 602 km |
| Juno | 840 km | 758 km |
| Parker Solar Probe | 848 km | 567 km |
| James Webb Space Telescope | 840 km | 670 km |

The tests hold each craft to its limit at sample dates from Horizons that were not in the fit (`test/data/spacecraft-horizons.json`), keep every table inside its size budget, and check each flyby against the closest approach of the fitted path to the body: the date within 10 minutes (18 hours where NASA gives only a date) and the distance within a few per cent. The speed on those samples is within 2 per cent of Horizons' own; the worst speed on the fresh samples was 3 per cent (Pioneer 10, 12 km/s).

Where two solutions meet, Horizons' own record steps. `SPACECRAFT.<id>.joins` lists those places and the size of each step: Voyager 1 steps 65,000 km on 1981-01-01, Voyager 2 14,000 km on 1989-08-29, Pioneer 10 four times (up to 126,000 km in 1983), Pioneer 11 six times (up to 459,000 km in 1976), Cassini 6,000 km in 2002 and Parker 80,000 km on 2025-06-25. The tables keep the steps, so a line through a join should break there. These steps are Horizons' own and not an error of the fit.

## Where the facts come from

Positions are from JPL Horizons and facts and events are from NASA's mission pages, read on 2026-11-08 and listed in [NOTICE.md](../../NOTICE.md). A time is given only where a page gives one. Where a page and the path disagree, the package keeps the path's date and says so here:

- Voyager 2 at Saturn: NASA's page gives the closest approach as 01:21 UT on 1981-08-26, and the path's closest approach is at 03:24 UTC. Only the date is kept.
- Cassini: the page's timeline dates the first Venus flyby 25 April 1998 and the Earth flyby 17 August 1999; the path's closest approaches are 26 April 13:44 UTC and 18 August 03:28 UTC, and those dates are kept. The page times the Saturn orbit insertion 9:12 p.m. UTC on 1 July 2004; the path's closest approach is at 02:38 UTC on 1 July, and only the date is kept.
- New Horizons at Pluto: the page says 4,800 miles (7,800 km) above the surface; the path and Horizons put the closest approach 12,500 km (7,760 miles) above it. No distance is kept. At Arrokoth the page's 3,500 km and Horizons' 5,500 km differ by Horizons' uncertainty in the small body's own position.
- Juno's orbit insertion: NASA's record gives 03:53 UT, the time the burn was confirmed at the Earth; the path's closest approach is at 02:47 UTC on 5 July 2016. Only the date is kept.
