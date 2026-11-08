---
title: Accuracy
section: explanation
order: 12
description: How far the planets' and moons' positions are from JPL Horizons, body by body, and how each was made.
---

The positions are checked against NASA's JPL Horizons, the reference for the sky. `test/accuracy.test.ts` compares every planet, the Moon and every moon with Horizons on several dates, and fails if any body is further away than the limit below. The numbers are the worst of those dates, as a direction (the angle between the two answers, seen from the Sun for a planet and from the planet for a moon), not a distance.

For a picture, one degree on a moon's orbit is about the width of the moon's own disc on a screen; an arc-minute is a fraction of a pixel.

## Planets

Mercury to Neptune come from the VSOP87B series (Bretagnon and Francou, IMCCE), cut to the terms that matter (991 of its 35,080) and run in terrestrial time, the time scale the theory is written in: the clock's UTC plus the leap seconds and 32.184 seconds. Pluto, which VSOP87 does not have, is a table of 20 segments fitted to Horizons for 1800 to 2200 (JPL's approximate Keplerian elements answer outside those years). Checked on five dates from 1800 to 2050.

| Body | Worst measured | Held to |
|---|---|---|
| Mercury | 2.3″ | 3.5″ |
| Venus | 0.5″ | 1″ |
| Earth | 1.5″ | 2.2″ |
| Mars | 1.4″ | 2.2″ |
| Jupiter | 1.9″ | 2.8″ |
| Saturn | 3.7″ | 5.6″ |
| Uranus | 3.8″ | 5.8″ |
| Neptune | 3.3″ | 5″ |
| Pluto | 0.05″ | 0.3″ |

An arc-second is 1/3600 of a degree. Uranus and Saturn are the loosest, because the cut series trades a few arc-seconds for size; Pluto, which is not in VSOP87, is fitted to Horizons and is the closest. The cut series is good for the years 1750 to 2250 and slowly gets worse beyond. Before 1972 the step from UTC to terrestrial time is delta T from the polynomials of Espenak and Meeus (NASA), and from 1972 it is exact.

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

## The Moon and the moons

The Moon is the lunar solution ELP2000-82B (Chapront-Touzé and Chapront, IMCCE) cut to its 540 largest terms and run in terrestrial time, as the planets are. Every other moon's orbit is fitted to Horizons' own positions and velocities for 1950 to 2050: a mean orbit plane, a mean longitude that moves at a steady rate, and a periapsis and node that turn at steady rates. Where a steady rate is not enough, a moon has one more term: Phobos, whose orbit is shrinking, has an acceleration, and Mimas and Tethys, which pull on each other, swing back and forth over about 70 years. Checked on seven dates from 1900 to 2100, so the table includes 50 years either side of the fitted window.

| Body | Worst measured | Held to |
|---|---|---|
| The Moon | 0.0005° (1.8″) | 0.0008° (2.9″) |
| Phobos | 0.57° | 0.9° |
| Deimos | 0.32° | 0.5° |
| Io | 0.08° | 0.15° |
| Europa | 0.09° | 0.15° |
| Ganymede | 0.21° | 0.3° |
| Callisto | 0.07° | 0.12° |
| Mimas | 1.07° | 1.6° |
| Enceladus | 0.42° | 0.65° |
| Tethys | 0.22° | 0.35° |
| Dione | 0.08° | 0.15° |
| Rhea | 0.09° | 0.15° |
| Titan | 0.05° | 0.1° |
| Iapetus | 0.23° | 0.35° |
| Miranda | 1.76° | 2.7° |
| Ariel | 0.38° | 0.6° |
| Umbriel | 0.14° | 0.25° |
| Titania | 0.40° | 0.6° |
| Oberon | 0.38° | 0.6° |
| Triton | 0.03° | 0.1° |
| Nereid | 6.05° | 9° |
| Proteus | 0.13° | 0.2° |
| Charon | 0.02° | 0.05° |
| Nix | 1.93° | 3° |
| Hydra | 1.54° | 2.4° |

