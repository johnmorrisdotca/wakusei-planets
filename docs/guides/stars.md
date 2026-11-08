---
title: The stars you can see without a telescope
section: how-to
order: 15
description: 5,080 stars to magnitude 6.0 with names, positions, proper motion, distance and colour, about 100 kB gzipped and no dependencies.
---

`/stars` is the sky behind the planets: every star the unaided eye can see from a dark place, 5,080 of them, from the Yale Bright Star Catalogue. Each has its catalogue number, its name where it has one, its position, how fast it moves, how bright it is, its colour and its distance. It runs anywhere and imports nothing but the clock. The table is about 100 kB gzipped and loads when you first ask for a star, and nothing else in the package imports it.

```ts
import { starByName, starColour, starDistanceLightYears, starPosition, stars } from "@johnmorrisdotca/wakusei-planets/stars";

const sirius = starByName("Sirius")!;
console.log(sirius.designation, sirius.magnitude, sirius.spectralClass);
console.log(starColour(sirius), starDistanceLightYears(sirius)?.toFixed(1), "light-years");
console.log(starPosition(starByName("Arcturus")!, Date.UTC(2100, 0, 1)).declination.toFixed(3));
console.log(stars({ magnitude: 2 }).length, "stars as bright as magnitude 2");
```

## Finding a star

| Function | Gives |
|---|---|
| `stars({ magnitude? })` | the stars as bright as a magnitude, brightest first (all 5,080 by default) |
| `starByHr(hr)` | one star by its Bright Star Catalogue (Harvard Revised) number; Sirius is 2491 |
| `starByName(text)` | one star by its common name (`Sirius`) or its designation (`α CMa`, `9 CMa`), ignoring case |

How many stars: 15 to magnitude 1, 50 to 2, 174 to 3, 518 to 4, 1,630 to 5 and 5,080 to 6. A page that draws a small sky can ask for magnitude 4 and use 518 stars.

A `Star` has `hr`, `name`, `designation`, `constellation`, `rightAscension` and `declination` (degrees, J2000), `magnitude`, `colourIndex`, `spectralClass`, `properMotionRaMas`, `properMotionDecMas` and `parallaxMas`. 111 stars have a common name, spelled as the IAU Working Group on Star Names spells it; the rest are known by their Bayer letter (`β Cru`) or Flamsteed number (`9 CMa`). A star without a name has `name` set to `undefined`.

## Where a star is

`rightAscension` and `declination` are the catalogue's, for J2000, in the FK5 frame (the ICRS to a fraction of an arc-second). The catalogue gives right ascension to 0.1 second of time, which is 1.5 arc-seconds at the equator, and declination to the arc-second, so a position here is good to about that. Right ascension is degrees from 0 to 360, never hours.

`starPosition(star, when?)` carries the position forward or back by the star's proper motion in a straight line, and stays in the J2000 frame. A straight line is good to a fraction of an arc-second for centuries for nearly every star here, and it is not the way to follow the few fast ones over thousands of years. To draw the sky as it looks on a date, convert the J2000 position with [`/coordinates`](coordinates.md).

## How far, and what colour

`starDistanceLightYears(star)` is 3261.56 divided by the parallax in milliarcseconds. The catalogue's parallaxes are good for near stars (Sirius is 8.7 light-years) and poor for far ones (Betelgeuse and Polaris are listed at hundreds of light-years, with errors of the same size), so treat a distance past about 100 light-years as rough, and `undefined` means the catalogue has none.

`starColour(star)` is a `#rrggbb` colour to draw: the star's B-V colour index goes to a temperature (`starTemperatureK`, Ballesteros's relation) and the temperature to the colour of a black body (`blackBodyColour`). It is the colour a camera would record, so blue-white Rigel and orange Betelgeuse come out as they look in a photograph, not as the eye sees them. A star without a colour index is white.

## Where the data comes from

The Yale Bright Star Catalogue (Hoffleit and Warren 1991, catalogue V/50 of the Astronomical Data Center and CDS) is credited in [NOTICE.md](../../NOTICE.md). It is used because the larger catalogues (Hipparcos, Tycho and Gaia) are licensed by ESA for non-commercial use only, which an MIT package cannot pass on. The catalogue's own documentation calls it public domain and asks that it and its authors be acknowledged; there is no formal licence text, and NOTICE.md says so. Fainter stars than magnitude 6.0 are not in this package.
