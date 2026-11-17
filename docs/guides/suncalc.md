---
title: The Sun and Moon from a place
section: how-to
order: 13
description: Position, sunrise and sunset, Moon rise, set and phase from a latitude and longitude, with suncalc 2's names and a better engine.
---

`/suncalc` answers the questions people ask of the sky from where they stand: where the Sun and the Moon are, when the Sun rises and sets, when it is golden hour or dark, when the Moon rises and sets, and how much of it is lit. It has the same functions, names, arguments and results as [suncalc](https://github.com/mourner/suncalc) 2, so a project changes its import and nothing else. It runs anywhere, with no browser, and imports only the Sun's and Moon's theories (about 10 kB gzipped).

```ts
import { getMoonIllumination, getMoonPosition, getMoonTimes, getPosition, getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc";

const vancouver = { lat: 49.3, lng: -123.1 };
const noon = new Date(Date.UTC(2026, 10, 7, 20));

const times = getTimes(noon, vancouver.lat, vancouver.lng, 0, -480);
console.log(times.sunrise?.toISOString(), times.sunset?.toISOString());

const sun = getPosition(noon, vancouver.lat, vancouver.lng);
console.log(sun.azimuth.toFixed(0), sun.altitude.toFixed(0));

const moon = getMoonPosition(noon, vancouver.lat, vancouver.lng);
console.log(Math.round(moon.distance), getMoonIllumination(noon).fraction.toFixed(2));
console.log(Object.keys(getMoonTimes(noon, vancouver.lat, vancouver.lng, -480)));
```

## The functions

| Function | Gives |
|---|---|
| `getPosition(date, lat, lng)` | the Sun's `azimuth` (degrees clockwise from north) and apparent `altitude` (degrees, refraction included) |
| `getTimes(date, lat, lng, height?, utcOffset?)` | `nadir`, `nightEnd`, `nauticalDawn`, `dawn`, `sunrise`, `sunriseEnd`, `goldenHourEnd`, `solarNoon`, `goldenHour`, `sunsetStart`, `sunset`, `dusk`, `nauticalDusk`, `night` as `Date`s, `null` for one that does not happen, and `alwaysUp` or `alwaysDown` at the poles |
| `addTime(angle, riseName, setName)` and `times` | your own times, when the Sun reaches an altitude |
| `getMoonPosition(date, lat, lng)` | `azimuth`, `altitude`, `distance` (km) and `parallacticAngle` |
| `getMoonIllumination(date?)` | `fraction` lit, `phase` (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), `angle` of the bright limb and `waxing` |
| `getMoonTimes(date, lat, lng, utcOffset?)` | `rise`, `set`, `transit` and `lowerTransit`, each absent on a day without it, and `alwaysUp` or `alwaysDown` |

A `date` is a `Date` or milliseconds since 1970. Latitude is degrees north (-90 to 90), longitude degrees east (west negative). A latitude outside the range, a longitude that is not a number or an invalid date throws a `RangeError` that names the value. `height` is the observer's height above the horizon in metres: it lowers the sunrise and sunset altitudes by the dip of the horizon, so from 1,000 m the Sun is up longer.

## Which day

`getTimes` and `getMoonTimes` give the events of one day, and there are two ways to say which:

- **With `utcOffset`** (minutes east of UTC, for example `-480` for Vancouver in winter, `540` for Tokyo): the local calendar day that holds `date`, at any time of day. This is the one to use when you know the zone.
- **Without it**: the solar day that holds `date`, from one solar midnight to the next. It follows the calendar day closely, but local midnight is usually a little before solar midnight, so pass a time near local noon.

`nadir` is the solar midnight that leads into the day's `solarNoon`, so for a calendar day it can fall a few minutes before the day begins.

## How exact it is

The Sun is the Earth's VSOP87B place, the Moon is the ELP2000-82B lunar solution, both run in terrestrial time and corrected for the Earth's turn (precession, nutation, the equation of the equinoxes), the Sun's aberration, the Moon's light time and parallax from the place's height on the ellipsoid. Refraction is Saemundsson's formula for standard air.

Rise and set times against JPL Horizons, with the same definition for every package (the Sun's centre 0.833 degrees below the airless horizon, the Moon's upper limb 34 arc-minutes below it), at London, Toronto, Tokyo, Quito, Sydney and Tromsø on seven days from 2000 to 2040 (156 events for each package, none missed or wrong):

| Package | Sunrise and sunset, worst | Moonrise and moonset, worst | Typical (median) |
|---|---|---|---|
| this package | 0.4 s | 0.4 s | 0.1 s |
| astronomy-engine 2.1.19 | 0.5 s | 1.4 s | 0.1 to 0.2 s |
| suncalc 2.1.2 | 5.3 s | 7.1 s | 1.3 to 2.3 s |

The test holds this package to 1 s of Horizons on every one of them (`scripts/compare/rise-set.mjs` measures all three; `python3 -I scripts/compare/fetch-rise-set.py` fetches the reference again). Against astronomy-engine's own rise and set, which uses the Sun's true size instead of a fixed 16 arc-minutes, the tests hold 12 s for the Sun and 8 s for the Moon.

Two things set the floor, and neither is in any of these packages: the Earth's turn is taken from UTC, which is within 0.9 s of the true UT1 (the worst case above, London in January 2000, is that difference), and the standard refraction is not the weather of the day, which moves sunrise by a few seconds at mid latitudes and by minutes near the horizon in cold or low-pressure air. So a time to the second is honest; a time to the tenth of a second is not.

## Coming from suncalc 2

Change the import and run your tests. The results agree within the limits above, and these are the places they do not:

- **Below the horizon** the Sun's and Moon's `altitude` is the geometric altitude with a refraction that fades to nothing at -2 degrees. suncalc 2 keeps adding the horizon's 0.49 degrees of refraction at any depth, which is not physical; above the horizon the two agree to 0.006 degrees.
- **The Moon's rise and set** are the upper limb at the horizon through 34 arc-minutes of refraction, from the Moon's real distance, which is what the Naval Observatory tables use.

## Coming from suncalc 1.x or suncalc2

suncalc 1.x, and the forks suncalc2 and suncalc3, use a different set of conventions from suncalc 2. `/suncalc/legacy` keeps them, so the one line that changes is the import:

```ts
// import * as SunCalc from "suncalc";   // 1.x, suncalc2
import * as SunCalc from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const noon = new Date(Date.UTC(2026, 5, 21, 12));
const { azimuth, altitude } = SunCalc.getPosition(noon, 51.5, -0.1);
console.log((azimuth * 180 / Math.PI).toFixed(0), (altitude * 180 / Math.PI).toFixed(0));
console.log(Number.isNaN(SunCalc.getTimes(noon, 69.65, 18.96).sunrise!.getTime()));
```

To move on to `/suncalc` (suncalc 2's conventions) later, three things change:

| | `/suncalc/legacy` (suncalc 1.x) | `/suncalc` (suncalc 2) |
|---|---|---|
| Angles | radians | degrees: `radians * 180 / Math.PI` |
| Azimuth | from south toward west (0 south, a quarter turn west) | clockwise from north (0 north, 90 east, 180 south): `(legacy * 180 / Math.PI + 180) % 360` |
| An event that does not happen | an invalid `Date`, so test with `Number.isNaN(d.getTime())` | `null` (absent for the Moon), with `alwaysUp` or `alwaysDown` at the poles |

The same Sun, read both ways:

```ts
import { getPosition as legacyPosition } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
import { getPosition } from "@johnmorrisdotca/wakusei-planets/suncalc";

const noon = new Date(Date.UTC(2026, 5, 21, 12));
const old = legacyPosition(noon, 51.5, -0.1);
const now = getPosition(noon, 51.5, -0.1);
console.log(((old.azimuth * 180 / Math.PI + 180) % 360).toFixed(1), now.azimuth.toFixed(1));
console.log((old.altitude * 180 / Math.PI).toFixed(1), now.altitude.toFixed(1));
```

Both lines agree. The altitudes part only low in the sky, by the refraction suncalc 1 leaves out of the Sun (about half a degree at the horizon).

### The day rule

- **`getTimes(date, lat, lng, height?)`** has no `utcOffset`: it gives the solar day nearest `date`, from one solar midnight to the next, as suncalc 1 does. Pass a time near local noon and the events are the local day's.
- **`getMoonTimes(date, lat, lng, inUTC?)`** searches the 24 hours from midnight of `date`'s day, midnight in the machine's zone or, with `inUTC` true, in UTC. A Moon that rises late can set on the next day and then the day has a `rise` and no `set`.
- In `/suncalc` both take `utcOffset` (minutes east of UTC) instead: the local calendar day, whatever the machine's zone.

### What else is the same as suncalc 1

The Sun's altitude has no refraction in it and the Moon's has; the bright-limb `angle` is negative while the Moon waxes; `getMoonTimes` has no `transit`; `getTimes` has `height` but no `utcOffset`. Its numbers come from the same engine as `/suncalc`, so they are better than suncalc 1's, which has no delta T and a mean-element Moon: it is 0.3 to 0.6 degrees off for the Sun in 1950.

## What is not here yet

suncalc3 adds functions and options that this package has not covered, among them the Sun's time at a chosen azimuth, solar time and the dates of the next phases (MODULES-537; suncalc-ts adds none). Eclipses, planets' rise and set and equinoxes are planned on the same engine and are not in `/suncalc`.
