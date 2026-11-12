---
title: Every known moon
section: how-to
order: 20
description: "Every known moon of the planets and the dwarf planets, 468 as JPL lists them on 2026-11-11: names and designations, who found each and when, the mean orbit, the size where it is known, and where each is on a date, with how far that place was measured to be off. A 35 kB table that only /moon-catalogue carries."
---

[日本語](ja/moon-catalogue.md)

The package draws 29 moons in full: each has a look, a size, a spin and its own orbit, fitted to JPL Horizons or worked out from a published theory. `/moon-catalogue` lists every known moon besides, 468 of them as JPL lists them on 2026-11-11: the name (or the provisional designation of a moon not yet named), the planet, the year it was found and who found it, the mean orbit, the size where it has been measured or can be worked out, and the group it belongs to. It also says where each moon is on any date, from its mean orbit, with the error that place was measured to have. It runs anywhere, with no DOM and no three.js, needs no loading step, and the rows (about 35 kB gzipped) are part of this entry point only: a page that does not import `/moon-catalogue` does not carry them.

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
| `ja` | the Japanese name, only for the 29 moons the package draws in full (their katakana has been checked); `null` for the others, which a Japanese page shows by their English name or designation |
| `host`, `code` | the planet or dwarf planet, and the JPL (NAIF) id Horizons knows the moon by (501 for Io) |
| `discovery` | `year`, `by` (the discoverers or the spacecraft team, as JPL writes them) and `reference` (where it was announced: an IAU Circular, a Minor Planet Electronic Circular, a CBET, or "IAU WGPSN" for the long-named moons) |
| `orbit` | the mean orbit: `a`, `e`, `w`, `m`, `i`, `node`, `periodDays` (as fitted to Horizons), how many years the periapsis and the node take to turn (`apsisYears`, `nodeYears`), the plane it is measured from (`frame`, with its `pole`), the epoch (2026-01-01) and the JPL ephemeris it was taken from |
| `retrograde`, `group` | whether it goes round against its planet's turn, and its dynamical group (below) |
| `radiusKm`, `radiusSigmaKm`, `radiusFrom`, `albedo`, `magnitude` | the size and where it comes from (below), the albedo and the V(1,0) magnitude where JPL gives them |
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

## Sizes

`radiusFrom` says where a radius comes from: `measured` for the 46 moons JPL's "Planetary Satellite Physical Parameters" lists (with the uncertainty in `radiusSigmaKm`), `sheet` for 19 more whose Horizons data sheet gives a radius, and `derived` for 26 whose sheet gives only a V(1,0) magnitude. A derived radius is half of D = 10^(3.1236 − 0.5 log10(albedo) − 0.2 V), the formula of NASA/JPL's asteroid size estimator, with the sheet's albedo where it gives one and `ASSUMED_ALBEDO` (0.04, the sheet's albedo for Himalia) where it does not; none of the 26 has an albedo on its sheet, so every one is an estimate from an assumed darkness. The other 377 moons, most of them found since 2000, have no size here: their sheets give no radius and no magnitude.

## In the space view

`<wakusei-space all-moons>` (or `space.allMoons = true`) draws every catalogue moon the view does not draw in full as a small dot round its planet, all in one draw, at its mean-orbit place, nearer in the compressed scale by the same mapping as the drawn moons. The catalogue is fetched as a chunk of its own the first time the dots are turned on, so a view that never turns them on never loads it. The dots draw only when the view draws; nothing is drawn at rest. `stats.allMoons` says whether they are on, whether the catalogue has loaded and how many dots the last draw drew. A page that hands the element its own subset of three.js (`setThreeLoader`) must include `Points` and `PointsMaterial` for them. The demo's space page has an "All moons" switch that turns them on and lists the moons of the planet in view, with their groups; a moon measured more than 10 degrees off is marked "rough place" in the list.

The dots show each moon's orbit and roughly where on it the moon is. Regular moons are within about half a degree; many small outer moons can be tens of degrees off within a year (282 of the 468 are more than 10 degrees off), so a dot is not an exact position.

## Kept current

New moons are announced every year, and orbits are refined. `python3 -I scripts/make-moon-catalogue.py --cache DIR --refresh` reads JPL's pages again (the Horizons answers of the moons it already has stay cached, so only a new moon costs a request) and, before it writes, prints what changed against the table in the repository: a new moon, one gone, a designation that has been given a name, a changed orbit, size, discovery or group. `--dry` prints the changes and writes nothing. Then the counts pinned in `test/moon-catalogue.test.ts` and the numbers in this guide are brought up to date with it. It asks one thing at a time, with a pause, as JPL's terms ask, and nothing calls JPL at run time.

## Where the numbers come from

Everything is NASA/JPL's (Solar System Dynamics; a US government work, credit NASA/JPL-Caltech), read on 2026-11-11 by `scripts/make-moon-catalogue.py`: the mean orbits from "Planetary Satellite Mean Elements" (each moon's place along it and its rate from Horizons), the names, designations, years, discoverers and announcements from "Planetary Satellite Discovery Circumstances", the measured radii from "Planetary Satellite Physical Parameters", the moons of the dwarf planets besides Pluto from the Small-Body Satellites API, and each moon's data sheet and the positions it was measured against from JPL Horizons. [NOTICE.md](../../NOTICE.md) has the links and the terms.
