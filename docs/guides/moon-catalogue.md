---
title: Every known moon
section: how-to
order: 20
description: "Every known moon of the planets and the dwarf planets, 468 as JPL lists them on 2026-11-18: names and designations, who found each and when, the mean orbit, the size where it is known, and where each is on a date, with how far that place was measured to be off. A 35 kB table that only /moon-catalogue carries."
---

[日本語](ja/moon-catalogue.md)

The package draws 29 moons in full: each has a look, a size, a spin and its own orbit, fitted to JPL Horizons or worked out from a published theory. `/moon-catalogue` lists every known moon besides, 468 of them as JPL lists them on 2026-11-18: the name (or the provisional designation of a moon not yet named), the planet, the year it was found and who found it, the mean orbit, the size where it has been measured or can be worked out, and the group it belongs to. It also says where each moon is on any date, from its mean orbit, with the error that place was measured to have. It runs anywhere, with no DOM and no three.js, needs no loading step, and the rows (about 35 kB gzipped) are part of this entry point only: a page that does not import `/moon-catalogue` does not carry them.

```ts
import { catalogueMoonPosition, catalogueMoonsOf, findCatalogueMoon, moonCounts, MOON_CATALOGUE_FETCHED } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";

const saturn = moonCounts().saturn!;
console.log(`Saturn has ${saturn.total} known moons, ${saturn.named} with a name (as of ${MOON_CATALOGUE_FETCHED})`);
const himalia = findCatalogueMoon("Himalia")!;
console.log(himalia.label, "found", himalia.discovery.year, "by", himalia.discovery.by, "in the", himalia.group, "group");
const [x, y, z] = catalogueMoonPosition(himalia, new Date("2026-11-11T00:00:00Z"))!;
console.log("about", Math.round(Math.hypot(x, y, z) / 1e6), "million km from Jupiter; placed", himalia.grade, `(worst ${himalia.accuracy!.worstDegrees.toFixed(1)} degrees off)`);
console.log(catalogueMoonsOf("jupiter", "carme").length, "moons in Jupiter's Carme group");
```

## How many

| Planet or dwarf planet | Moons | Named | Placed |
|---|---|---|---|
| Earth | 1 | 1 | 1 |
| Mars | 2 | 2 | 2 |
| Jupiter | 115 | 57 | 115 |
| Saturn | 293 | 63 | 292 |
| Uranus | 29 | 27 | 29 |
| Neptune | 16 | 14 | 16 |
| Pluto | 5 | 5 | 5 |
| Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris | 1, 2, 1, 1, 1, 1 | 6 | 0 |
| **All** | **468** | **175** | **460** |

`moonCounts()` gives these numbers, and `MOON_CATALOGUE_FETCHED` the day they were read. Ceres and Sedna have no known moon.

A moon is "placed" when it has a mean orbit. Eight are not: S/2009 S 1, a moonlet in Saturn's rings that JPL lists with no orbit, and the seven moons of the dwarf planets besides Pluto, which JPL's Small-Body Satellites service lists with no orbit. Four of those seven (Vanth, Hiʻiaka, Namaka and Dysnomia) are among the package's own moons, and the main entry point places them from the papers [NOTICE.md](../../NOTICE.md) names. One more, Daphnis, has an orbit but no Horizons position near 2026 to measure it against, so it is `unmeasured`.

## What each moon has

