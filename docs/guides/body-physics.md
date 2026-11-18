---
title: Physics of a body
section: how-to
order: 16
description: Mass and GM, surface gravity, the air at the surface and the surface temperature of the Sun, the planets, Pluto and the Moon, each figure with its source and the day it was read.
---

`/body-physics` is what a physics model of a body needs, as data: its mass and GM, its surface gravity, the density and pressure of the air at its surface, and its surface temperature. Each figure carries the page it was read from and the day it was read, and is `null` where the source has none. There is no browser code, so it runs on a server too.

```ts
import { bodyPhysics } from "@johnmorrisdotca/wakusei-planets/body-physics";

const earth = bodyPhysics("earth");
console.log(earth.mass?.value, earth.gm?.value, earth.surfaceGravity?.value);
console.log(earth.airDensity?.value, earth.pressure?.value, earth.temperature?.value);
console.log(earth.pressure?.quoted, earth.pressure?.source.url, earth.pressure?.source.pageUpdated, earth.pressure?.source.read);

const jupiter = bodyPhysics("jupiter");
console.log(jupiter.surfaceGravity?.value, jupiter.surfaceGravity?.level, jupiter.temperature?.value);

const moon = bodyPhysics("moon");
console.log(moon.airDensity, moon.temperature?.value, moon.temperature?.low, moon.temperature?.high);
```

The output is:

```text
5.9722e+24 398600 9.82
1.217 101400 288
1014 mb https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html 2024-11-15 2026-11-18
25.92 1 bar 165
null null 95 390
```

`bodyPhysics` takes `"sun"`, `"mercury"` to `"neptune"`, `"pluto"` or `"moon"` and gives a new object each call; any other id throws a `RangeError` that names it. The fields:

| Field | Meaning |
|---|---|
| `mass` | the mass, in kilograms |
| `gm` | the gravitational parameter, in km3/s2 |
| `surfaceGravity` | in m/s2: the mean at the surface, the Sun's at its equator, and the gas giants' at the 1 bar level |
| `airDensity` | the air's density at the surface in kg/m3, or at the 1 bar level for the gas giants. `null` for the Sun, Mercury, the Moon and Pluto, whose pages give none |
| `pressure` | the pressure in pascals: at the surface, at the 1 bar level (100,000 Pa) for the gas giants, whose pages give no surface, and at the top of the Sun's photosphere |
| `temperature` | in kelvin: the mean at the surface, the gas giants' at the 1 bar level, the Sun's effective temperature. `value` is `null` where the page gives only a range (the Moon and Pluto), and `low` and `high` hold it |

Each figure is an object: `value` and `unit`, `source` (`name`, `url`, `pageUpdated` the day the page says it was last updated, and `read` the day it was read for this package), and, where they apply, `quoted` (the page's own wording, `"~0.016 +/- 0.006 kg/m3"`), `bound` (`"below"` for an upper limit, `"about"` for an approximate figure), `uncertainty`, `low` and `high` (a season's or a day's range), `level` (`"1 bar"`) and `note`.

## Where the figures come from

All of them are read from NASA's planetary fact sheets (the National Space Science Data Center, https://nssdc.gsfc.nasa.gov/planetary/factsheet/), one page for each body, on 2026-11-18. They are facts typed as a table, and none of the pages' text is copied. The sheets give the gas giants' gravity, density and temperature at the 1 bar level and no surface, so the pressure of a gas giant is the level itself: 100,000 Pa. Mercury's pressure is the sheet's upper limit (`bound` is `"below"`), the Moon's is the sheet's night-time figure, and Pluto's is its approximate 13 microbar. Where the sheets differ from other tables (the Earth's surface gravity is 9.820 m/s2 as the mean, not the standard 9.80665), this table has the sheet's figure.

The GM here is the sheet's, to the digits it prints; the mass and escape speed of `/stops` use JPL's GM to more digits for the same bodies.

## Not here

The dwarf planets and the moons other than ours have no fact sheet at NASA, so they have no entry: `bodyPhysics` throws for them. Their masses are in other sources that this package does not read yet.
