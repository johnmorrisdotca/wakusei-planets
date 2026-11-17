---
title: Fact sheets and definitions
section: how-to
order: 15
description: A fact sheet for the Sun, the planets and Pluto, and the definitions of the words a sky page uses, as plain data in English and Japanese.
---

`/fact-sheets` is what a page about a planet usually says, as data you can print, search or put in a card: size, distance from the Sun, the length of the year and of the day, the number of known moons, NASA's own page, and a short description in English and Japanese. It also holds the definitions of planet, dwarf planet, moon, asteroid, comet, meteoroid, meteor and meteorite. It has no browser code, so it runs on a server.

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

## Definitions

```ts
import { DEFINITION_IDS, definition } from "@johnmorrisdotca/wakusei-planets/fact-sheets";

for (const id of DEFINITION_IDS) console.log(definition(id).term.en);
const meteor = definition("meteor");
console.log(meteor.en);
console.log(meteor.source);
```

Each definition is in our own words, in English and Japanese, with its `source`: the IAU's 2006 resolution for planet and dwarf planet, the IAU's meteor definitions for meteoroid, meteor and meteorite, and the usage of NASA and JPL where nobody has made a formal definition (moon, asteroid and comet; the IAU's own word is "small solar system body"). The size limits for a meteoroid are to be re-checked against the IAU text.

## Where the facts come from

Radius and rotation are the IAU working group's values and the distance is JPL's approximate elements (both are in the package already, see `NOTICE.md`); the year is from NASA's planetary fact sheets; the moon count is JPL's planetary satellite page; the links go to NASA's pages and copy nothing from them. The descriptions and definitions are written here: no text of NASA's, the IAU's, an encyclopedia's or of another package is copied.

## Coming from npm-solar-system

If you used npm-solar-system's `getMars()` and its relatives, this has the same facts and more. It is ES modules only; `require()` of an ES module works on Node 22.12 and later, so `const { factSheet } = require("@johnmorrisdotca/wakusei-planets/fact-sheets")` works too. Not here yet: a list of meteor showers and a demo page.