- **Nereid** is the loosest because its orbit is very eccentric (0.75): near its closest point a small timing error is a large angle.
- **Nix and Hydra** are measured from the Pluto system's barycentre, which they go round. Pluto's centre is about 2,000 km from it, so seen from Pluto's centre they can be up to about 2.5° further off.
- **Miranda** and **Mimas** are the loosest of the regular moons: both have small swings the model does not carry.
- The dwarf planets' moons other than Pluto's (Eris, Haumea, Makemake, Orcus, Quaoar and the rest) come from the papers named in `src/data/dwarf.ts`, and are not part of this check.

## What it is good for

A moon is drawn where it is to within a degree or two on its orbit, which is the right place for a picture, a chart, or a story about the sky. It is not an ephemeris for pointing a telescope or planning a flight: for that use JPL Horizons itself.

## Check it yourself

`pnpm test` runs the accuracy test. `python3 -I scripts/fetch-horizons-reference.py` fetches Horizons' positions again into `test/data/horizons.json`, and `python3 -I scripts/make-moon-data.py` fits the moons again and writes `src/data/orbits.ts`. Both need the network, and neither runs in the test.

<!-- comparison:start -->
## Compared with other packages

We passed the same instants to each package and measured its direction error against JPL Horizons. These are **agreements on this sparse sample**, not guarantees over a whole date range or proof against physical observations. Smaller is better. A dash means unsupported or not measured, never zero error.

