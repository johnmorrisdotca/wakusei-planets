---
title: Starman and the Tesla Roadster
section: how-to
order: 18
description: "Where the Tesla Roadster launched on the first Falcon Heavy is on any date from 2018 to the end of 2035, and its distances, speeds, orbit and moments worth looking at, from a 20 kB table of JPL Horizons state vectors."
---

`/roadster` answers where the Tesla Roadster, with Starman at the wheel, is on a date, and what its numbers are. It is the car SpaceX launched on the first Falcon Heavy on 6 February 2018 into an orbit round the Sun. The path is a table of state vectors (position and velocity) from JPL Horizons, target `-143205`, which the module joins with cubic Hermite interpolation on position and velocity. It runs anywhere, with no DOM and no three.js, needs no loading step, and the table (about 20 kB gzipped) is part of this entry point only: a page that does not import `/roadster` does not carry it.

```ts
import { ROADSTER, roadsterPosition, roadsterStats } from "@johnmorrisdotca/wakusei-planets/roadster";

const day = new Date("2026-11-11T12:00:00Z");
const stats = roadsterStats(day);
console.log(ROADSTER.name.en, "is", stats.sun.au.toFixed(2), "au from the Sun and", Math.round(stats.earth.km / 1e6), "million km from the Earth");
console.log("it moves at", stats.speed.sun.toFixed(1), "km/s, has made", stats.orbitsCompleted, "orbits and is", stats.daysSinceLaunch.toFixed(0), "days old");
console.log("x, y, z in km:", roadsterPosition(day).map((km) => Math.round(km)).join(", "));
```

## The span and how exact it is