| Field | What it is |
|---|---|
| `id`, `label`, `name`, `designation`, `number` | the id ("himalia", "s-2003-j-18"), what to print (the name, else the designation), the IAU name, the provisional designation and the IAU number in Roman numerals |
| `ja` | the Japanese name in katakana: the 29 moons the package draws in full, and 129 more from `scripts/moon-catalogue-ja.json`, each taken from a published Japanese list that is written down beside it (the National Museum of Nature and Science's moon table, which is mainly from the Rika Nenpyo, and the Japanese Wikipedia); `null` for the 17 named moons that no Japanese list gives katakana for yet and for every designation, which a Japanese page shows by their English name or designation |
| `host`, `code` | the planet or dwarf planet, and the JPL (NAIF) id Horizons knows the moon by (501 for Io) |
| `discovery` | `year`, `by` (the discoverers or the spacecraft team, as JPL writes them) and `reference` (where it was announced: an IAU Circular, a Minor Planet Electronic Circular, a CBET, or "IAU WGPSN" for the long-named moons) |
| `orbit` | the mean orbit: `a`, `e`, `w`, `m`, `i`, `node`, `periodDays` (as fitted to Horizons), how many years the periapsis and the node take to turn (`apsisYears`, `nodeYears`), the plane it is measured from (`frame`, with its `pole`), the epoch (2026-01-01) and the JPL ephemeris it was taken from |
| `retrograde`, `group` | whether it goes round against its planet's turn, and its dynamical group (below) |
| `radiusKm`, `radiusSigmaKm`, `radiusFrom`, `albedo`, `magnitude`, `magnitudeFrom` | the size and where it comes from (below), the albedo where JPL gives it, the magnitude (V(1,0) from JPL's sheet, or an absolute magnitude from Wikipedia's tables) and which it is: `sheet` or `wikipedia` |
| `accuracy`, `grade` | how far `catalogueMoonPosition` was from JPL Horizons, and its grade (below) |
| `full` | `true` for the 29 moons the package draws in full: the main entry point's `moonVector` and `system` place those far better |

A number the sources do not give is `null`, never guessed.

## Groups

A moon's `group` is this package's own sorting of the mean orbits, by the rule below; the names are the usual ones, each after the group's largest member. A moon is irregular when JPL gives its mean orbit about the ecliptic (the Sun's pull steers it more than its planet's bulge; the Moon is the one exception) or when it is over 100 planet radii out; the others are regular.

| Group | Rule | Moons |
|---|---|---|
| `major` | regular, 150 km of radius or more | 20 |
| `inner` | regular, smaller, inside its planet's innermost major moon | 33 |
| `regular` | the other regular moons (Phobos, Deimos, Hyperion, Saturn's small moons that share an orbit, Pluto's small moons) | 14 |
| `themisto` | Jupiter, prograde, under 9 million km | 1 |
| `himalia` | Jupiter, prograde, 10 to 13 million km, under 35 degrees | 11 |
| `carpo` | Jupiter, prograde, 45 degrees or more | 2 |
| `valetudo` | Jupiter, the other prograde one | 1 |
| `ananke` | Jupiter, retrograde, under 160 degrees, under 22 million km | 29 |
| `carme` | Jupiter, retrograde, 160 degrees or more | 41 |
| `pasiphae` | Jupiter, retrograde, under 160 degrees, 22 million km or more | 22 |
| `inuit` | Saturn, prograde, 42 degrees or more | 39 |
| `gallic` | Saturn, prograde, under 42 degrees | 19 |
| `norse` | Saturn, retrograde | 210 |
| `prograde` | Uranus and Neptune, prograde | 5 |
| `retrograde` | Uranus and Neptune, retrograde | 13 |
| `none` | no mean orbit | 8 |

The distances are the semi-major axis and the degrees the inclination to the ecliptic. The lines between the groups are where the moons' orbits fall apart into clusters in this table; a moon near a line could be put on either side.

## By family

`moonFamilies(host)` lists a planet's moons the way a list of them is read: by family, nearest family first, and in each family by distance from the planet. A family is `group` regrouped by planet, a sorting for lists and not a second rule: every moon of a planet is in exactly one.

| Planet | Families, and how many moons each holds |
|---|---|
| Jupiter | `galilean` 4, `inner` 4 (Amalthea, Thebe, Metis, Adrastea), `himalia` 11, `ananke` 29, `carme` 41, `pasiphae` 22, `other` 4 (the irregular moons that belong to none of the four groups: Themisto, Carpo, Valetudo and S/2018 J 4) |
| Saturn | `inner` 25 (its major and inner moons), `inuit` 39, `gallic` 19, `norse` 210 |
| Uranus, Neptune | `inner` (19 and 8) and `irregular` (10 and 8) |
| Earth, Mars, Pluto and the dwarf planets | one family, `moons` |

Each family has its `names` in English and Japanese, its `count`, how many have a `named` name, how many have a size (`sized`) and how many of those sizes are estimates (`estimated`), the `largestKm` and `smallestKm` radii with `largestIsEstimate` and `smallestIsEstimate`, its `direction` (`prograde`, `retrograde`, `mixed` or `null` for a host with no moon placed), the `color` its orbits are drawn in by group and its `moons`, each with its `radiusKm` and an `estimate` flag. A size is an estimate when `radiusFrom` is `derived` (see Sizes): the family's own `estimated` count is the number of those. A moon without a size has `radiusKm: null`, never a guess.

```ts
import { moonFamilies, moonOrbitKey } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";

for (const family of moonFamilies("jupiter")) {
  console.log(family.names.en, family.count, "moons,", family.estimated, "of their sizes estimated");
}
// which way the colours of the orbits go: the key is data, with the number of moons each colour holds
console.log(moonOrbitKey("direction").map((entry) => `${entry.names.en}: ${entry.count}`));
```

`moonOrbitKey("group")` and `moonOrbitKey("direction")` are the key to the orbit colours the space view draws (`moon-colors`): an entry each of `id`, `names` (English and Japanese), `color` and `count`. Pass the planets showing their moons (`moonOrbitKey("group", ["saturn"])`) to count only theirs. `moonOrbitColor(moon, by)` is the colour of one moon's orbit and `catalogueMoonOrbit(moon, when)` is the orbit itself, a closed line of points round the planet in kilometres, in the same axes as `catalogueMoonPosition`.

## Where each moon is, and how far to trust it

`catalogueMoonPosition(moon, when)` gives x, y, z in kilometres from the planet's centre, in the J2000 ecliptic frame (the axes of `moonVector`), from the moon's mean orbit. The orbit's shape, its plane and how fast its periapsis and node turn are JPL's "Planetary Satellite Mean Elements". Where the moon is along the orbit, and how fast it goes round, are set from JPL Horizons: its place on 2026-01-01 sets the first, and its places 1, 31 and 90 days later the second. Taken as printed, JPL's mean elements put the moons of Saturn, Uranus, Neptune and Pluto tens of degrees from Horizons even at their own epoch (the package found the same for its own 29 moons, and fitted those to Horizons). A mean orbit leaves out the Sun's month-to-month pull and the moons' pulls on each other, so the place drifts from the real one. Every moon was measured against Horizons on three dates the orbit was not set from (2025-07-02, 2026-07-02 and 2027-07-02), and `accuracy` holds the worst distance and the worst angle seen from the planet:

| `grade` | Worst angle near 2026 | Moons | Regular | Irregular |
|---|---|---|---|---|
| `close` | under 1 degree | 37 | 36 | 1 |
| `rough` | under 10 degrees | 140 | 17 | 123 |
| `loose` | 10 degrees or more: on its orbit, not at its place on it | 282 | 13 | 269 |
| `unmeasured` | no Horizons position to measure against | 1 | 1 | 0 |
| `none` | no orbit | 8 | | |

The regular moons do well: the median worst angle is 0.5 degrees for the major moons and 0.6 for the inner ones. The irregular moons do not: the Sun's pull swings each one along its orbit by tens of degrees within months, which a mean orbit cannot follow. The median worst angle is 10 degrees for Saturn's Norse group, 12 for Jupiter's Himalia group, 25 to 27 for Saturn's Inuit and Gallic groups, 35 for Jupiter's Ananke group and over 50 for its Carme and Pasiphae groups.

Every grade is below the 29 moons the package draws in full: from the main entry point those are within arc-seconds to a few arc-minutes (see [How exact it is](accuracy.md)). Decades away (1990, 2000 and 2040) the drift is much larger (`accuracy.farDegrees`). Use the catalogue's place to show where a small moon is round its planet, not to point a telescope at it.

## Near 2026-12-01 the irregular moons follow Horizons

For the irregular moons of the giant planets there is a much better place near the present. Each has its JPL Horizons osculating orbit (the two-body orbit that fits its place and speed on one day) for 2026-12-01, as `osculating` (`MOON_OSCULATING_EPOCH_JD`, 2461375.5), and `catalogueMoonPosition` uses it within `MOON_OSCULATING_DAYS` (150 days) of that day and the mean orbit outside. It was measured against Horizons for all 393 moons on 16 dates the orbit was not set from, from 15 to 210 days either side. Within 150 days, over every moon at every one of those dates, the median is 0.06 degrees, 95 places in 100 are within 0.9 degrees, and the worst, a few of Jupiter's moons at the edge of the window, is 7 degrees; the worst of Saturn's is 1.1 degrees and of Uranus's and Neptune's 0.1. A mean orbit is tens of degrees off. `accuracy` and `grade` still describe the mean orbit, measured on dates outside the window.

The numbers are in `src/data/moon-osculating.ts`, as whole numbers (about 7 kB gzipped, which is what the `/moon-catalogue` chunk grew by), made by `scripts/make-moon-osculating.py`: one Horizons request a moon, with the epoch and the held-out dates together, cached outside the repository. A refresh is a run of it with a new `--epoch`.

## Sizes

`radiusFrom` says where a radius comes from: `measured` for the 46 moons JPL's "Planetary Satellite Physical Parameters" lists (with the uncertainty in `radiusSigmaKm`), `sheet` for 19 more whose Horizons data sheet gives a radius, and `derived` for 382: 26 whose sheet gives only a V(1,0) magnitude, and 356 irregular moons that have no size anywhere else, whose magnitude is the absolute magnitude in English Wikipedia's tables of the moons of Jupiter, Saturn, Uranus and Neptune (`magnitudeFrom` says `sheet` or `wikipedia`; for `wikipedia`, the page is `MOON_MAGNITUDE_PAGES[host]` and the day it was read is `MOON_MAGNITUDES_READ`, 2026-11-18). Those tables take the irregular moons' magnitudes from the Minor Planet Center's Natural Satellites Ephemeris Service. Only that one number is used, never the tables' diameters or any other column; the numbers are kept in `scripts/moon-catalogue-magnitudes.json`, made by `scripts/make-moon-magnitudes.py` (one request for each of the four pages), and the build script reads them so `--refresh` keeps them. The Center's own discovery circulars were the first choice, but its robots.txt does not allow a program to read them. A derived radius is half of D = 10^(3.1236 − 0.5 log10(albedo) − 0.2 V), the formula of NASA/JPL's asteroid size estimator, with the sheet's albedo where it gives one and `ASSUMED_ALBEDO` (0.04, the sheet's albedo for Himalia) where it does not; none of the 382 has an albedo on its sheet, so every one is an estimate from an assumed darkness. Checked against the diameters in the tables (Saturn's table says it assumes 0.04 too; Jupiter's takes these faint moons' diameters from Sheppard's own page), ours differ by more than a factor of 2 for 28 faint moons of Jupiter, about 2.2 to 2.8 times larger here, so for the smallest moons it is an estimate to within a factor of a few. At H about 17 the tables' 1 km would need an albedo near 0.3, where ours assumes 0.04, the usual darkness of such moons; the tables do not say how they got 1 km. The other 21 moons have no size: the seven moons of the dwarf planets other than Pluto (no sheet or table gives a size or a magnitude), 13 regular or inner moons whose magnitudes in the tables are worked out from their diameters (using them would be going in a circle), and Philophrosyne, which the table has no row for.

## In the space view

`moons` on `<wakusei-space>` says which planets draw every catalogue moon: `major`, today's default, draws the moons the view draws in full and nothing else; `all` draws every other moon of the planet as a small pressable dot with its orbit. It is set for one planet or for all of them, and a planet's own choice beats the default:

```html
<wakusei-space moons="major" moons-of="jupiter=all saturn=all" moon-colors="direction"></wakusei-space>
```

```ts no-run
import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";

const space = document.querySelector<WakuseiSpace>("wakusei-space")!;
space.moons = "all";                 // every planet at once (the default for planets with no choice of their own)
space.setMoons("all", "saturn");     // Saturn alone
space.setMoons("major");             // every planet at once, and every planet's own choice is cleared
space.moonsFor("saturn");            // "all"
space.moonHosts;                     // the planets showing every moon now, in the view's order
space.moonColors = "direction";      // the orbits' colours: "group" (the default) or "direction"
```

A dot is where `catalogueMoonPosition` puts the moon, nearer in the compressed scale by the same mapping as the drawn moons, and its orbit is a closed line coloured by the moon's family (`moon-colors="group"`, each family's `color`) or by its direction (`direction`: blue goes with the planet's turn, red against it). `moonOrbitKey(by, hosts)` is the key to those colours as data, so a page draws its own legend from it. The dots are one draw and the orbits one more, built once for a scale, a colouring and a month and only moved with their planet after that; nothing is drawn at rest, and a draw at the same scale builds nothing again. The catalogue is a chunk of its own, fetched the first time a planet is set to `all`, so a view that never does never loads it. `stats.allMoons` says whether any planet is set to `all`, whether the catalogue has loaded, how many dots and orbits the last draw drew, and which planets show them. A page that hands the element its own subset of three.js (`setThreeLoader`) must include `Points`, `PointsMaterial`, `LineSegments` and `LineBasicMaterial`.

A dot answers a press within 9 CSS pixels, after every body with a name: the first press selects the moon and fires `wakusei-body-select`, `wakusei-body-click` and `wakusei-moon-click` with `{ id, name, kind: "catalogue-moon", host }`; a second press on the same moon makes its planet the middle of the view. Hovering one fires `wakusei-body-hover` with the same detail. `all-moons` and `space.allMoons` still work, as `moons="all"` for every planet. The demo's space page has a switch and a panel that lists the families of the planet in view, each with its count and sizes (an estimated size is marked) and the colour key; a moon measured more than 10 degrees off is marked "rough place".

The dots show each moon's orbit and roughly where on it the moon is. Regular moons are within about half a degree; many small outer moons can be tens of degrees off within a year (see how many above), so a dot is not an exact position.

## Kept current

New moons are announced every year, and orbits are refined. `python3 -I scripts/make-moon-catalogue.py --cache DIR --refresh` reads JPL's pages again (the Horizons answers of the moons it already has stay cached, so only a new moon costs a request) and, before it writes, prints what changed against the table in the repository: a new moon, one gone, a designation that has been given a name, a changed orbit, size, discovery or group. `--dry` prints the changes and writes nothing. Then the counts pinned in `test/moon-catalogue.test.ts` and the numbers in this guide are brought up to date with it. It asks one thing at a time, with a pause, as JPL's terms ask, and nothing calls JPL at run time.

## Where the numbers come from

Everything is NASA/JPL's (Solar System Dynamics; a US government work, credit NASA/JPL-Caltech), read on 2026-11-18 by `scripts/make-moon-catalogue.py`: the mean orbits from "Planetary Satellite Mean Elements" (each moon's place along it and its rate from Horizons), the names, designations, years, discoverers and announcements from "Planetary Satellite Discovery Circumstances", the measured radii from "Planetary Satellite Physical Parameters", the moons of the dwarf planets besides Pluto from the Small-Body Satellites API, and each moon's data sheet and the positions it was measured against from JPL Horizons. [NOTICE.md](../../NOTICE.md) has the links and the terms.
