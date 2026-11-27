# Ephemeris package survey: licences and contents (record)

Ticket: MODULES-531. A record of the survey made on 2026-11-07 for MODULES-528 (positions), 529 (sky features) and 530 (umbrella), with every licence re-read on 2026-11-17. It decides nothing: John's yes or no per package (reference only, depend as an optional peer or dev tool, or leave) is still open.

Sources of the contents: the survey note on the MODULES-531 ticket (registry metadata and READMEs only; no AGPL or GPL code read in detail or copied), `docs/design/suncalc-forks.md` (the suncalc audit of 2026-11-17) and `docs/design/interstellar-tools.md` (the per-piece decision). Nothing here was installed or run by this record.

## How each licence was checked

Each row was read on its own GitHub page, one page at a time, on **2026-11-17**, with the tool that fetches a page and answers a question about it (so a quoted line is as that tool returned it, a summary of the page, not the raw file). npmjs.com answered HTTP 403 to every fetch, so no npm page was readable; where the repo page showed no licence, the repo's own `package.json` `license` field (raw GitHub) was read instead, and that is said. No Wikipedia. A row marked NOT RE-CHECKED could not be found on GitHub by search and keeps only the survey note's claim.

## Licence table

| Package | Repository read | Licence line as read on 2026-11-17 | Matches the survey? | Use |
|---|---|---|---|---|
| celestine 0.9.0 | github.com/Anonyfox/celestine | sidebar "MIT license"; README "MIT licensed, with zero runtime dependencies and the same calculation results in browsers and Node." | yes | permissive: reference or peer |
| astronomy-engine 2.1.19 | github.com/cosinekitty/astronomy | sidebar "MIT license" (README line not in the page text) | yes | permissive; already a devDependency and the planned optional peer (MODULES-534) |
| astronomy-bundle (9.42.1) | github.com/andrmoel/astronomy-bundle-js | repo page shows NO licence in its sidebar or README, and `LICENSE` is a 404 on `master` and `main`; raw `package.json` on `master`: `"license": "MIT"` | metadata says MIT; **the repo shows no licence file**: ask the author or check the published tarball before depending | reference only until a LICENSE file is seen |
| naelos-ephemeris | github.com/altariqabraham-design/naelos-ephemeris | sidebar "Apache-2.0 license"; README "Copyright 2026 Altariq Abraham, doing business as Apex Node. Licensed under the Apache License, Version 2.0"; data: "DE440, 1550-2649: 12 files, 6.6 MB, with Chiron and the asteroids" and DE441 for 13,200 BC to AD 17,191 "294 files, 162 MB" | yes | permissive (Apache-2.0 needs its NOTICE kept); the DE data is NASA JPL's |
| interstellar-tools (monorepo; types, constants, equations, temporal, tracking, maps) | github.com/phun-ky/interstellar-tools | sidebar "MIT license"; README "This project is licensed under the MIT License - see the LICENSE file for details." (copyright line not visible on the page; an earlier reading had "Copyright (c) 2025 Alexander Vassbotn Røyne-Helgesen") | yes | permissive; checklist only, nothing copied: `docs/design/interstellar-tools.md` |
| vsop87 (gmarty) | github.com/gmarty/vsop87 | sidebar "MIT license"; README "MIT license". Size: "~719 Kb to ~826 Kb gzipped depending on the series (~2.08 Mb to ~2.29 Mb unzipped)" | licence yes; **size differs**: the survey said 7 MB, the README says about 2.3 MB unzipped | permissive; data is IMCCE's VSOP87, which has its own terms, to be read before shipping |
| @tubular/astronomy 3.5.6 | github.com/kshetline/tubular_astronomy | repo page shows only a "License" link (file `LICENSE.md`, text not shown); raw `package.json`: `"license": "MIT"` | yes (by package.json) | permissive |
| @observerly/astrometry | github.com/observerly/astrometry | sidebar "MIT license"; README "@observerly/astrometry is released under the MIT License." | yes | permissive |
| suncalc 2.x (oracle, for context) | github.com/mourner/suncalc | sidebar "BSD-2-Clause license" | yes (the npm field is empty, the repo says BSD-2-Clause) | dev-only oracle already |
| caelis-engine | github.com/HermeticaLabs/caelis-engine | sidebar "AGPL-3.0 license"; README "Caelis Engine is released under **AGPL-3.0**." | survey said AGPL-3.0-or-later; the page says AGPL-3.0 | NOT usable in MIT code |
| @fusionstrings/swiss-eph | github.com/fusionstrings/swiss-eph | sidebar "AGPL-3.0 license"; README "AGPL-3.0 - Same license as the Swiss Ephemeris library." | yes | NOT usable in MIT code |
| ephemeris (Moshier port, mivion) | github.com/mivion/ephemeris | README "Licensed under GPL version 2 (http://www.gnu.org/licenses/gpl-2.0.html)." No sidebar licence | **differs**: the survey said GPL-3.0 (from the registry). The repo says GPL v2. Either way a GPL | NOT usable in MIT code |
| @swisseph/core, @swisseph/node, @swisseph/browser | not found by GitHub search | NOT RE-CHECKED. Survey note: AGPL-3.0 | | NOT usable in MIT code, on the survey's word and on the same-origin fusionstrings row |
| @astrologer/ephemera | not found by GitHub search | NOT RE-CHECKED. Survey note: MIT | | read the repo before any use |
| @blcklab/siriusx | not found by GitHub search | NOT RE-CHECKED. Survey note: MIT | | as above |
| @pondlog/source-nightsky (meteor showers) | not found by GitHub search | NOT RE-CHECKED. Survey note: MIT | | as above; 529's meteor showers come from the IMO list, not from this |
| astrokit | not found by GitHub search | NOT RE-CHECKED. Survey note: ISC | | as above |

