---
title: Fact sheets
section: how-to
order: 15
description: A fact sheet for the Sun, the planets and Pluto, as plain data in English and Japanese.
---

`/fact-sheets` is what a page about a planet usually says, as data you can print, search or put in a card: size, distance from the Sun, the length of the year and of the day, the number of known moons, NASA's own page, and a short description in English and Japanese. It has no browser code, so it runs on a server.

```ts
import { factSheet } from "@johnmorrisdotca/wakusei-planets/fact-sheets";

const mars = factSheet("mars");
console.log(mars.name.en, mars.name.ja);
console.log(Math.round(mars.radius.km), Math.round(mars.distanceFromSun.miles / 1e6), mars.yearDays, mars.rotationHours.toFixed(1));
console.log(mars.knownMoons, mars.moonsReadOn, mars.nasaPage);
console.log(mars.description.en);
```

`factSheet` takes `"sun"`, `"mercury"` to `"neptune"` or `"pluto"` and gives a new object each call; any other id throws a `RangeError` that names it. The fields:

| Field | Meaning |
|---|---|
| `radius` | the equatorial radius, in `km` and `miles` |
| `distanceFromSun` | the mean distance, in `au`, `km` and `miles` (zero for the Sun) |
| `yearDays` | the sidereal year in Earth days (`null` for the Sun) |
| `rotationHours`, `retrograde` | the time to turn once against the stars, and whether it turns backwards (Venus, Uranus, Pluto). This is not the length of a solar day |
| `knownMoons`, `moonsReadOn` | the number of known moons and the date it was read: the count grows as moons are found. It is the count of `/moon-catalogue` |
| `nasaPage` | NASA's own page about the body |
| `description` | a short description in our own words, `en` and `ja` |

## Orbits of the dwarf planets and the minor bodies

`minorFact(id)` (the ids are `MINOR_FACT_IDS`) is the ellipse a card can print for a dwarf planet besides Pluto, or for a minor body the package draws: Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna, Bennu, Eros, Vesta, Pallas, Chiron, Pholus, Halley and Arrokoth. `aAu` is the semi-major axis and `perihelionAu` the closest the ellipse comes to the Sun, both in astronomical units. `periodDays` is the sidereal period. These are the osculating elements the package already stores (`NOTICE.md`), not a new fit. Pluto stays on `factSheet`: its year is there, and its place is the fitted table, not one ellipse. Who found the body, and when, is `discoveryOf` in `/discovery`.

```ts
import { minorFact } from "@johnmorrisdotca/wakusei-planets/fact-sheets";
import { discoveryOf } from "@johnmorrisdotca/wakusei-planets/discovery";

const vesta = minorFact("vesta");
console.log(vesta.name.en, vesta.aAu, vesta.periodDays);
console.log(discoveryOf("vesta")!.date?.value, discoveryOf("vesta")!.by?.value.join(", "));
```

## Where the facts come from

Radius and rotation are the IAU working group's values and the distance is JPL's approximate elements (both are in the package already, see `NOTICE.md`); the year is from NASA's planetary fact sheets; the moon count is JPL's planetary satellite page; the links go to NASA's pages and copy nothing from them. The descriptions are written here: no text of NASA's, the IAU's, an encyclopedia's or of another package is copied.

## Coming from npm-solar-system

If you used npm-solar-system's `getMars()` and its relatives, this has the same facts and more. It is ES modules only; `require()` of an ES module works on Node 22.12 and later, so `const { factSheet } = require("@johnmorrisdotca/wakusei-planets/fact-sheets")` works too. Not here yet: a list of meteor showers and a demo page.
