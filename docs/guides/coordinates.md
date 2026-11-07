---
title: Coordinate conversions
section: how-to
order: 12
description: Pure coordinate rotations in degrees, with named frames and AU components.
---

Import `/coordinates` in Node or a browser. It imports only `/time`, never rendering, body data, textures or browser globals. There are no new dependencies. The test bundles the whole sub-path and enforces a **4 KiB minified gzip budget**, including its imports.

```ts
import { sphericalToCartesian, cartesianToSpherical, eclipticToEquatorial } from "@johnmorrisdotca/wakusei-planets/coordinates";

const context = { origin: "geocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric" } as const;
const vector = sphericalToCartesian({ ...context, longitude: 113.215630, latitude: 6.684170, distanceAu: 1 });
console.log(vector.xAu, vector.yAu, vector.zAu);
console.log(cartesianToSpherical(vector));
console.log(eclipticToEquatorial({ ...context, eclipticLongitude: 113.215630, eclipticLatitude: 6.684170 }));
```

## Meaning and units

All angles, including right ascension, are **degrees**. Longitude and right ascension return in [0, 360); latitude and declination in [-90, 90]. Components are `xAu`, `yAu`, `zAu`; radius is `distanceAu`. Cartesian axes are right-handed: x points to longitude zero, y to longitude 90°, z to the north pole. Radius must be positive. A zero vector has no direction and throws. At a spherical pole, returned longitude is conventionally zero.

Every input and output carries `origin`, `frame`, `epoch`, and `corrections`. Origins are `heliocentric`, `geocentric`, or `topocentric`. Rotations preserve the origin and accept only `corrections: "geometric"`. They do not calculate a body position or add light-time, aberration, parallax or refraction.

| Frame | Epoch | Meaning |
| --- | --- | --- |
| `eclipticJ2000` | `"J2000"` | Mean ecliptic and equinox of JD 2451545.0 TT |
| `equatorialJ2000` | `"J2000"` | Mean equator and equinox of JD 2451545.0 TT |
| `eclipticOfDate` | Unix UTC milliseconds | Mean ecliptic and equinox at that instant |
| `equatorialOfDate` | Unix UTC milliseconds | Mean equator and equinox at that instant |
| `horizontal` (output only) | Unix UTC milliseconds | Observer's local horizon at that instant |

`eclipticToEquatorial` and `equatorialToEcliptic` rotate by the matching mean obliquity. They **do not precess a J2000 direction to another epoch**. Use the same origin and epoch when combining results. They return directions, without a distance; a rotation does not change the input distance.

## An observer's horizon

```ts
import { equatorialToHorizontal } from "@johnmorrisdotca/wakusei-planets/coordinates";

const when = new Date("2026-11-07T12:00:00Z");
console.log(equatorialToHorizontal({
  origin: "topocentric", frame: "equatorialOfDate", epoch: when.getTime(),
  corrections: "geometric", rightAscension: 120, declination: 20,
}, when, { observer: { latitude: 49.3, longitude: -123.1, heightM: 0 } }));
```

`equatorialToHorizontal(direction, when, { observer })` requires **mean equatorial-of-date** coordinates with an epoch equal to `when`. A J2000 direction is rejected. `when` accepts a `Date` or Unix milliseconds; a supplied Date is never mutated. No machine time zone is used.

Observer latitude is degrees north, [-90, 90]; longitude is degrees east, [-180, 180], west negative. `heightM` defaults to zero, metres above mean sea level. Height is validated but does not affect this direction-only rotation. There is no horizon dip or atmospheric model. Azimuth is clockwise from north (east 90°), altitude is [-90, 90]. At zenith or nadir, undefined azimuth is conventionally zero. At a geographic pole, longitude selects the reference meridian.

A geocentric input remains labelled geocentric: the result is an orientation relative to the observer's horizon, **without topocentric parallax**. For a nearby body, supply an already topocentric direction for its geometric observed altitude.

## Models, limits and errors

The formulas are independently implemented from Jean Meeus, *Astronomical Algorithms*, second edition, chapters 12, 13 and 22: spherical rotations, IAU 1980 mean obliquity (22.2), and Greenwich mean sidereal time (12.4). Nutation is excluded. `/time` converts UTC to TT for obliquity; sidereal time approximates UT1 by UTC. This is a geometric conversion utility, not an apparent-place or precision pointing model.

Known-answer tests cover Meeus examples 13.a, 13.b and 22.a, with the mean/apparent sidereal distinction stated in the horizontal test. Obliquity is tested across 1800–2050; outside that interval it extrapolates the same polynomial without an accuracy guarantee. A representable JavaScript Date is required for time-dependent calculations. Invalid/nonfinite values, wrong frames or epochs, out-of-range latitude/observer longitude, zero radius and vector overflow throw `RangeError`; they never produce `NaN`. Angles supplied as longitude or right ascension are wrapped.

The feature checklist in [IoannisNasios/solarsystem's README](https://github.com/IoannisNasios/solarsystem/blob/master/README.md) informed the scope only. No implementation code was consulted or copied.