Summary: 8 permissive licences read on a repo page (celestine, astronomy-engine, naelos-ephemeris, interstellar-tools, vsop87, @tubular/astronomy, @observerly/astrometry, plus suncalc BSD-2-Clause as context) and 3 copyleft read on a repo page (caelis-engine AGPL-3.0, @fusionstrings/swiss-eph AGPL-3.0, ephemeris GPL v2). One has MIT in `package.json` but no licence file on the repo (astronomy-bundle). Five could not be found and keep the survey's claim (@swisseph/*, @astrologer/ephemera, @blcklab/siriusx, @pondlog/source-nightsky, astrokit). Two survey facts were wrong: vsop87's size and the ephemeris licence version.

## Contents, from the survey

| Package | What it holds | Accuracy as claimed or measured | Notes |
|---|---|---|---|
| celestine 0.9.0 | TypeScript, no dependencies, 2 MB; charts, houses, aspects, transits, stations, progressions, eclipses against the NASA canon | CLAIMS 0.3 to 5 arc-seconds for the Sun and planets and 7.6 for the Moon over 1800 to 2200 against Horizons fixtures. Not verified; theory not stated | astrology-heavy: houses and aspects are not this package's field |
| astronomy-engine | rise, set, transit, seasons, phases, eclipses, apsides, nodes, elongation, libration, Jupiter's moons, constellations | measured by the surveyor: planets 1.4 to 19 arc-seconds, Moon 78 | planned optional peer for sky events (`sky-events-plan-2026-11-17.md`) |
| astronomy-bundle | Meeus plus VSOP87; rise/set/transit, phases, magnitude, libration, conjunctions, stars, solar eclipses | not measured | licence file question above |
| naelos-ephemeris | JPL DE440/DE441 as Chebyshev tables, IERS apparent-place pipeline, 6.6 MB for 1550 to 2649 | 0.02 arc-second (claimed) | the only data-grade option; the size is the cost |
| interstellar-tools | constants (bodies, comets, asteroids, belts, stars), 122 equation modules (counted by the ticket, not by this record), time scales, SGP4, maps | its README: equations "not yet battle-tested" | verdicts per piece are in `docs/design/interstellar-tools.md`: skip their constants and time scales, names only as a checklist, atmosphere and entry stay out of this package |
| vsop87 | the VSOP87 series as JavaScript | exact to the theory | IMCCE's data, own terms |
| @tubular/astronomy, @observerly/astrometry | astronomy utilities | not measured | not read in detail |
| @astrologer/ephemera, @blcklab/siriusx | ephemeris and star libraries | not measured | |
| @pondlog/source-nightsky | meteor showers | | the IMO working list is the primary source |
| astrokit | astronomy toolkit | not measured | |
| Swiss Ephemeris wrappers | Moshier series (about 250 KB gzipped in a browser) plus optional JPL-derived files (2 MB) plus astrological houses | | the public sources of each part are below |
| caelis-engine | VSOP87B planets, ELP/MPP02-LLR Moon (164 L + 105 B + 29 R terms), IAU 2000B nutation (77 terms), delta T, UT1 sidereal time, refraction, topocentric, alt-az | not measured | |
| ephemeris | Moshier apparent geocentric Sun, Moon, planets, Chiron, Sirius, lunar nodes (mean and true), retrograde flags, rise/set/transit | not measured | |

Public sources behind what the non-permissive ones hold (so we can build from the theory, never from their code): IMCCE/CDS (VSOP87, ELP), IERS Conventions (nutation, precession), NASA/Espenak and Meeus (delta T), NAIF/JPL DE440 (public domain). Read each data file's licence before shipping it, and credit it in `NOTICE.md`.

## The suncalc family (from `suncalc-forks.md`)

suncalc 2.1.2 BSD-2-Clause (Copyright 2026 Volodymyr Agafonkin); suncalc 1.9.0 BSD-2-Clause; suncalc2, suncalc3 and suncalc-ts carry the same BSD text in their LICENSE files and no `license` field in their npm metadata (audited 2026-11-17 from GitHub). None of the three forks is used, not even as an oracle.

## Open for John

1. A yes or no per package: reference only, optional peer or dev tool, or leave (as the ticket says). The hand-offs recommend: astronomy-engine as an optional peer for events; everything else reference only.
2. astronomy-bundle: a MIT claim in `package.json` with no LICENSE file on the repo.
3. The five packages that could not be found on GitHub by search need their repo URL (from npm, which this tool cannot read) before their licence can be re-read.
