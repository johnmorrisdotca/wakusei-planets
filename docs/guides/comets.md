---
title: Comets
section: how-to
order: 19
description: "Thirty-four well-known comets, with orbits from JPL's Small-Body Database: where each is on a date, how far from the Sun and the Earth, the line of its orbit, its last and next perihelion, the meteor showers it feeds, and a door to add a newly found comet without a release."
---

`/comets` holds a set of 34 well-known comets and answers where each is on a date. Each has its orbit from the NASA/JPL Small-Body Database, its names in English and Japanese, its kind, and, for the few that feed one, its meteor shower. It runs anywhere, with no DOM and no three.js and no loading step, and the table (about 6 kB gzipped) is part of this entry point only: a page that does not import `/comets` does not carry it.

```ts
import { cometDistance, cometPerihelia, cometPosition, findComet } from "@johnmorrisdotca/wakusei-planets/comets";

const comet = findComet("hale-bopp")!;
const perihelion = new Date(Date.UTC(1997, 2, 29, 12));
const d = cometDistance(comet, perihelion);
console.log(comet.name.en, comet.name.ja, "was", d.sunAu.toFixed(2), "au from the Sun and", d.earthAu.toFixed(2), "au from the Earth");
console.log("x, y, z in au:", cometPosition(comet, perihelion).map((v) => v.toFixed(3)).join(", "));
console.log("1P Halley, last and next perihelion:", cometPerihelia("1P", Date.UTC(2026, 10, 11)));
```

## The set

| Kind | Count | Comets |
|---|---|---|
| `periodic` (a closed orbit under 200 years that has come back) | 20 | 1P Halley, 2P Encke, 7P Pons-Winnecke, 8P Tuttle, 9P Tempel 1, 12P Pons-Brooks, 13P Olbers, 17P Holmes, 19P Borrelly, 21P Giacobini-Zinner, 29P Schwassmann-Wachmann 1, 45P Honda-Mrkos-Pajdusakova, 46P Wirtanen, 55P Tempel-Tuttle, 67P Churyumov-Gerasimenko, 73P Schwassmann-Wachmann 3, 81P Wild 2, 96P Machholz 1, 103P Hartley 2, 109P Swift-Tuttle |
| `long-period` (a closed orbit of 200 years or more, or an open one that has not been shown to be interstellar) | 11 | C/1995 O1 Hale-Bopp, C/1996 B2 Hyakutake, C/2020 F3 NEOWISE, C/2006 P1 McNaught, C/2011 W3 Lovejoy, C/2012 S1 ISON, C/2022 E3 ZTF, C/2023 A3 Tsuchinshan-ATLAS, C/1973 E1 Kohoutek, C/1975 V1 West, C/2021 A1 Leonard |
| `interstellar` (an open orbit with eccentricity well over 1) | 3 | 1I 'Oumuamua, 2I Borisov, 3I ATLAS |

`listComets()` gives all of them in that order and `listComets("periodic")` one kind. `findComet(key)` takes an id (`halley`), a designation (`1P`, `C/1995 O1`) or the English name, in any case. A record holds the `name` in `en` and `ja`, the `kind`, the elements, the orbit's quality (`condition`, the database's code from 0, best, to 9, where it gives one), the number of observations and the days they span, the nucleus's diameter where one is known, and `showers`.

The comet `halley` has the id the space view uses for Halley's comet. The two are the same comet at two levels of care. `heliocentric("halley", ...)` and the space view use a table fitted to Horizons over 1800 to 2200, which includes the planets' pull; `/comets` runs the plain two-body orbit of the Small-Body Database's solution, which is exact at its epoch (1968-01-20) and drifts from it. Within a year of the epoch the two agree to 1e-5 au; for Halley at a date that matters, `heliocentric` is the better position and `/comets` is the one with the orbit's elements, the line and the showers.

## Where a comet is

```ts
import { cometDistance, cometOrbit, cometPosition, cometTrust } from "@johnmorrisdotca/wakusei-planets/comets";

const day = new Date(Date.UTC(2020, 6, 3));
const [x, y, z] = cometPosition("neowise", day);
console.log("NEOWISE at perihelion:", x.toFixed(3), y.toFixed(3), z.toFixed(3), "au; from the Sun", cometDistance("neowise", day).sunAu.toFixed(3), "au");
console.log(cometTrust("neowise", day));
const line = cometOrbit("halley", 200);
console.log(line.length / 3, "points to draw Halley's orbit through, closed");
```

`cometPosition(comet, when)` is x, y, z from the Sun in astronomical units in the J2000 ecliptic frame, the axes of `heliocentric`, so a comet and a planet can be drawn in one scene. `comet` is a record or any key `findComet` takes. The motion is two-body: Kepler's problem solved in universal variables, so a closed orbit, a near-parabolic one (e = 0.99999 or 1.00001), a parabola and an open one with an eccentricity over 3 all use the same code. `cometDistance` gives `sunAu` and `earthAu`, the Earth being the package's own `heliocentric("earth", ...)`, and no light time is allowed for.

`cometOrbit(comet, points, maxAu)` gives `3 * points` numbers (x, y, z, in au, as a `Float32Array`) to draw a line through. A closed orbit whose far end is within `maxAu` (40 by default, past Neptune) is the whole ellipse with its first point repeated at the end so the line closes; any other orbit is an arc through perihelion from `maxAu` in to `maxAu` out. The points are closer near the Sun, where the line bends. Drawing a tail, or the comet itself, is not part of `/comets`.

## How far to trust it

`COMET_ACCURACY` says it in words and `cometTrust(comet, when)` says how far a moment is from the comet's epoch and whether it is inside the year around it. The elements are one osculating orbit, exact at its epoch. The planets pull on a comet and its jets push on it, so the real orbit drifts away from the ellipse. A long-period comet's position is good only near its epoch. Against JPL Horizons, with the same solution asked for, at seven dates within a year of each epoch for twelve comets (`test/data/comets-horizons.json`):

