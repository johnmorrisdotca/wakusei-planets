---
title: Accuracy
section: explanation
order: 12
description: How far the planets' and moons' positions are from JPL Horizons, body by body, and how each was made.
---

The positions are checked against NASA's JPL Horizons, the reference for the sky. Three tests compare every planet, the Moon and every moon with Horizons and fail if any body is further away than the limit below: `test/accuracy.test.ts` on the few reference dates of `test/data/horizons.json`, `test/accuracy-dense.test.ts` on 60 dates spread over 1800 to 2200 (`test/data/horizons-dense.json`, a step of 2437 days so that no date sits on a planet's period), and `test/accuracy-fine.test.ts` for the finer planet series. The numbers are the worst of those dates, as a direction (the angle between the two answers, seen from the Sun for a planet and from the planet for a moon), not a distance.

For a picture, one degree on a moon's orbit is about the width of the moon's own disc on a screen; an arc-minute is a fraction of a pixel.

## Planets

Mercury to Neptune come from the VSOP87B series (Bretagnon and Francou, IMCCE), run in terrestrial time, the time scale the theory is written in: the clock's UTC plus the leap seconds and 32.184 seconds. Before 1972 the step from UTC to terrestrial time is delta T from the polynomials of Espenak and Meeus (NASA), and from 1972 it is exact. VSOP87 has no Pluto: it is a table of 20 segments fitted to Horizons for 1800 to 2200 (JPL's approximate Keplerian elements answer outside those years).

There are two cuts of the series, so that a page pays only for the accuracy it needs:

- **The default**: 995 of the 35,080 terms (13.8 kB gzipped for all eight planets, the same as before). It is the series every caller gets, with no code change.
- **`tables/vsop`**, optional: 2,581 terms (32 kB gzipped, not in `tables`, because it is the size of the whole planet engine again). Importing it teaches `heliocentric` the finer series.

```ts
import { heliocentric } from "@johnmorrisdotca/wakusei-planets";
import "@johnmorrisdotca/wakusei-planets/tables/vsop"; // the finer VSOP87B series: about 32 kB gzipped

const [x, y, z] = heliocentric("saturn", Date.UTC(2026, 10, 7, 12));
console.log(Math.hypot(x, y, z).toFixed(1));
```

VSOP87 was fitted to JPL's DE200, and against today's Horizons the mean longitudes of Jupiter and Neptune have drifted as a straight line in time (Neptune by 1.2 arc-seconds in 2000 and 13 more in each thousand years). `scripts/make-vsop-data.py` fits that line to Horizons on 80 dates that are not the test's and takes it out of the two series as two terms; without it Neptune was 5.7 arc-seconds off and Jupiter 3.1 on the 60 dates.

| Body | JPL approximate elements (before) | Default, 5 dates 1800 to 2050 | Default, 60 dates 1800 to 2200 | Held to | `tables/vsop`, 60 dates | Held to | astronomy-engine, 60 dates |
|---|---|---|---|---|---|---|---|
| Mercury | 41″ | 2.3″ | 3.4″ | 4.5″ | 1.3″ | 1.7″ | 74.5″ |
| Venus | 14″ | 0.5″ | 2.0″ | 2.6″ | 0.4″ | 0.6″ | 24.0″ |
| Earth | 8″ | 1.5″ | 3.1″ | 4″ | 0.5″ | 0.7″ | 14.1″ |
| Mars | 58″ | 1.4″ | 4.8″ | 6″ | 0.7″ | 0.95″ | 11.4″ |
| Jupiter | 309″ | 1.0″ | 2.8″ | 3.6″ | 0.5″ | 0.7″ | 13.7″ |
| Saturn | 545″ | 3.7″ | 4.4″ | 5.7″ | 0.8″ | 1.1″ | 19.8″ |
| Uranus | 79″ | 3.8″ | 3.9″ | 5″ | 1.9″ | 2.5″ | 17.3″ |
| Neptune | 45″ | 1.6″ | 2.6″ | 3.4″ | 0.7″ | 0.95″ | 19.9″ |
| Pluto | 39″ | 0.05″ | 0.06″ | 0.2″ | the same | the same | 26.3″ |