Measured wakusei code: package.json version 0.20.0, **source revision [6669a48](https://github.com/johnmorrisdotca/wakusei-planets/tree/6669a485505e33e8a781c3adf078a6c0514fb230)**, the last commit that changed src/. A later release of the same version label with a different src/ is not covered.

### Shared samples from 1950–2050

A full-range maximum can be dominated by out-of-range calls or calendar bugs. Start with the shared samples from 1950 through 2050-01-01T12:00:00Z. Dates and counts differ by body: 3 planet dates, 4 dwarf dates, 5 moon dates, and 6 horizon dates.

| Body | wakusei (arcsec) | Limit | astronomy-engine | solarsystem | suncalc |
|---|---:|---:|---:|---:|---:|
| mercury | 2.323 | 3.500 | 10.369 | 36.760 | — |
| venus | 0.538 | 1.000 | 6.579 | 11.172 | — |
| earth | 1.464 | 2.200 | 1.149 | 10.375 | — |
| mars | 1.414 | 2.200 | 2.750 | 55.795 | — |
| jupiter | 1.883 | 2.800 | 6.426 | 61.115 | — |
| saturn | 3.730 | 5.600 | 9.941 | 75.064 | — |
| uranus | 3.839 | 5.800 | 12.503 | 74.782 | — |
| neptune | 3.325 | 5.000 | 14.934 | 44.883 | — |
| pluto | 0.037 | 0.300 | 4.869 | 52.455 | — |
| ceres | 0.159 | 0.300 | — | 2665.961† | — |
| eris | 0.010 | 0.100 | — | 129.397† | — |
| moon | 0.651 | 2.880 | 10.497 | 165.958 | — |
| io | 138.857 | 540.000 | 96.969 | — | — |
| europa | 186.788 | 540.000 | 97.804 | — | — |
| ganymede | 764.864 | 1080.000 | 86.120 | — | — |
| callisto | 203.521 | 432.000 | 61.012 | — | — |
| sun | 1.464 | 2.200 | 1.149 | 10.375 | — |
| sun (horizon) | 3.925 | 6.000 | 4.502 | — | 30.927 |
| moon (horizon) | 4.839 | 8.000 | 10.560 | — | 34.195 |

**Astronomy Engine wins some comparisons.** In this subset it has smaller maximum errors for Earth, the geocentric Sun, and all four Galilean moons. Across the full fixture it also wins Earth, the geocentric Sun, Ganymede and Callisto. Wakusei has smaller maxima for the other eight planet/Pluto rows and Earth's Moon, but does not win at every individual date. It is not the smallest package, either.

### Geometric positions: all reference dates

Every error is in arcseconds. Planets use 5 dates across 1800–2050; dwarfs 6 across 1900–2099; moons 7 across 1900–2100. The geocentric Sun uses the same 5 dates as Earth. Its vector is the negative Earth vector, so its direction error duplicates Earth rather than adding independent evidence. These spans are not a shared validity guarantee from the packages.

| Body | wakusei (arcsec) | Limit | astronomy-engine | solarsystem | suncalc |
|---|---:|---:|---:|---:|---:|
| mercury | 2.323 | 3.500 | 10.369 | 37992.132 | — |
| venus | 0.538 | 1.000 | 6.579 | 11670.162 | — |
| earth | 1.464 | 2.200 | 1.418 | 7344.329 | — |
| mars | 1.414 | 2.200 | 2.750 | 3563.521 | — |
| jupiter | 1.883 | 2.800 | 6.426 | 612.646 | — |
| saturn | 3.730 | 5.600 | 9.941 | 331.634 | — |
| uranus | 3.839 | 5.800 | 12.503 | 225.545 | — |
| neptune | 3.325 | 5.000 | 15.911 | 44.883 | — |
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
| phobos | 2058.294 | 3240.000 | — | — | — |
| deimos | 1141.302 | 1800.000 | — | — | — |
| io | 292.581 | 540.000 | 901.772 | — | — |
| europa | 324.240 | 540.000 | 504.853 | — | — |
| ganymede | 764.864 | 1080.000 | 339.079 | — | — |
| callisto | 241.658 | 432.000 | 129.411 | — | — |
| mimas | 3858.669 | 5760.000 | — | — | — |
| enceladus | 1511.154 | 2340.000 | — | — | — |
| tethys | 801.241 | 1260.000 | — | — | — |
| dione | 280.402 | 540.000 | — | — | — |
| rhea | 331.703 | 540.000 | — | — | — |
| titan | 165.668 | 360.000 | — | — | — |
| iapetus | 831.707 | 1260.000 | — | — | — |
| miranda | 6350.328 | 9720.000 | — | — | — |
| ariel | 1378.971 | 2160.000 | — | — | — |
| umbriel | 521.442 | 900.000 | — | — | — |
| titania | 1436.882 | 2160.000 | — | — | — |
| oberon | 1381.817 | 2160.000 | — | — | — |
| triton | 125.009 | 360.000 | — | — | — |
| nereid | 21784.845 | 32400.000 | — | — | — |
| proteus | 470.760 | 720.000 | — | — | — |
| charon | 67.108 | 180.000 | — | — | — |
| nix | 6958.999 | 10800.000 | — | — | — |
| hydra | 5542.896 | 8640.000 | — | — | — |
| sun | 1.464 | 2.200 | 1.418 | 7344.329 | — |

Planets and dwarfs are heliocentric; moons are relative to their parent (Nix/Hydra to the Pluto-system barycentre); the Sun is geocentric. The reference is geometric J2000 mean ecliptic. For Jupiter through Pluto the Horizons target is the planetary-system barycentre, not the isolated planet centre; unexposed native centre conventions may contribute to small differences. Radius/distance errors are not ranked. Wakusei loads both optional tables. Astronomy Engine's HelioVector, GeoMoon and JupiterMoons are rotated from J2000 equatorial axes by the fixed obliquity. Python solarsystem uses precession=False; mean ecliptic-of-date directions are rotated to J2000 with IAU 1976 precession and mean obliquity. We measure the stable atan2 angle between normalized 3D vectors, not just longitude differences that discard latitude.

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
| wakusei 0.20.0 | All main exports + all /suncalc exports + both optional tables | 65,660 | MIT |
| astronomy-engine 2.1.19 | All ESM entry exports | 43,971 | MIT |
| solarsystem 0.1.8 | All Python module source (see caveat) | 11,351 | MIT |
| suncalc 2.1.2 | All ESM entry exports | 3,893 | BSD-2-Clause |

JavaScript sizes bundle every export as ESM with esbuild 0.25.12, minify, then gzip at level 9. The wakusei profile includes the optional data used by these rows, /suncalc, and the main entry's SVG/facts API. Python is a gzip of all .py module source, concatenated in filename order; it is not directly comparable to a JS bundle. Every size excludes language runtimes, installation metadata and images. Gzip can vary slightly with Python/Node versions. Root dependencies and src/ are unchanged. Sizes were recorded with Node v24.14.1 (zlib 1.2.12) and Python 3.14.4 (zlib 1.2.12). Reproduction requires identical minified bytes and code fingerprints; it reports compressed-size differences without treating compressor variation as a scientific regression.

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
