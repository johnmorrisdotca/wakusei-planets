---
title: Replacing suncalc
section: how-to
order: 14
description: Drop suncalc (2.x, 1.x or a fork) and use this package instead, by changing the import. Every function, option and result, the three changes people trip on, and the measured differences.
---

If you use [suncalc](https://github.com/mourner/suncalc) for the Sun's and Moon's position, sunrise and sunset, Moon rise and set, or the Moon's phase, you do not need it or its forks. `@johnmorrisdotca/wakusei-planets` has every function and option of suncalc 2.1 and of suncalc 1.9, with the same names, arguments and result shapes, on a better engine (the VSOP87B Sun and the ELP2000-82B Moon, delta T, parallax). What you change is the import line.

## The one-line change

| You use | Change the import to |
|---|---|
| suncalc 2.x (degrees, azimuth from north) | `@johnmorrisdotca/wakusei-planets/suncalc` |
| suncalc 1.x, or the forks suncalc2, suncalc3 and suncalc-ts (radians, azimuth from south) | `@johnmorrisdotca/wakusei-planets/suncalc/legacy` |

```ts
// before: import * as SunCalc from "suncalc";
import * as SunCalc from "@johnmorrisdotca/wakusei-planets/suncalc";

const noon = new Date(Date.UTC(2026, 5, 21, 12));
const times = SunCalc.getTimes(noon, 51.5, -0.1, 0, 60);
console.log(times.sunrise?.toISOString(), SunCalc.getPosition(noon, 51.5, -0.1).altitude.toFixed(0));
```

Code written `import SunCalc from "suncalc"` (suncalc 1.x's style) works too: both entries have a default export holding the same functions and the same `times` array.

```ts
import SunCalc from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const { azimuth, altitude } = SunCalc.getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
console.log(azimuth.toFixed(2), altitude.toFixed(2));
```

`require()` works as well on Node 22.12 and later (this package is ESM only, and Node loads an ES module from `require` since then):

```js no-run
const { getTimes } = require("@johnmorrisdotca/wakusei-planets/suncalc");
```

It has no dependencies and no DOM, so it runs on a server, in a worker and in a browser. The `/suncalc` entry is about 10 kB gzipped.

## Every function, side by side

The names, the arguments and the result keys are the same as suncalc's in both entries; the entries differ only in the conventions of the next section.

| suncalc | Here | Notes |
|---|---|---|
| `getPosition(date, lat, lng)` | the same | `azimuth`, `altitude` |
| `getTimes(date, lat, lng, height, utcOffset)` | the same | `nadir`, `nightEnd`, `nauticalDawn`, `dawn`, `sunrise`, `sunriseEnd`, `goldenHourEnd`, `solarNoon`, `goldenHour`, `sunsetStart`, `sunset`, `dusk`, `nauticalDusk`, `night`, and `alwaysUp` and `alwaysDown` at the poles. `/suncalc/legacy` has no `utcOffset` (suncalc 1.x had none) |
| `addTime(angle, riseName, setName)` and `times` | the same | `times` rows are `[angle, morningName, eveningName]`, and `getTimes` gives each new name |
| `getMoonPosition(date, lat, lng)` | the same | `azimuth`, `altitude`, `distance` (km), `parallacticAngle` |
| `getMoonIllumination(date?)` | the same | `fraction`, `phase`, `angle`, and `waxing` (`/suncalc` only, as in suncalc 2) |
| `getMoonTimes(date, lat, lng, utcOffset)` | the same | `rise`, `set`, `transit`, `lowerTransit`, `alwaysUp`, `alwaysDown`. `/suncalc/legacy` takes `inUTC` in place of `utcOffset` and gives `rise`, `set` and the flags, as suncalc 1.x did |

A `date` can also be milliseconds since 1970. A latitude outside -90 to 90, or a date that is not a date, throws a `RangeError` naming the value.

## The three changes people trip on

When you move from suncalc 1.x or a fork to `/suncalc`, these three things change; `/suncalc/legacy` keeps the old ones so you can move one step at a time.

1. **Angles are degrees**, not radians. Multiply by `180 / Math.PI`.
2. **Azimuth is measured from north**, clockwise (0 north, 90 east, 180 south, 270 west), not from south toward west. From the old value: `(azimuth * 180 / Math.PI + 180) % 360`.
3. **An event that does not happen is `null`** for the Sun and absent for the Moon, and a polar day or night sets `alwaysUp` or `alwaysDown`. In suncalc 1.x it is an invalid `Date` (`NaN`).

And the day rule, which is the same in both entries and in suncalc: `getTimes(date, lat, lng)` gives the solar day holding `date` (from one solar midnight to the next), so pass a time near local noon. With `utcOffset` in minutes east of UTC (`-480` for Vancouver in winter, `540` for Tokyo) it gives the local calendar day. In `/suncalc/legacy`, `getMoonTimes` searches the 24 hours from midnight, the machine's or UTC with `inUTC`, as suncalc 1.x did.

```ts
import { getPosition, getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const date = new Date(Date.UTC(2026, 5, 21, 12));
const old = getPosition(date, 51.5, -0.1);
console.log(((old.azimuth * 180 / Math.PI + 180) % 360).toFixed(0), (old.altitude * 180 / Math.PI).toFixed(0));
console.log(Number.isNaN(getTimes(date, 69.65, 18.96).sunrise.getTime()));
```

## What differs, on purpose

- **Below the horizon** the altitude is the geometric one with a refraction that fades to nothing at -2 degrees. suncalc 2 adds the horizon's 0.49 degrees at any depth, and so is 0.49 degrees higher than here for a Sun far below the horizon. Above the horizon the two agree to 0.01 degrees for the Sun.
- **The numbers are better**, so a time can differ from suncalc's by a few seconds (suncalc 2) or a few minutes (suncalc 1.x, which has no delta T and a mean-element Moon). In both, the one that is nearer to JPL Horizons is this package (see [the Sun and Moon from a place](suncalc.md)).
- **`/suncalc/legacy` Sun altitude has no refraction and the Moon's has**, and the bright-limb `angle` is negative while the Moon waxes: these are suncalc 1.x's own conventions, kept.
- **`alwaysUp` and `alwaysDown`** are both present, one `true` and one `false`, on a day without a sunrise (`getTimes`) or without a Moon rise or set (`getMoonTimes`), as in suncalc 2.

## How we checked it

Every function was run against suncalc 2.1.2 and suncalc 1.9.0, both installed as development dependencies of this package only (BSD 2-Clause; none of their code is shipped or copied), on one grid: fourteen places (the equator, both hemispheres, both polar circles, 78 degrees north and 77.85 south) by eleven days between 1900 and 2100 by three times of day. Names, result keys, flags and which events are present are identical; the numbers are within these limits, which the test enforces (`test/suncalc-grid.test.ts`):

| What | `/suncalc` against suncalc 2.1.2, worst on the grid | `/suncalc/legacy` against suncalc 1.9.0, worst on the grid |
|---|---|---|
| Sun altitude (above the horizon) | 0.01 degrees | 0.02 radians (1.2 degrees) |
| Sun azimuth | 0.03 degrees | 0.07 radians (4.3 degrees) |
| Moon altitude (above the horizon) | 0.06 degrees | 0.07 radians (3.9 degrees) |
| Moon azimuth | 0.07 degrees | 0.15 radians (8.5 degrees) |
| Moon distance | 0.002 percent | 1.6 percent |
| Illuminated fraction | 0.0001 | 0.017 |
| Sun times, up to 45 degrees of latitude | 38 s | 209 s |
| Sun times, 45 to 60 degrees | 38 s | 571 s |
| Sun times, polar circles and beyond | 38 s | 2132 s |
| Moon times | 23 s | up to 53 minutes, depending on the machine's zone (a mean-element Moon and 2-hour sampling) |

The old library's own error is the cause of the large legacy figures: this package's times are within a second of JPL Horizons, and suncalc 1.x's are not. If your code needs the old numbers to the minute, keep suncalc 1.x; if it needs the old conventions and the right numbers, use `/suncalc/legacy`.

## What suncalc3 has that this package does not

suncalc3 (a fork of suncalc 1.x) adds functions that neither suncalc nor this package has. They are listed here and not built; which of them to build is a decision for the maintainer.

| suncalc3 | What it does | Here today |
|---|---|---|
| `getSunTime(date, lat, lng, elevationAngle, height, degree, inUTC)` | rise and set of the Sun at one elevation | `addTime` then `getTimes` gives it, not as one call |
| `getSunTimeByAzimuth(date, lat, lng, azimuth, degree)` | when the Sun reaches an azimuth | not here |
| `getSolarTime(date, utcOffset, lng)` | solar time | not here for the Sun and Moon |
| `getMoonData(date, lat, lng)` | Moon position, illumination and zenith angle in one call | three calls give it |
| `moonTransit(rise, set, lat, lng)` | the Moon's transit | `getMoonTimes` gives `transit` and `lowerTransit` |
| a named phase (`id`, `name`, `emoji`, `css`) and `moonCycles` | one of eight named phases | the number only; the README of suncalc shows how to name it |
| `getMoonIllumination().next` | the dates of the next new, first quarter, full and last quarter Moon | not here |
| `zenith`, `declination`, `...Degrees` fields; `pos` and `elevation` on each Sun time | extra fields | degrees are the default in `/suncalc`; the rest not here |
| renamed times (`civilDawn`, `astronomicalDawn`, and so on) and blue hour times | aliases | not here; a blue hour is one `addTime` call |

suncalc-ts adds nothing beyond types. If you use suncalc3 for these extras, keep them from it for now and use this package for the rest.