| What | Worst miss |
|---|---|
| Eight closed orbits and the open ones of 2I Borisov and McNaught, within a year of the epoch | under 2.5e-3 au (Borrelly, 300 days before its epoch, at 4.8 au) |
| 1I 'Oumuamua, the same | 5.2e-3 au (2.0 per mille of its distance), whose small push of its own is not in the calculation |
| C/2012 S1 ISON, the same | 1.3e-2 au: it passed 0.012 au from the Sun inside the year |
| 1P Halley's perihelion of 1986, 18 years from the epoch | 0.035 au, 6 per cent of its distance (the orbit's own perihelion is on 1986-02-08, a day early) |
| C/1995 O1 Hale-Bopp's perihelion of 1997, 25 years from the epoch | 0.065 au, 7 per cent (the orbit's perihelion is on 1997-03-29, the real one 1997-04-01) |

At the epoch itself the miss is under 1e-10 au, so the time scales and the maths are right; the rest is the planets and the jets. For a close look at one date, ask Horizons.

## Last and next perihelion

`cometPerihelia(comet, when)` returns `last` and `next` (milliseconds since 1970, UTC), a `basis` and `lastObserved`. For a periodic comet of the set the dates are JPL's, stored in the record (`perihelion`): the osculating elements of JPL Horizons' latest apparition record of the comet, asked at the passage nearest 2026-11-11, give the last perihelion and the next one, the latter from integrating the orbit with the planets' pull, so the prediction is not a repetition of one period. `basis` is `"jpl"`, and `lastObserved` is what JPL's orbit solution records, not whether anyone saw the comet: true when the solution's last observation is within 150 days of the last passage. 1P Halley: last 1986-02-09, next 2061-07-28. 2P Encke: 2023-10-22 and 2027-02-10. 67P: 2021-11-02 and 2028-04-09. 109P Swift-Tuttle: 1992-12-12 and 2126-07-12 (Horizons record 90000030, 90000091, 90000703 and 90000985). Two solutions are older than the latest passage: 21P (2025) and 46P (2024) were seen at those passages, but the solution in the record predates them, so `lastObserved` is `false` and the last perihelion is JPL's prediction from it, a few days off the real one (21P's was 2025-03-29, JPL's date is 2025-03-25). Before the last date or after the next, the dates are repeated from the osculating period and `basis` is `"estimated"`: good to months for a short orbit, to a year or more for a long one. A comet of the set on a parabola or an open orbit, or on an ellipse with a period over 10,000 years (Hyakutake's is about 70,000), has one perihelion, JPL's (`"jpl"`), which is `last` when it is behind and `next` when it is ahead, and the other is `null` (repeating a period of 70,000 years would give a date in the year 99940); a comet from `cometFromElements` has the date it was given (`"elements"`).

## The meteor showers

Where a comet's link to a shower is well established the record names it, with the IAU's code: 1P Halley the Eta Aquariids (`ETA`) and the Orionids (`ORI`), 2P Encke the Taurids (`TAU`), 8P Tuttle the Ursids (`URS`), 21P Giacobini-Zinner the Draconids (`DRA`), 55P Tempel-Tuttle the Leonids (`LEO`) and 109P Swift-Tuttle the Perseids (`PER`). Every other comet has `showers: []`: the link is left out rather than guessed.

## Adding a comet without a release

```ts
import { cometDistance, cometFromElements, cometOrbit } from "@johnmorrisdotca/wakusei-planets/comets";

const comet = cometFromElements({
  designation: "C/2099 A1", name: { en: "Example", ja: "例彗星" },
  e: 0.9998, q: 0.6, i: 133.2, node: 241.5, w: 98.1, perihelion: Date.UTC(2099, 5, 1, 6),
});
console.log(comet.kind, comet.periodYears?.toFixed(0), "years;", cometDistance(comet, Date.UTC(2099, 8, 1)).sunAu.toFixed(2), "au from the Sun");
console.log(cometOrbit(comet, 50).length / 3, "points");
```

`cometFromElements` takes the elements as the Minor Planet Center and JPL publish them: `e`, `q` in au, `i`, `node` and `w` in degrees, and the time of perihelion either as `tp` (a Julian date in TDB, as JPL gives it) or as `perihelion` (a `Date` or milliseconds). It checks them, folds the angles into 0 to 360 and returns a record that every function takes in place of an id. The set is not changed by it. The kind is made from the orbit (a closed orbit under 200 years is periodic, any other is long-period); give `kind: "interstellar"` for one that is. The same door will take asteroids and further objects in the same shape.

## When the input is wrong

An id that is not in the set throws a `RangeError` that lists the ids; a record that is not one throws a `TypeError`. A `when` that is not a `Date` or a number is a `TypeError`, an invalid or non-finite one a `RangeError`. A date far from the epoch is answered, not refused, with the drift described above. A bad element in `cometFromElements` (a negative eccentricity, a perihelion distance of 0, an inclination over 180, a number that is not a number) throws a `RangeError` or `TypeError` that names the field.

## Where the numbers come from

The elements are from the NASA/JPL Small-Body Database API (<https://ssd-api.jpl.nasa.gov/sbdb.api>, no key), one request for each comet, read on 2026-11-11 by `scripts/make-comet-data.py` with full precision, which writes `src/data/comets.ts`. The comparison values are from JPL Horizons (<https://ssd.jpl.nasa.gov/api/horizons.api>). NASA/JPL data is a US government work and in the public domain; [NOTICE.md](../../NOTICE.md) says so. The names, kinds and shower links are written here.
