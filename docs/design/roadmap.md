# Roadmap (DRAFT 1, for John's review)

**Status: a draft for John's review. Not published: not in the README, the guides, the docs site or the npm keywords. Planned, not promised.** Ticket: MODULES-540. Nothing on this page is built unless the "Today" column says so. When John has changed it and a feature ships, the shipped row moves to a public `docs/roadmap.md` and this file keeps the history.

**Rule for every number on this page:** none is claimed without a JPL Horizons measurement. Where a figure exists it is quoted from `docs/guides/accuracy.md` or `scripts/compare/results.json` and says where; everywhere else the cell says **not measured** and names the measurement that would fill it (the Horizons request, the test file). Counts of things in the repo (exports, files) are read from the repo and are marked as counts, not accuracy.

## 1. The table

"Accuracy target" is a target to be measured against Horizons, never a claim. Status values: **built** (on npm), **designed** (a design page and a plan, no code), **idea** (a ticket only).

| Area | Ticket | Status | Today | Accuracy target (to be measured) | Design page |
|---|---|---|---|---|---|
| Time: Julian dates, calendars, time scales, sidereal time | MODULES-538 | built in part (`/time`) | `/time` exports Julian date functions, calendars, `deltaT`, sidereal time, Mars time. The exact `{ day, ms }` instant and a stated time scale on every result are not built | the time scale conversions held against Horizons' own UT and TDB output: **not measured** | `areas.md` section 1 |
| Positions of the planets, dwarf planets, minor bodies, moons | MODULES-528 | built | `heliocentric`, `apparent`, `system`, tables fitted to Horizons; error tables in `docs/guides/accuracy.md` | held to the limits already in `test/accuracy*.test.ts` (quoted in the guide) | `areas.md` section 2 |
| Named result types, one name for the moment, `(body, when, options)` | MODULES-552, 540 | designed | the audit and the rules: `api-conventions.md`, `migration-plan.md` | not an accuracy item; a type and known-answer test item | `api-conventions.md`, `migration-plan.md` |
| Sky events: rise, set, transit, seasons, phases, apsides, eclipses, alignments, libration | MODULES-534 | designed | the Sun and Moon rise and set only, in `/suncalc`; held to Horizons within 1 s (`scripts/compare/rise-set-limits.json`) | per event, from Horizons observer tables and the eclipse canon: **not measured** for anything but the Sun and Moon rise and set | `areas.md` section 3; the sky-events hand-off plan |
| A drop-in superset of suncalc, with a legacy sub-path | MODULES-535, 537 | built in part | `/suncalc` and `/suncalc/legacy`; the forks audit is in `suncalc-forks.md` (branch docs/537-suncalc-legacy) | Sun and Moon times within 1 s of Horizons (as above); the legacy grid against suncalc 1.9.0 is a test still to write | `areas.md` section 4 |
| The sky behind the planets: stars, constellations, Milky Way, deep sky | MODULES-539 | designed | `/stars` (the Yale bright stars); the rest lives in hoshi-stars | positions of stars are catalogue values, not computed: no accuracy claim to make; draw alignment with Horizons' planet positions: **not measured** | `areas.md` section 5 |
| Comets, asteroids, meteor showers, the fact sheets | MODULES-529, 558, 732 | built in part | `/asteroids`, `/comets`, `/belts`, `BodyFacts`; meteor showers not built | comets and asteroids: the per-body table in the accuracy guide for the five carried; the belt bodies are two-body orbits from one epoch and **not measured** against Horizons | `areas.md` section 6 |
| The space view | MODULES-518 | built | `<wakusei-space>` | not an accuracy item | `areas.md` section 7 |
| Swiss Ephemeris style results (houses, nodes, speeds) | MODULES-536 | idea, low priority | nothing; an astrology package is a new package and John's decision | **not measured**; needs a Horizons comparison for each quantity before any claim | `areas.md` section 8 |

## 2. Two packages, one rule (MODULES-520)

Stated in `docs/guides/two-packages.md`, repeated here so the roadmap cannot drift from it: **chikyu-earth is for someone who cares about the Earth only; wakusei-planets is for any other body and for the solar system, and the Earth as one body among them.** The dependency runs one way: wakusei-planets may use chikyu-earth as an optional peer, and chikyu-earth never needs wakusei-planets. The same one-way rule is proposed for the sky tables: wakusei-planets may take hoshi-stars as an optional peer, never the reverse (`areas.md` section 5). A feature that only needs a place on the Earth goes to chikyu-earth; where Mars is tonight goes here. The test: would someone install only one of the two and still want it?

## 3. How wakusei-planets compares (to fill in as measurements arrive)

The packages John named: suncalc, astronomy-engine, astronomia, celestine, astronomy-bundle. The reading below is what is **known from the repo today**. Everything else is blank on purpose.

| | wakusei-planets | suncalc | astronomy-engine | astronomia | celestine | astronomy-bundle |
|---|---|---|---|---|---|---|
| Accuracy against Horizons | per body in `docs/guides/accuracy.md` | Sun and Moon rise and set measured (`scripts/compare/rise-set-results.json`); positions: the guide's comparison table has a suncalc column | the guide's "Compared with other packages" table, 1950 to 2050, and rise and set | **not measured** | **not measured** | **not measured** |
| Size, gzipped | `pnpm size` per entry (`scripts/size-baseline.json`); a per-entry figure is in the budget file, not repeated here | the compare results record measured code sizes for the three packages in `scripts/compare` | same | **not measured** | **not measured** | **not measured** |
| Types | TypeScript source, shipped `.d.ts` | none in 1.x; built in 2.x (per `suncalc-forks.md`) | read from `astronomy.d.ts` (per the sky-events plan) | **not read** | **not read** | **not read** |
| Licence | MIT | BSD-2-Clause (read in `suncalc-forks.md`) | MIT (`scripts/compare/README.md`) | **not read** | **not read** | **not read** |
| Where we are better | positions of the dwarf planets, minor bodies and moons; drawing; one package for both | n/a | the guide's table, for the bodies and dates it measures | to be found | to be found | to be found |
| Where we are not | sky events (eclipses, apsides, alignments) until MODULES-534 ships; star catalogues (hoshi-stars) | the legacy API shape (until `/suncalc/legacy` is checked on the grid) | everything in section 1 marked designed | to be found | to be found | to be found |

To fill the blank cells: install each package in `scripts/compare` only (a dev-only comparator, never a dependency of the package), run it against the same Horizons fixture, and read its licence file and `package.json` by hand. Each is a download and a new dev dependency, so each needs John's yes first (see section 5).

## 4. What would make the table true

1. The sky-events first ticket (the `./sky` entry, the optional peer, one function end to end), per the sky-events plan.
2. The time design (MODULES-538): the exact instant and the time scale named on every result.
3. The conventions' known-answer tests for each old name, before any alias.
4. The comparison harness (`scripts/compare`) extended to every package in the table above.
5. The core-stats shape (MODULES-732), so fact sheets carry their source.

## 5. For John to decide

1. Whether the five comparison packages may be added to `scripts/compare` as dev-only comparators (downloads; new dev dependencies; licences read first). Without them the table stays blank.
2. Whether a public `docs/roadmap.md` is wanted at all before 1.0, or only this draft.
3. The wording "planned, not promised": too soft, or right?
4. Whether the one-way peer rule (wakusei may take hoshi, never the reverse) is stated on the public two-packages page when the sky backdrop is built, not before.