An arc-second is 1/3600 of a degree. The first column is where the package started (JPL's approximate elements, measured on the five reference dates), and the second and third are the same code, as it stands now, on the five dates and on the 60. The 60-date column is the honest one: the five dates are a regression grid, and a planet can be worse on the dates between. The last column is [astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT) on the same 60 dates (`node scripts/compare/dense.mjs` prints it); its worst dates are mostly near the two ends of the 400 years. Even the whole of VSOP87B, with all 35,080 terms, leaves 2.2 arc-seconds on Uranus and (without the drift taken out) 3.7 on Neptune against Horizons: Uranus is the loosest of the finer series because that is about the theory's own limit, not the cut.

The series is good for the years 1750 to 2250 and slowly gets worse beyond.

## The dwarf planets

Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris and Sedna are tables fitted to Horizons, like Pluto: Chebyshev segments (4 years each for Ceres, 50 to 200 for the slow ones) from the solar system's barycentre, where a distant body's path is smooth. From the Sun it also carries the Sun's own twelve-year swing about the barycentre (Jupiter's pull, about a million kilometres), which no short polynomial follows, so the package works out that swing from the planets' masses and adds it back. Ceres is tabulated for 1900 to 2100 and the others for 1800 to 2200; outside those years the osculating elements of one epoch answer, good for a few years either side of June 2026. Checked on six dates from 1900 to 2099 that are not on the fit's grid.

The tables are optional, so a page that draws only the Earth does not pay for them: the web component loads them, and a server or a script that calls `heliocentric` imports the ones it wants. Without a table the old elements answer.

```ts
import { heliocentric } from "@johnmorrisdotca/wakusei-planets";
import "@johnmorrisdotca/wakusei-planets/tables/dwarfs"; // Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna: about 5 kB gzipped
import "@johnmorrisdotca/wakusei-planets/tables/ceres"; // Ceres, 1900 to 2100: about 14 kB gzipped

const [x, y, z] = heliocentric("ceres", Date.UTC(2000, 0, 1));
console.log(Math.hypot(x, y, z).toFixed(2));
```

`@johnmorrisdotca/wakusei-planets/tables` loads both.

| Body | Worst measured | Held to | Years |
|---|---|---|---|
| Ceres | 0.16″ | 0.3″ | 1900 to 2100 |
| Orcus | 0.04″ | 0.1″ | 1800 to 2200 |
| Haumea | 0.03″ | 0.1″ | 1800 to 2200 |
| Quaoar | 0.08″ | 0.15″ | 1800 to 2200 |
| Makemake | 0.08″ | 0.15″ | 1800 to 2200 |
| Gonggong | under 0.01″ | 0.1″ | 1800 to 2200 |
| Eris | 0.02″ | 0.1″ | 1800 to 2200 |
| Sedna | under 0.01″ | 0.1″ | 1800 to 2200 |

Before this, a dwarf planet was a plain ellipse that was right only near 2026: Ceres was 2° off in 2000 and 9° off in 1900, and the others were a few arc-minutes off.

## The minor bodies

Vesta, Pallas, Chiron, Pholus and Halley's comet are tables fitted to Horizons in the same way as the dwarf planets (Chebyshev segments from the solar system's barycentre, the Sun's swing added back), made by `scripts/make-minor-data.py`. The segments are not all one length: each is as long as it can be while the fit stays within an arc-second of the samples left out (Vesta and Pallas 2 to 4 years, Chiron and Pholus up to 10, Halley 43 days near the Sun and 16 years far from it), which a table says in its `edges`. Halley is Horizons' record 90000030, the solution of the 1986 apparition; a comet's orbit past the observations it was fitted to (1835 to 1994) is a prediction, and the planets' pull on it is in the solution, not in this package.

```ts
import { heliocentric } from "@johnmorrisdotca/wakusei-planets";
import "@johnmorrisdotca/wakusei-planets/tables/minor"; // Vesta, Pallas, Chiron, Pholus, Halley: about 48 kB gzipped

const [x, y, z] = heliocentric("halley", Date.UTC(1986, 1, 9, 12));
console.log(Math.hypot(x, y, z).toFixed(3)); // its perihelion: 0.587 au from the Sun
```

