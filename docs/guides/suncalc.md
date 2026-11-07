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

| Measured against | Sunrise and sunset | Moonrise | Where |
|---|---|---|---|
| astronomy-engine (an independent library) | within 7 s | within 1 s | six places in both hemispheres, five days from 2000 to 2045 |
| suncalc 2.1.2 | within 37 s, most within 7 s | within 8 s | the same places and days |

The limits the tests hold are a little looser (12 s and 8 s against astronomy-engine). Two things set the floor: the Earth's turn is taken from UTC, which is within 0.9 s of the true UT1, and the standard refraction is not the weather of the day, which moves sunrise by a few seconds at mid latitudes and by minutes near the horizon in cold or low-pressure air.

## Coming from suncalc 2

Change the import and run your tests. The results agree within the limits above, and these are the places they do not:

- **Below the horizon** the Sun's and Moon's `altitude` is the geometric altitude with a refraction that fades to nothing at -2 degrees. suncalc 2 keeps adding the horizon's 0.49 degrees of refraction at any depth, which is not physical; above the horizon the two agree to 0.006 degrees.
- **The Moon's rise and set** are the upper limb at the horizon through 34 arc-minutes of refraction, from the Moon's real distance, which is what the Naval Observatory tables use.

## Coming from suncalc 1.x or its forks

suncalc 1 (and the forks suncalc2 and suncalc3) use a different set of conventions. `/suncalc/legacy` keeps them, so only the import changes:

```ts
import { getPosition, getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const { azimuth, altitude } = getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
console.log((azimuth * 180 / Math.PI).toFixed(0), (altitude * 180 / Math.PI).toFixed(0));
console.log(Number.isNaN(getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 69.65, 18.96).sunrise!.getTime()));
```

The three changes that trip people up when they move to suncalc 2 (or to `/suncalc` here) are:

1. **Angles are degrees**, not radians.
2. **Azimuth is measured from north**, clockwise (0 north, 90 east, 180 south, 270 west), not from south toward west.
3. **An event that does not happen is `null`** (or absent for the Moon) and a polar day or night sets `alwaysUp` or `alwaysDown`, not an invalid `Date`.

The legacy sub-path has suncalc 1's other conventions too: the Sun's altitude without refraction and the Moon's with it, the bright-limb `angle` negative while the Moon waxes, and `getMoonTimes(date, lat, lng, inUTC)` searching the 24 hours from midnight (the machine's, or UTC). Its numbers come from the same engine, so they are better than suncalc 1's, which has no delta T and a mean-element Moon: it is 0.3 to 0.6 degrees off for the Sun in 1950.

## What is not here yet

suncalc3 and suncalc-ts add a few functions and options that this package has not covered (MODULES-537). Eclipses, planets' rise and set and equinoxes are planned on the same engine and are not in `/suncalc`.
