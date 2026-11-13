---
title: Where the planets are in the sky
section: how-to
order: 34
description: The Sun, the Moon and the planets for a moment, and for a place, with right ascension and declination of date and of J2000, magnitude, size, phase, elongation, azimuth and altitude, as plain data.
---

`skyBodies(when, observer?)` from `@johnmorrisdotca/wakusei-planets/sky-bodies` says where the Sun, the Moon, the seven other planets and Pluto are in the sky at a moment: where on the sky, how bright, how big, how much of the disc is lit and how far from the Sun, and, when a place is given, which way to look and whether the body is up. It is a pure function: the moment is passed in, nothing reads a clock, there is no DOM and no three.js, and it uses this package's own positions (the sky engine of `/suncalc` for the Sun and the Moon, VSOP87B with light time and aberration for the planets, Pluto from its table) and no second model.

```js
import { skyBodies } from "@johnmorrisdotca/wakusei-planets/sky-bodies";

// Where the Sun, the Moon and the planets are over Tokyo at 21:00 on 21 June 2026 (12:00 UTC): plain data, no browser, no clock read.
const sky = skyBodies(Date.UTC(2026, 5, 21, 12), { latitude: 35.69, longitude: 139.69, heightM: 40 });
const up = sky.filter((body) => body.aboveHorizon).map((body) => body.id);
const moon = sky.find((body) => body.id === "moon");
const mars = sky.find((body) => body.id === "mars");

console.log(`Up: ${up.join(", ")}`);
console.log(`Moon: ${Math.round(moon.illuminatedFraction * 100)} per cent lit, ${moon.horizontal.altitudeDeg.toFixed(1)} degrees up`);
console.log(`Mars: magnitude ${mars.magnitude.toFixed(1)}, ${mars.elongationDeg.toFixed(0)} degrees ${mars.east ? "east" : "west"} of the Sun`);
```

`when` is a `Date` or milliseconds since 1970, UTC. `observer` is `{ latitude, longitude, heightM? }`: degrees north, degrees east and metres. The result is a list of ten bodies in the order `SKY_BODY_IDS` (`sun`, `moon`, `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`), each a plain object that is safe to turn into JSON; `skyBody(id, when, observer?)` gives one.

| Field | What it is |
| --- | --- |
| `id`, `name.en`, `name.ja`, `kind` | The body, its names and `star`, `moon`, `planet` or `dwarf`. |
| `accurate` | `true` where the figures hold to the accuracy below, for every body. Pluto outside the years its table is fitted for (1800 to 2199) is still returned, with `accurate: false`: its place then comes from an approximate orbit that can be wrong by degrees. |
| `equatorialDate` | The apparent place of the moment: right ascension and declination in degrees, true equator and equinox of date, aberration and nutation in. |
| `equatorialJ2000` | The same direction without aberration, in the J2000 equatorial frame, in degrees: what a chart drawn on J2000 reads. |
| `distanceAu`, `distanceKm` | The distance from the Earth's centre. |
| `magnitude` | The apparent visual magnitude (Saturn's with its rings). |
| `angularDiameterArcsec` | The disc's angular diameter in arcseconds. |
| `phaseAngleDeg`, `illuminatedFraction` | The Sun-body-Earth angle (0 full, 180 new) and the share of the disc that is lit, 0 to 1. |
| `elongationDeg`, `east` | Degrees from the Sun and whether the body is on the evening side (east) of it. Left out for the Sun. |
| `moon` | The Moon only: `phase` (0 new to 1, one cycle), `waxing` and `brightLimbAngleDeg`. |
| `horizontal`, `aboveHorizon` | With an observer only: `azimuthDeg` from north through east, `altitudeDeg` (geometric, parallax in), `apparentAltitudeDeg` (with the standard refraction), `hourAngleDeg`, `parallacticAngleDeg`; and whether the apparent altitude is above 0. The Moon's parallax is taken out of the Earth's centre to the place, so it is up to about a degree different from the geocentric altitude. |

Angles are in degrees, distances in astronomical units (and kilometres), sizes in arcseconds, and the unit or the frame is in each field's name.

## How close it is

Checked against JPL Horizons (observer tables, read online on three dates, 2024-03-20, 2026-06-21 and 2030-12-01, and for Tokyo and Ottawa), the Sun, the planets and Pluto are within 0.1 arcminute in right ascension and declination, of date and of J2000; the Moon within 0.05 arcminute of date and 0.3 of J2000. The angular diameters are within 0.1 per cent, the illuminated fraction within 0.02 percentage points, the elongation within 0.02 degrees, and azimuth and altitude within 0.1 arcminute with the Moon's parallax in. The magnitudes are within 0.02 for the Sun, Mercury, Venus, Jupiter and Saturn, 0.03 for Uranus and Neptune, 0.06 for the Moon, 0.1 for Mars (its surface markings are not modelled) and 0.5 for Pluto, which has a fixed absolute magnitude and nothing more. The planets' magnitudes are the Astronomical Almanac's formulas as Mallama and Hilton (2018) give them (the formulas only, in `NOTICE.md`). The time is UTC, taken as UT1 (up to 0.9 s, 0.004 degrees of the Earth's turn), and the standard refraction is for air at 10 degrees C and 1010 hPa.

## A star chart takes it as data

A page that draws a star chart passes this list in as plain data: the chart keeps its own input type, it does not import this package, and this package does not import the chart. Rise, set and transit times are not here: they are in [`/suncalc`](suncalc.md).