`@johnmorrisdotca/wakusei-planets/tables` loads them with the others, and `<wakusei-space>` loads them itself (`<wakusei-body>` fetches them when a minor body has a date). Measured against Horizons on 12 dates, one request a date (Horizons gives every time of a list the correction between terrestrial and universal time of the list's *first* date, which puts a list from 1835 a minute off in 2026: 6 arc-seconds for Halley at its perihelion), from the Sun:

| Body | Worst measured | Held to | Years |
|---|---|---|---|
| Vesta | 0.18″ | 1″ | 1900 to 2100 |
| Pallas | 0.13″ | 1″ | 1900 to 2100 |
| Chiron | 0.21″ | 1″ | 1800 to 2200 |
| Pholus | 0.10″ | 1″ | 1800 to 2200 |
| Halley | 0.53″ | 1″ | 1800 to 2200 |

Outside those years each is a plain ellipse from Horizons' osculating elements of one epoch, which a planet's pull moves away from the real orbit: Vesta is 2.5° off in 1835 and 1.9° in 2134, Pallas is 8° off in 1835, and Halley, whose elements are from 1968, is 31° off by 2026 without its table. `heliocentricModel` says which one answered.

## The Moon and the moons ELP2000-82B (Chapront-Touzé and Chapront, IMCCE) cut to its 540 largest terms and run in terrestrial time, as the planets are.

Jupiter's and Saturn's moons follow published theories, as optional entry points (`tables` loads both; the web component fetches each only when it draws that planet's moons, as a chunk of its own, so a page that shows one planet does not grow):

- **Io, Europa, Ganymede and Callisto**: L1.2 (Lainey, Duriez and Vienne 2006, IMCCE), cut to 140 terms with a Chebyshev polynomial for the slowest swings (`tables/galilean`, about 5 kB gzipped). Valid from 1130 to 2760.
- **Mimas, Enceladus, Tethys, Dione, Rhea, Titan and Iapetus**: TASS1.7 (Vienne and Duriez 1995, IMCCE), cut to 316 terms (`tables/saturn-moons`, about 7 kB gzipped). Hyperion and Saturn's small moons are fitted instead (below).

```ts
import { system } from "@johnmorrisdotca/wakusei-planets";
import "@johnmorrisdotca/wakusei-planets/tables/saturn-moons"; // Mimas to Iapetus from TASS1.7: about 7 kB gzipped

const titan = system("saturn", Date.UTC(2026, 10, 7, 12)).moons.find((moon) => moon.id === "titan");
console.log(Math.round(titan?.distance ?? 0));
```

Every other moon's orbit, and every moon's orbit before one of those tables is imported, is fitted to Horizons' own positions and velocities for 1800 to 2199: a mean orbit plane, a mean longitude that moves at a steady rate, and a periapsis and node that turn at steady rates. Where a steady rate is not enough, a moon has one more term: Phobos, whose orbit is shrinking, has an acceleration, and Mimas and Tethys, which pull on each other, swing back and forth over about 70 years. It used to be fitted to 1950 to 2050 only: Phobos was 4 degrees off in 1800 and Ariel 1.4 degrees in 2194, and they are now 0.41 and 0.22. The Uranus and Mars moons stay fitted: IMCCE's GUST86 and ESAPHO/ESADEI theories carry a notice that forbids passing on changed files, so they are not used.

| Body | Theory | Before, 7 dates 1900 to 2100 | Now, the same 7 dates | Now, 60 dates 1800 to 2200 | Held to (60 dates) |
|---|---|---|---|---|---|
| The Moon | ELP2000-82B | 0.0005° | 0.0005° | 4.7″ | 5.8″ |
| Phobos | fitted | 0.57° | 0.34° | 0.41° | 0.55° |
| Deimos | fitted | 0.32° | 0.33° | 0.39° | 0.55° |
| Io | L1.2 | 0.08° | 0.056° | 0.11° | 0.15° |
| Europa | L1.2 | 0.09° | 0.022° | 0.037° | 0.05° |
| Ganymede | L1.2 | 0.21° | 0.016° | 0.026° | 0.03° |
| Callisto | L1.2 | 0.07° | 0.006° | 0.014° | 0.02° |
| Mimas | TASS1.7 with phase correction | 1.07° | 0.164° | 0.345° | 0.5° |
| Enceladus | TASS1.7 with phase correction | 0.42° | 0.020° | 0.038° | 0.05° |
| Tethys | TASS1.7 | 0.22° | 0.040° | 0.21° | 0.27° |
| Dione | TASS1.7 | 0.08° | 0.086° | 0.18° | 0.23° |
| Rhea | TASS1.7 | 0.09° | 0.081° | 0.22° | 0.27° |
| Titan | TASS1.7 | 0.05° | 0.017° | 0.044° | 0.06° |
| Iapetus | TASS1.7 | 0.23° | 0.016° | 0.032° | 0.04° |
| Miranda | fitted | 1.76° | 0.115° | 0.173° | 0.4° |
| Ariel | fitted | 0.38° | 0.20° | 0.22° | 0.3° |
| Umbriel | fitted | 0.14° | 0.084° | 0.20° | 0.28° |
| Titania | fitted | 0.40° | 0.18° | 0.39° | 0.52° |
| Oberon | fitted | 0.38° | 0.43° | 0.44° | 0.6° |
| Triton | fitted | 0.03° | 0.054° | 0.12° | 0.17° |
| Nereid | fitted | 6.05° | 0.973° | 1.72° | 2.6° |
| Proteus | fitted | 0.13° | 0.10° | 0.12° | 0.17° |
| Charon | fitted | 0.02° | 0.02° | 0.02° | 0.06° |
| Nix | fitted | 1.93° | 0.287° | 0.358° | 0.46° |
| Hydra | fitted | 1.54° | 0.584° | 0.667° | 0.86° |

On the 60 dates the Galilean moons are 6 to 11 times closer than astronomy-engine's (`node scripts/compare/dense.mjs`: Io 411″ against its 2,626″, Europa 132″ against 1,403″, Ganymede 92″ against 814″, Callisto 52″ against 379″), and the Moon 4.7″ against 207″.

- **Mimas, Enceladus, Miranda and Nereid** use corrections to the phase of their orbits. The correction is a drift with a few periodic terms fitted to 768 Horizons dates from 1800 to 2199. A separate set of 192 Horizons dates measured maximum errors of 0.395°, 0.036°, 0.306° and 2.08° respectively. Nereid has eccentricity 0.75, and small timing errors near periapsis still make large angular errors.
- **Nix and Hydra** orbit the Pluto system's barycentre, and their positions in a moon system are relative to Pluto's centre. The conversion uses Charon's share of the system mass and its current position relative to Pluto. For both moons the new fits and the previous models were compared to the same Pluto-centred Horizons vectors. On the 192 separate dates the maximum fell from 2.01° to 0.363° for Nix and from 1.68° to 0.686° for Hydra. The **Before** figures in the table are the older barycentric measurements.
- **Styx and Kerberos** use the moon catalogue's mean elements (JPL Planetary Satellite Mean Elements, ephemeris PLU060, epoch 2026-01-01). They are not in this Horizons check. A distance that names them allows 5°.
- The dwarf planets' moons other than Pluto's (Eris, Haumea, Makemake, Orcus, Quaoar and the rest) come from the papers named in `src/data/dwarf.ts`, and are not part of this check.

### The moons added with their shape models

Fifteen more moons are drawn in full, each with the shape a spacecraft measured: Amalthea and Thebe (Jupiter), Pan, Daphnis, Atlas, Prometheus, Pandora, Epimetheus, Janus, Telesto, Calypso, Helene, Hyperion and Phoebe (Saturn) and Larissa (Neptune). Each orbit is fitted the same way, one fit to Horizons' positions for the years Horizons has an ephemeris for the moon (the table says which: Janus, Epimetheus, Atlas, Prometheus, Pandora and Pan only from 1949-12-27 to 2050-01-06, Daphnis only from 1990-06-15 to 2018-01-14), and the line is carried on outside those years, where it is not checked. Where the mean orbit cannot follow a moon, the worst error is large, and the limit says so:

| Body | Fitted to Horizons for | Worst of the test dates | Held to |
|---|---|---|---|
| Amalthea | 1800 to 2199 | 0.82° | 1.2° |
| Thebe | 1800 to 2199 | 0.15° | 0.25° |
| Hyperion | 1800 to 2199 | 12.9° | 20° |
| Phoebe | 1800 to 2199 | 1.85° | 2.8° |
| Janus | 1949 to 2050 | 5.9° | 9° |
| Epimetheus | 1949 to 2050 | 20.5° | 31° |
| Helene | 1800 to 2199 | 14.4° | 22° |
| Telesto | 1800 to 2199 | 2.3° | 3.5° |
| Calypso | 1800 to 2199 | 4.9° | 7.5° |
| Atlas | 1949 to 2050 | 7.9° | 12° |
| Prometheus | 1949 to 2050 | 14.1° | 22° |
| Pandora | 1949 to 2050 | 26.3° | 40° |
| Pan | 1949 to 2050 | 0.58° | 0.9° |
| Daphnis | 1990 to 2018 | 0.54° | 0.8° |
| Larissa | 1800 to 2199 | 0.25° | 0.4° |

These are measured on 5 to 7 dates inside each moon's years (`test/data/horizons-more-moons.json`, made by `scripts/fetch-horizons-reference.py more-moons`), not on 60, and the limits are about half as much again as the worst. A moon off by 10° is off by about 25,000 km at Saturn, and the loose ones are the ones a straight line and one wave cannot follow:

- **Janus and Epimetheus** swap their orbits every four years (each moves out a little as the other moves in), so neither goes round at one rate.
- **Prometheus, Pandora and Atlas** pull on one another and on Saturn's rings and sit in resonances with Mimas; the fit leaves 4 to 7° of scatter.
- **Helene** swings (librates) round Dione's leading Trojan point, over tens of degrees, and **Telesto and Calypso** do the same round Tethys's, over about 10.
- **Hyperion**'s orbit is locked to Titan's in a 4 to 3 resonance and turns its periapsis in a way a line cannot follow.
- **Pan, Daphnis, Amalthea, Thebe, Phoebe and Larissa** are close, within a degree or two.

## What it is good for

A planet is drawn within a few arc-seconds, and a moon within a degree or two on its orbit (Jupiter's four and Saturn's Titan and Iapetus within a few hundredths of a degree), which is the right place for a picture, a chart, or a story about the sky. It is not an ephemeris for pointing a telescope or planning a flight: for that use JPL Horizons itself.

## Check it yourself

`pnpm test` runs the accuracy tests. `python3 -I scripts/fetch-horizons-reference.py` and `python3 -I scripts/fetch-horizons-dense.py` fetch Horizons' positions again into `test/data/horizons.json` and `test/data/horizons-dense.json`; `python3 -I scripts/make-vsop-data.py` (and `fine`), `make-lunar-data.py`, `make-galilean-data.py`, `make-tass17-data.py` and `make-moon-data.py` write the series and orbits in `src/data`. They need the network, and none runs in the test.

<!-- comparison:start -->
## Compared with other packages

We passed the same instants to each package and measured its direction error against JPL Horizons. These are **agreements on this sparse sample**, not guarantees over a whole date range or proof against physical observations. Smaller is better. A dash means unsupported or not measured, never zero error.

Measured wakusei code: package.json version 0.78.0, **source revision [9da1c38](https://github.com/johnmorrisdotca/wakusei-planets/tree/9da1c3837c2337a2ed96c17c02305fb07a96753c)**, the last commit that changed src/. A later release of the same version label with a different src/ is not covered.

### Shared samples from 1950–2050

A full-range maximum can be dominated by out-of-range calls or calendar bugs. Start with the shared samples from 1950 through 2050-01-01T12:00:00Z. Dates and counts differ by body: 3 planet dates, 4 dwarf dates, 5 moon dates, and 6 horizon dates.

| Body | wakusei (arcsec) | Limit | astronomy-engine | solarsystem | suncalc |
|---|---:|---:|---:|---:|---:|
| mercury | 2.323 | 3.500 | 10.369 | 36.760 | — |
| venus | 0.538 | 1.000 | 6.579 | 11.172 | — |
| earth | 1.464 | 2.200 | 1.149 | 10.375 | — |
| mars | 1.414 | 2.200 | 2.750 | 55.795 | — |
| jupiter | 1.039 | 1.600 | 6.426 | 61.115 | — |
| saturn | 3.730 | 5.600 | 9.941 | 75.064 | — |
| uranus | 3.839 | 5.800 | 12.503 | 74.782 | — |
| neptune | 1.643 | 2.500 | 14.934 | 44.883 | — |
| pluto | 0.037 | 0.300 | 4.869 | 52.455 | — |
| ceres | 0.159 | 0.300 | — | 2665.961† | — |
| eris | 0.010 | 0.100 | — | 129.397† | — |
| moon | 0.651 | 2.880 | 10.497 | 165.958 | — |
| io | 129.160 | 288.000 | 96.969 | — | — |
| europa | 79.052 | 108.000 | 97.804 | — | — |
| ganymede | 56.424 | 79.200 | 86.120 | — | — |
| callisto | 19.976 | 28.800 | 61.012 | — | — |
| sun | 1.464 | 2.200 | 1.149 | 10.375 | — |
| sun (horizon) | 3.925 | 6.000 | 4.502 | — | 30.927 |
| moon (horizon) | 4.839 | 8.000 | 10.560 | — | 34.195 |

**Astronomy Engine wins some comparisons.** In this subset it has smaller maximum errors for Earth, the geocentric Sun and Io. Across the full fixture it wins only Earth and the geocentric Sun, by under 0.05 arc-second. Wakusei has smaller maxima for the other eight planet/Pluto rows, Earth's Moon, and Europa, Ganymede and Callisto (and Io across the full fixture), but does not win at every individual date. It is not the smallest package, either.

### Geometric positions: all reference dates

Every error is in arcseconds. Planets use 5 dates across 1800–2050; dwarfs 6 across 1900–2099; moons 7 across 1900–2100. The geocentric Sun uses the same 5 dates as Earth. Its vector is the negative Earth vector, so its direction error duplicates Earth rather than adding independent evidence. These spans are not a shared validity guarantee from the packages.

| Body | wakusei (arcsec) | Limit | astronomy-engine | solarsystem | suncalc |
|---|---:|---:|---:|---:|---:|
| mercury | 2.323 | 3.500 | 10.369 | 37992.132 | — |
| venus | 0.538 | 1.000 | 6.579 | 11670.162 | — |
| earth | 1.464 | 2.200 | 1.418 | 7344.329 | — |
| mars | 1.414 | 2.200 | 2.750 | 3563.521 | — |
| jupiter | 1.039 | 1.600 | 6.426 | 612.646 | — |
| saturn | 3.730 | 5.600 | 9.941 | 331.634 | — |
| uranus | 3.839 | 5.800 | 12.503 | 225.545 | — |
| neptune | 1.643 | 2.500 | 15.911 | 44.883 | — |
| pluto | 0.045 | 0.300 | 18.930 | 2052.754 | — |
| ceres | 0.159 | 0.300 | — | 3184.163† | — |
| orcus | 0.042 | 0.100 | — | — | — |
| haumea | 0.027 | 0.100 | — | — | — |
| quaoar | 0.081 | 0.150 | — | — | — |
| makemake | 0.081 | 0.150 | — | — | — |
| gonggong | 0.007 | 0.100 | — | — | — |
| eris | 0.020 | 0.100 | — | 345.847† | — |
| sedna | 0.003 | 0.100 | — | — | — |
| moon | 1.832 | 2.880 | 78.289 | 53144.774 | — |
| phobos | 1237.289 | 1800.000 | — | — | — |
| deimos | 1190.130 | 1620.000 | — | — | — |
| io | 201.808 | 288.000 | 901.772 | — | — |
| europa | 79.052 | 108.000 | 504.853 | — | — |
| ganymede | 56.797 | 79.200 | 339.079 | — | — |
| callisto | 19.976 | 28.800 | 129.411 | — | — |
| mimas | 2655.281 | 3600.000 | — | — | — |
| enceladus | 832.344 | 1152.000 | — | — | — |
| tethys | 144.408 | 216.000 | — | — | — |
| dione | 308.090 | 540.000 | — | — | — |
| rhea | 290.012 | 540.000 | — | — | — |
| titan | 61.695 | 90.000 | — | — | — |
| iapetus | 56.637 | 90.000 | — | — | — |
| miranda | 4146.993 | 5760.000 | — | — | — |
| ariel | 728.735 | 1080.000 | — | — | — |
| umbriel | 302.326 | 468.000 | — | — | — |
| titania | 641.514 | 900.000 | — | — | — |
| oberon | 1541.954 | 2160.000 | — | — | — |
| triton | 192.912 | 360.000 | — | — | — |
| nereid | 9004.499 | 12960.000 | — | — | — |
| proteus | 370.863 | 540.000 | — | — | — |
| charon | 70.477 | 180.000 | — | — | — |
| nix | 5586.882 | 8640.000 | — | — | — |
| hydra | 5666.466 | 8640.000 | — | — | — |
| sun | 1.464 | 2.200 | 1.418 | 7344.329 | — |

Planets and dwarfs are heliocentric; moons are relative to their parent (Nix/Hydra to the Pluto-system barycentre); the Sun is geocentric. The reference is geometric J2000 mean ecliptic. For Jupiter through Pluto the Horizons target is the planetary-system barycentre, not the isolated planet centre; unexposed native centre conventions may contribute to small differences. Radius/distance errors are not ranked. Wakusei loads every optional table except tables/vsop (the finer planet series). Astronomy Engine's HelioVector, GeoMoon and JupiterMoons are rotated from J2000 equatorial axes by the fixed obliquity. Python solarsystem uses precession=False; mean ecliptic-of-date directions are rotated to J2000 with IAU 1976 precession and mean obliquity. We measure the stable atan2 angle between normalized 3D vectors, not just longitude differences that discard latitude.

† The Python Ceres/Eris values interpret the epoch-based orbital elements as fixed J2000 axes. The public API does not clearly guarantee the frame for these two bodies, so they are not definitive rankings. Interpreting them as ecliptic of date gives full-range maxima of ceres: 3066.112; eris: 4665.214 arcsec instead. Both interpretations are retained in the result JSON.

The Python package's internal Julian date is two days early at the 1800 sample and one day early at the January 1900 sample. We do not repair its input date. This contributes to the large full-range errors; they do not describe orbital-model accuracy alone in its normal period. Chiron exists in the Python package but has no shared reference or wakusei implementation here, so is not scored.

### Observer Sun/Moon directions: a separate quantity

SunCalc's public API returns apparent horizontal directions, so it is not mixed into the geometric planet table. For the union of the existing planet and Moon dates (9 instants), a separate Horizons request gives apparent AIRLESS azimuth/elevation at latitude 35°, longitude −105°, ellipsoidal height 0 m. We numerically remove only each package's atmospheric correction, retaining its native parallax, aberration, light-time and sidereal-time models. Below-horizon cases remain included. This does not measure weather or the accuracy of an atmospheric model itself.

| Body | wakusei (arcsec) | Limit | astronomy-engine | solarsystem | suncalc |
|---|---:|---:|---:|---:|---:|
| sun (horizon) | 3.925 | 6.000 | 4.502 | — | 1140.685 |
| moon (horizon) | 4.839 | 8.000 | 77.952 | — | 13159.151 |

SunCalc 2.1.2's TT−UT polynomial targets approximately 1900–2150; 1800 is outside it. Its full-range values above include that extrapolation and must not be advertised as normal-period accuracy. The shared 1950–2050 results are in the first table. Only directions are tested: these numbers do not establish rise/set, eclipse or phase accuracy.

### Size, licences and reproduction

| Package/version | Measured code | Gzip bytes | Licence |
|---|---|---:|---|
| wakusei 0.78.0 | All main exports + all /suncalc exports + every optional table (not the finer planet series, tables/vsop) | 145,089 | MIT |
| astronomy-engine 2.1.19 | All ESM entry exports | 43,912 | MIT |
| solarsystem 0.1.8 | All Python module source (see caveat) | 11,351 | MIT |
| suncalc 2.1.2 | All ESM entry exports | 3,908 | BSD-2-Clause |

JavaScript sizes bundle every export as ESM with esbuild 0.25.12, minify, then gzip at level 9. The wakusei profile includes the optional data used by these rows, /suncalc, and the main entry's SVG/facts API. Python is a gzip of all .py module source, concatenated in filename order; it is not directly comparable to a JS bundle. Every size excludes language runtimes, installation metadata and images. Gzip can vary slightly with Python/Node versions. Root dependencies and src/ are unchanged. Sizes were recorded with Node v24.22.1 (zlib 1.3.2.1-motley-285e94b) and Python 3.14.4 (zlib 1.2.12). Reproduction requires identical minified bytes and code fingerprints; it reports compressed-size differences without treating compressor variation as a scientific regression.

Each package receives the same UTC instant. Wakusei runs its theories in TT; Astronomy Engine uses its own Delta-T model; SunCalc uses its TT−UT polynomial; Python solarsystem uses UT day counts directly in its theory. Historical Horizons UT is not identical to modern UTC; UT1/Earth-orientation handling and future Delta-T differences also enter the errors. We do not adjust input clocks to improve a competitor's score. Equal UTC inputs do not imply identical internal TT assumptions.

Run from the repository root (Node 24+, Python 3.12+). Initial installation needs the network; ordinary comparisons use checked-in references and run offline.

~~~sh
pnpm install --frozen-lockfile
pnpm --dir scripts/compare install --frozen-lockfile --ignore-scripts
python3 -m venv scripts/compare/.venv
scripts/compare/.venv/bin/python -m pip install --require-hashes --only-binary=:all: --no-deps -r scripts/compare/requirements.txt
node scripts/compare/run.mjs
node scripts/compare/run.mjs --check
pnpm check
pnpm docs:check
~~~

On Windows use Scripts/python.exe in the virtual environment; COMPARE_PYTHON can name an explicit interpreter. run.mjs writes results.json and these English/Japanese sections. --check verifies the stored scores and generated documentation. test/comparison.test.ts recomputes wakusei's column on the same dates without installing third-party comparators; published limits are never relaxed automatically.

scripts/compare/ retains reference vectors, request parameters, per-date errors and worst dates. Only to refresh the additional horizon reference, run python3 -I scripts/compare/fetch-observer.py. Small angles use atan2 rather than acos to avoid cancellation to zero. The geometric Horizons vectors are rounded to 0.1 km. The fitted tables were built from Horizons too, so this measures agreement with that parent ephemeris. Sparse samples cannot prove full-range precision, precision at unseen dates, or blanket superiority of a package.

Sources: [Astronomy Engine API](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md), [solarsystem](https://github.com/IoannisNasios/solarsystem/blob/master/README.md), [SunCalc](https://github.com/mourner/suncalc/blob/master/README.md), [Schlyter’s mean-of-date conventions and calendar range](https://stjarnhimlen.se/comp/ppcomp.html), [Horizons definitions](https://ssd.jpl.nasa.gov/horizons/manual.html).

### Not executed: README claims only

[Caelis Engine](https://github.com/HermeticaLabs/caelis-engine/blob/main/README.md) is AGPL-3.0 and advertises VSOP87B plus ELP/MPP02-LLR. [Pyswisseph](https://github.com/astrorigin/pyswisseph/blob/master/README.rst) is AGPL-3.0 and describes a high-precision ephemeris based on JPL DE431. [ephemeris](https://github.com/hemantgoswami/ephemeris/blob/master/README.md) describes a Moshier-derived implementation; its upstream [README](https://github.com/mivion/ephemeris/blob/master/README.md) declares GPL-2. These are **publisher README claims**, reviewed 2026-11-07, not measurements from this run. None was installed or executed. The linked READMEs do not provide bounds under this table's conditions; we do not invent numeric scores for them.
<!-- comparison:end -->
