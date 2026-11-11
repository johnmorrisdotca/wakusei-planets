---
title: Asteroids and distant small bodies
section: how-to
order: 19
description: "About a hundred asteroids, centaurs and trans-Neptunian objects from JPL's Small-Body Database: orbits, sizes, the spacecraft that visited them, and where each is on any date. A 17 kB table that only /asteroids carries."
---

`/asteroids` is a set of 104 small bodies: the largest main-belt asteroids, the ones spacecraft have visited (Eros, Itokawa, Ryugu, Bennu, Arrokoth and more), famous near-Earth asteroids (Apophis, 2024 YR4, Phaethon), Jupiter's trojans (the targets of the Lucy mission, Hektor, Achilles), centaurs and trans-Neptunian objects. Each record has the orbit (osculating elements at one epoch, read from JPL's Small-Body Database on 2026-11-11), the size, spin, brightness and colour class where the source gives them, the missions and the year of discovery. It runs anywhere, with no DOM and no three.js, needs no loading step, and the table (about 17.6 kB gzipped) is part of this entry point only: a page that does not import `/asteroids` does not carry it.

```ts
import { asteroidDistances, asteroidPositionAu, findAsteroid } from "@johnmorrisdotca/wakusei-planets/asteroids";

const eros = findAsteroid("Eros")!;
const day = new Date("2026-11-11T12:00:00Z");
const d = asteroidDistances(eros, day);
console.log(eros.name.en, eros.name.ja, "is a", eros.group, "asteroid, found in", eros.discoveryYear, "and visited by", eros.missions[0]!.name);
console.log("it is", d.sunAu.toFixed(2), "au from the Sun and", d.earthAu.toFixed(2), "au from the Earth;", d.lightMinutes.toFixed(1), "light minutes");
console.log("x, y, z in au:", asteroidPositionAu(eros, day).map((au) => au.toFixed(3)).join(", "));
```

## What is in the set

| Kind | Bodies | Examples |
|---|---|---|
| `main-belt` | 38 | Hygiea, Interamnia, Psyche, Gaspra, Ida, Lutetia, Šteins |
| `near-earth` | 29 | Eros, Itokawa, Ryugu, Bennu, Apophis, 2024 YR4, Phaethon, Didymos, Kamo`oalewa |
| `trojan` | 16 | Hektor, Achilles, Patroclus, Eurybates, Polymele, Leucus, Orus |
| `centaur` | 7 | Chariklo, Nessus, Asbolus |
| `trans-neptunian` | 14 | Arrokoth, Salacia, Varuna, Ixion, Varda, Albion, Leleākūhonua |

The near-Earth asteroids have a `group` as well: 1 Atira, 4 Aten, 20 Apollo and 4 Amor. A body the package already has is not repeated: Ceres, Pallas, Vesta, Chiron, Pholus, Halley, Pluto and the dwarf planets Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris and Sedna have their own, fuller, tables (so the largest asteroids here begin with Hygiea, the fourth largest). `hazardous` is JPL's own flag for a potentially hazardous asteroid; the numbers `H`, `diameterKm`, `albedo`, `rotationHours`, `spectral` and the discovery year are left out where the source has none.

## What you can ask

| Function | Gives |
|---|---|
| `ASTEROIDS` and `asteroidList()` | every record |
| `asteroidsOfKind(kind, group?)` | the bodies of one kind, or of one near-Earth group |
| `findAsteroid(query)` | a record by id, number, designation, English or Japanese name (case, accents and spaces do not matter) |
| `asteroidPositionAu(body, when)` and `asteroidPosition(body, when)` | x, y, z from the Sun in astronomical units (the unit of `heliocentric`) or kilometres, in the J2000 ecliptic frame |
| `asteroidDistances(body, when)` | distance from the Sun and the Earth in au, km and lunar distances, and the light time |
| `asteroidOrbitPoints(body, count)` | points round the whole orbit, for a line |
| `asteroidPeriodDays(body)` | the period in days |
| `asteroidFromElements(name, elements)` | a record for a body of your own, its kind worked out from the orbit |
| `asteroidAsSmallBody(body)` | the same orbit as the data door's `SmallBody`, to draw it with the points of `<wakusei-space>` |

```ts
import { asteroidFromElements, asteroidOrbitPoints, asteroidsOfKind } from "@johnmorrisdotca/wakusei-planets/asteroids";

for (const a of asteroidsOfKind("near-earth", "Aten")) console.log(a.name.en, a.hazardous ? "(potentially hazardous)" : "");
const mine = asteroidFromElements("2026 XX", { epochJd: 2461200.5, a: 1.8, e: 0.4, i: 12, node: 80, peri: 120, ma: 10 });
console.log(mine.kind, mine.group, asteroidOrbitPoints(mine, 90).length, "points on its orbit");
```

## How exact it is

The motion is two-body: Kepler's equation from the elements, with the package's own solver, and no planet pulls on the body. At the epoch (2026-06-09) it agrees with JPL Horizons to under 0.0000001 au. Away from it the error grows: on 16 bodies of every kind, at five times between a year before and a year after each epoch, the worst error against Horizons' own positions (which include the planets) was 0.001 au (150,000 km) within half a year and 0.004 au (600,000 km) within a year, the main-belt asteroids being the worst and the others under a quarter of it. `ASTEROID_ACCURACY` states the numbers. Beyond a year, or close to a planet, treat a position as a guide: a close approach in 2029 is not worked out from 2026's elements, and Apophis' pass of the Earth is in `/approaches`.

The elements are osculating at one epoch each, all 2026-06-09; Bennu's and 2018 AG37's own solutions are from other years, so theirs are Horizons' osculating elements for that date. `ASTEROIDS_FETCHED` holds the date the records were read, and orbits are refined as bodies are observed.

## Where the numbers come from

The orbits and physical numbers are from the Small-Body Database's Query API and the discovery dates from its API, fetched on 2026-11-11 by `scripts/make-asteroids-data.py`, which also measures the error against Horizons and writes `src/data/asteroids.ts`. NASA's data is a US government work and in the public domain; [NOTICE.md](../../NOTICE.md) says so. The missions and their years are plain facts; a visit that is still to come is marked `planned`.
