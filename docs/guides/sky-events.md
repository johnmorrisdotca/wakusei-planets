---
title: Sky events (experimental)
section: how-to
order: 37
description: Equinoxes and solstices, Moon phases, eclipses, and the other sky events to come, through astronomy-engine as an optional peer. Experimental in 0.x.
---

`@johnmorrisdotca/wakusei-planets/sky` answers "when": when the seasons begin, when the Moon is new, full or at a quarter, which eclipses happen and, as they are added, a planet's rise and set. It is **experimental during 0.x**: the names, the search windows and the results may change before 1.0 (every export is marked `@experimental`). Where [Where the planets are in the sky](sky-bodies.md) says where a body is at a moment, this entry finds the moment a thing happens.

It is a thin, typed layer over [astronomy-engine](https://github.com/cosinekitty/astronomy), which is an **optional peer dependency**. A page that never imports `/sky` never needs it, and the rest of the package never reaches it (a test holds that, by the import graph of every entry point).

```sh
pnpm add astronomy-engine
```

The range the package accepts is `>=2.1.19 <3`. Without it, importing `/sky` fails at once, with the runtime's own error that names the package (for Node, `Cannot find package 'astronomy-engine'`; for a bundler, `Could not resolve "astronomy-engine"`).

```js
import { seasons } from "@johnmorrisdotca/wakusei-planets/sky";

// The equinoxes and solstices of 2026, in UTC: plain Dates, no browser, no clock read. Needs the optional peer: pnpm add astronomy-engine
const year = seasons(2026);

console.log(`Spring equinox ${year.marchEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Summer solstice ${year.juneSolstice.toISOString().slice(0, 16)}Z`);
console.log(`Autumn equinox ${year.septemberEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Winter solstice ${year.decemberSolstice.toISOString().slice(0, 16)}Z`);
```

## What is here

| Function | Gives | Checked against |
|---|---|---|
| `seasons(year)` | the March equinox, June solstice, September equinox and December solstice of a year, as `Date`s (UTC) | the US Naval Observatory's table: 16 events in 1900, 2000, 2026 and 2050, the worst miss 60 seconds (the table is to the minute) |
| `moonPhases(from, to)`, `nextMoonPhase(from, { phase, within })` | the new, first quarter, full and last quarter Moon in an interval (start included, end not), or the next one of a kind, as `Date`s | the USNO table of 2026: all 50 phases, in order, the engine 11 to 80 seconds after the table's stamp (the table drops the seconds) |
| `findEclipses(from, to)` | every solar and lunar eclipse in an interval (start included, end not): type, kind, the moment of greatest eclipse, and the obscuration of a solar one | NASA's eclipse predictions for 2021 to 2030: all 22 solar and 22 lunar eclipses of the right kind; greatest eclipse within 9 s (solar) and 13 s (lunar) of NASA's dynamical time less 69 s |

## The conventions

New names follow the API conventions draft (docs/design/api-conventions.md in the repository): angles in degrees without a suffix, lengths with their unit, times as `Date`, and `null` for an event that does not happen in the window. The older `skyBodies` fields carry a `Deg` suffix; the two stay different until 1.0.

## Choices made by default, for John to confirm

This entry was built with the plan's recommended choices. Each is a default, for John to confirm:

- the `./sky` entry, with astronomy-engine as an optional peer (`peerDependencies` `>=2.1.19 <3`, `peerDependenciesMeta` optional);
- a missing peer is the runtime's own error, from a plain static import. The plan preferred a top-level `await import()` with a worded error, but the package's size measure targets ES2020, which refuses top-level await (and so would any reader's ES2020 bundler), so the plan's fallback is used;
- result types have no `Deg` suffix, against `SkyBody`'s;
- events are `@experimental` in 0.x;
- Jupiter's moons and constellations are not wrapped: the package's own moons are already tested, and the constellation boundaries belong to hoshi-stars.