The table covers 2018-02-07 02:58:50 UTC (about six hours after the launch, where Horizons' record starts) to 2036-01-01 02:58:50 UTC; `ROADSTER.record` holds both ends in milliseconds since 1970. A date outside it throws a `RangeError` that names the date and the span, like the spacecraft's. `ROADSTER_ACCURACY` states the numbers: the span, the 10 days between rows, and the worst error of the interpolation.

| Where | Rows | Worst error against Horizons' own record |
|---|---|---|
| The first day (the Earth's pull still bends the path) | 2 hours apart | 755 km |
| Day 1 to day 10 | a day apart | 62 km |
| Day 10 to the end | 10 days apart | 645 km |

The step is the largest, tried from 5 days up, that keeps the worst error under 80 per cent of 1,000 km. It was measured against every day of the span, every hour of the first 13 days and every hour round the Mars passes of October 2020 and April 2035. On 15 dates that are on no row (from `test/data/roadster-horizons.json`) the position was within 629 km of Horizons and the velocity within 2 metres a second. Over the whole record the velocity (the slope of the interpolation) is within 2.3 metres a second of Horizons' after the first day and within 115 metres a second in it.

That is the error of the interpolation, and it is small beside the other one. **The path itself is a prediction.** Horizons' solution (s11) is a fit to 374 telescope observations made in February and March 2018, with the push of sunlight on the car estimated as one number from them; the car has not been tracked since. The real car drifts from the predicted path, and the further from 2018 the more. A close approach in 2035 is a prediction, not a promise.

## What you can ask

| Function | Gives |
|---|---|
| `ROADSTER` | the names in English and Japanese (`name`, `car`), the launch, Horizons' number, the span |
| `roadsterPosition(when)` and `roadsterPositionAu(when)` | x, y, z from the Sun in kilometres, or in astronomical units (the unit `heliocentric` gives the planets in), in the J2000 ecliptic frame |
| `roadsterVelocity(when)` and `roadsterSpeed(when)` | the velocity relative to the Sun in km/s, and its length |
| `roadsterStats(when)` | distance from the Sun, the Earth and Mars in km, miles and au with the light time; speed relative to each; days since launch; orbits made; the period now; the closest approaches before and after |
| `roadsterElements(when)` | the osculating orbit: semi-major axis, eccentricity, inclination, node, argument of perihelion, anomalies, period, perihelion and aphelion distances |
| `roadsterApproaches("earth" or "mars")` | every closest approach under one astronomical unit inside the span, with date and distance |
| `roadsterEvents()` | the launch, the approaches, each perihelion and each aphelion, in date order, named in English and Japanese |
| `roadsterSeries(from, to, stepMs)` | the distances from the Sun, the Earth and Mars and the speed at equal steps, for a chart |

The Earth and Mars are the package's own positions (`heliocentric`), and no distance allows for the time the light takes. On the 15 test dates the distances from the Earth and Mars were within 2,000 km of Horizons' own vectors from those bodies, and the speeds relative to them within 1 metre a second. The orbit's period and shape come from the state vector and the Sun's gravitational parameter, and match Horizons' own osculating elements to 0.03 days in the period and 0.02 degrees in the angles.

The orbits made are the angle swept round the Sun since the launch over a full turn, so the first six hours (before the table starts) are counted at the rate of the first row, under a thousandth of an orbit. The osculating period is about 557 days and changes a little from day to day as the planets pull.

## The moments worth looking at

```ts
import { roadsterApproaches, roadsterEvents } from "@johnmorrisdotca/wakusei-planets/roadster";

for (const event of roadsterEvents().slice(0, 8)) {
  const km = event.distanceKm === undefined ? "" : ` ${(event.distanceKm / 149597870.7).toFixed(3)} au`;
  console.log(new Date(event.date).toISOString().slice(0, 10), event.name.en + km);
}
const mars = roadsterApproaches("mars").find((a) => new Date(a.date).getUTCFullYear() === 2020)!;
console.log("Mars, 2020:", new Date(mars.date).toISOString(), (mars.distanceKm / 149597870.7).toFixed(4), "au");
```

The close approach to Mars on 7 October 2020 is at 06:28 UTC, 0.0495 au, which is Horizons' own: its table of the object's encounters gives 2020 Oct 07.268 and 0.049505 au. An approach is a least value of the distance between the centres that is under one astronomical unit; the launch and the last days of the span are not counted. Perihelion and aphelion are where the distance from the Sun is least and greatest. The pass of 22 April 2035, the closest of all, is also Horizons' own: the table puts it at 08:31 UTC at 0.01600 au, and Horizons' table gives 2035 Apr 22.355 and 0.015980 au (the date within 3 minutes). It is 17 years after the observations the path was fitted to, so it is a prediction.

Each event has `kind`, `date`, `name` (`en` and `ja`) and, for an approach, a perihelion or an aphelion, `distanceKm`. A page can list them and jump to `date`.

## A chart

```ts
import { roadsterSeries } from "@johnmorrisdotca/wakusei-planets/roadster";

const week = 7 * 86_400_000;
const { times, earthKm, marsKm, sunKm, speed } = roadsterSeries(Date.UTC(2018, 2, 1), Date.UTC(2026, 10, 11), week);
console.log(times.length, "weeks; nearest to the Earth", Math.round(Math.min(...earthKm) / 1e6), "million km, to Mars", Math.round(Math.min(...marsKm) / 1e6), "million km");
console.log("fastest", Math.max(...speed).toFixed(1), "km/s, furthest from the Sun", (Math.max(...sunKm) / 149597870.7).toFixed(3), "au");
```

A series holds at most 100,000 moments; a larger one throws a `RangeError` that asks for a larger step.

## Where the numbers come from

The path is from JPL Horizons (target `-143205`, the Sun as the centre, ecliptic and equinox J2000), fetched on 2026-11-11 by `scripts/make-roadster-data.py`, which also measures the error and writes `src/data/roadster.ts`. NASA's data is a US government work and in the public domain; [NOTICE.md](../../NOTICE.md) says so. The launch time and the names are from Horizons' own notes on the object.

## In the space view

`<wakusei-space roadster>` (and `space.roadster = true`) draws the car in the solar-system view: a small marked body where the table puts it on the date shown, in the same mapping as the planets in both scales, on its orbit line (about one trip round the Sun, from the table itself), with its name beside it in the page's language (`Starman`, `スターマン`). It is off by default, and the table is fetched the first time it is shown, never before. Outside the record (before the launch, after 2035) nothing is drawn. The view draws only when something changes, as always; `stats.roadster` says whether the car was drawn, where (Earth radii from the Earth's centre) and how big on the screen. A press on its name fires `wakusei-body-click` with `{ id: "roadster" }` and goes nowhere, since the view cannot look at a car.
