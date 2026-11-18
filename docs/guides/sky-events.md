---
title: Sky events (experimental)
section: how-to
order: 37
description: Equinoxes and solstices, Moon phases, eclipses (global and local), rise and set over a calendar day, conjunctions and oppositions, peak magnitude, libration, lunar apsides and nodes, and greatest elongation, through astronomy-engine as an optional peer. Experimental in 0.x.
---

`@johnmorrisdotca/wakusei-planets/sky` answers "when": when the seasons begin, when the Moon is new, full or at a quarter, which eclipses happen (and what one looks like from where you stand), when a body rises and sets on a calendar day of your time zone, when a planet is in conjunction or opposition, how bright Venus gets, the Moon's libration, apsides and nodes, and a planet's greatest elongation. It is **experimental during 0.x**: the names, the search windows and the results may change before 1.0 (every export is marked `@experimental`). Where [Where the planets are in the sky](sky-bodies.md) says where a body is at a moment, this entry finds the moment a thing happens.

It is a thin, typed layer over [astronomy-engine](https://github.com/cosinekitty/astronomy), which is an **optional peer dependency**. A page that never imports `/sky` never needs it, and the rest of the package never reaches it (a test holds that, by the import graph of every entry point).

```sh
pnpm add astronomy-engine
```

The range the package accepts is `>=2.1.19 <3`. Without it, importing `/sky` fails at once, with the runtime's own error that names the package (for Node, `Cannot find package 'astronomy-engine'`; for a bundler, `Could not resolve "astronomy-engine"`).

```js
import { nextAlignment, riseSetTimes, seasons } from "@johnmorrisdotca/wakusei-planets/sky";

// The equinoxes and solstices of 2026, in UTC: plain Dates, no browser, no clock read. Needs the optional peer: pnpm add astronomy-engine
const year = seasons(2026);

console.log(`Spring equinox ${year.marchEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Summer solstice ${year.juneSolstice.toISOString().slice(0, 16)}Z`);
console.log(`Autumn equinox ${year.septemberEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Winter solstice ${year.decemberSolstice.toISOString().slice(0, 16)}Z`);

// Sunrise and sunset over a calendar day of a time zone (the zone is required): New York on 1 November 2026, the day the clocks go back.
const newYork = { observer: { latitude: 40.7128, longitude: -74.006 }, timeZone: "America/New_York" };
const day = riseSetTimes("sun", Date.UTC(2026, 10, 1, 12), newYork);
const clock = (date) => date.toLocaleTimeString("en-GB", { timeZone: newYork.timeZone, hour: "2-digit", minute: "2-digit" });
console.log(`Sunrise ${clock(day.rise)}, sunset ${clock(day.set)}`);

// Jupiter's opposition: its ecliptic longitude 180 degrees from the Sun's (not the closest approach of two bodies, which /nearest finds).
const opposition = nextAlignment("jupiter", Date.UTC(2026, 0, 1), { kind: "opposition" });
console.log(`Jupiter opposition ${opposition.time.toISOString().slice(0, 16)}Z`);
```

## What is here

| Function | Gives | Checked against |
|---|---|---|
| `seasons(year)` | the March equinox, June solstice, September equinox and December solstice of a year, as `Date`s (UTC) | the US Naval Observatory's table: 16 events in 1900, 2000, 2026 and 2050, the worst miss 60 seconds (the table is to the minute) |
| `moonPhases(from, to)`, `nextMoonPhase(from, { phase, within })` | the new, first quarter, full and last quarter Moon in an interval (start included, end not), or the next one of a kind, as `Date`s | the USNO table of 2026: all 50 phases, in order, the engine 11 to 80 seconds after the table's stamp (the table drops the seconds) |
| `findEclipses(from, to)` | every solar and lunar eclipse in an interval (start included, end not): type, kind, the moment of greatest eclipse, the obscuration of a solar one and the **umbral magnitude** of a lunar one (negative for a penumbral eclipse) | NASA's eclipse predictions for 2021 to 2030: all 22 solar and 22 lunar eclipses of the right kind; greatest eclipse within 9 s (solar) and 13 s (lunar) of NASA's dynamical time less 69 s; the lunar umbral magnitude of all 22 within 0.006 of NASA's column |
| `nextRise`, `nextSet`, `nextTransit(body, from, { observer, within })` | the next rise, set or meridian crossing of the Sun, the Moon or a planet for an observer, a `Date` or `null` | JPL Horizons rise/transit/set for the seven planets at Tokyo on 2 days: all 42 events inside the minute Horizons stamps (the stamp is the first minute after the event); the Sun agrees with `/suncalc` to 10 s |
| `riseSetTimes(body, date, { observer, timeZone })` | the rise, transit and set of the Sun, the Moon or a planet over one calendar day of an IANA time zone (23, 24 or 25 hours on a clock-change day), and `horizon`: `"crosses"`, or `"above"` or `"below"` for a body up or down all day (the poles). `timeZone` is required | the USNO's one-day service, 22 events at New York on both clock-change days of 2026 (1 November, 8 March), Sydney (4 October) and Tromso (the midnight Sun, the polar night, and the Moon above the horizon all day): the worst 28.9 s, the table being to the minute; an event the USNO puts outside the zone's day is `null` here |
| `nextAlignment(body, from, { kind, within })` | the next conjunction, opposition or quadrature with the Sun **by ecliptic longitude** (the apparent longitudes of the Almanac and Horizons): `{ time, kind, side, inferior }`. Not the closest approach of two bodies, which `/nearest` finds | JPL Horizons' ecliptic longitudes, five events (Jupiter and Mars oppositions, Venus's superior and inferior conjunctions, Saturn's western quadrature): the worst 4.7 minutes; the Moon's alignments agree with `nextMoonPhase` to 3 minutes |
| `nextPeakMagnitude("venus", from)` | when Venus is brightest, and its magnitude, as `{ time, magnitude }`. **Venus only**: astronomy-engine supports no other body (see below) | JPL Horizons' magnitudes, 14 to 30 September 2026: 1.9 days and 0.029 magnitudes from the vertex of the curve, which is flat (-4.804 over 3 days); the engine's magnitude model is the fainter by 0.03 |
| `localSolarEclipse(from, { observer, within })` | the next solar eclipse an observer can see, with `partialBegin`, `centralBegin`, `peak`, `centralEnd` and `partialEnd` (NASA's C1, C2, maximum, C3 and C4), each a time and the Sun's altitude, and the obscuration | NASA's city table for 12 August 2026 (Valencia, Zaragoza, Leon, Barcelona, London): every contact and maximum within 37 s of NASA's whole-minute stamp, the coverage within one percent, the sunset NASA prints in place of C4 within the minute, and the Sun below the horizon at the eclipse's end exactly where NASA's star says so |
| `moonLibration(when)` | the Moon's libration in longitude and latitude, its distance and size, from the centre of the Earth | JPL Horizons, 14 days: within 0.007 degrees in longitude, 0.024 in latitude, and 51 km in distance (the engine's Moon runs short smoothly); optical libration only |
| `lunarApsides(from, to)`, `lunarNodes(from, to)` | every perigee and apogee (with the distance), every crossing of the ecliptic (ascending or descending) in an interval | JPL Horizons, November 2026: the node within 22 seconds; perigee and apogee 6 to 7 minutes from where Horizons' range rate is zero (the minimum is flat; the range itself is within 1 km at perigee and 42 km at apogee) |
| `nextGreatestElongation(body, from)` | the next greatest elongation of Mercury or Venus: the moment, the angle and the side (`"east"` evening, `"west"` morning) | JPL Horizons elongation series, vertex of the parabola: Mercury 18 February 2026 within 4 minutes and 0.0005 degrees, Venus 15 August 2026 within 8 minutes and 0.0008 degrees |

## Notes on the new functions

- **Calendar day.** `riseSetTimes` takes the day of the zone that holds `date`, from local midnight to the next, so `date` may be any moment of it. Where a clock change skips midnight, the day starts at the first moment of that date. `transit` is the upper meridian crossing and is given even for a Sun below the horizon (the USNO lists none then). `"above"` or `"below"` is judged at the middle of the day, the centre of the body against the horizon with refraction, for a day with no rise and no set.
- **Alignments.** A conjunction of Mercury or Venus is either inferior (`inferior: true`, between the Earth and the Sun) or superior; they have no opposition or quadrature, and asking throws. The Sun has none. For the Moon, a conjunction is the new Moon, an opposition the full Moon and a quadrature a quarter. The search walks day by day and settles to 0.1 s, so an event within a quarter of a second before `from` counts as at it; none within `within.days` (850 when not given) is `null`.
- **Peak magnitude, a limit of astronomy-engine.** The engine finds a peak for Venus only, because Mercury's peak is at superior conjunction and the outer planets and the Moon peak at opposition and full, which `nextAlignment` and `nextMoonPhase` give. Any other body throws a `RangeError` that says so. The magnitude of any body at any moment is in `skyBody()`.
- **Local eclipses.** The altitude is the Sun's centre with refraction, as the engine gives it, and is negative when the contact is below the horizon: an eclipse can be partly or wholly unseen. Annular eclipses are found the same way (`kind: "annular"`, the ring phase in `centralBegin` and `centralEnd`) but no reference for one was checked.
- **Lunar eclipse magnitude.** The engine does not report it, so the wrapper works it out from the engine's own shadow geometry (the Earth's radius with 88 km of atmosphere), and the test holds it to NASA's published column. A solar eclipse's magnitude at its greatest point is not given, only the obscuration.

## The conventions

New names follow the API conventions draft (docs/design/api-conventions.md in the repository): angles in degrees without a suffix, lengths with their unit, times as `Date`, and `null` for an event that does not happen in the window. The older `skyBodies` fields carry a `Deg` suffix; the two stay different until 1.0.

## Choices made by default, for John to confirm

This entry was built with the plan's recommended choices. Each is a default, for John to confirm:

- the `./sky` entry, with astronomy-engine as an optional peer (`peerDependencies` `>=2.1.19 <3`, `peerDependenciesMeta` optional);
- a missing peer is the runtime's own error, from a plain static import. The plan preferred a top-level `await import()` with a worded error, but the package's size measure targets ES2020, which refuses top-level await (and so would any reader's ES2020 bundler), so the plan's fallback is used;
- result types have no `Deg` suffix, against `SkyBody`'s;
- events are `@experimental` in 0.x;
- Jupiter's moons and constellations are not wrapped: the package's own moons are already tested, and the constellation boundaries belong to hoshi-stars.
