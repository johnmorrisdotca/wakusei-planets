# suncalc 1.x and its forks (DRAFT 1)

**Status: a draft for John to read and change. Not published on the docs site, not a promise.** Ticket: MODULES-537. Read online on 2026-11-17: GitHub pages and raw files only (npmjs.com answered 403 to the fetch tool, so npm metadata is read from the repos' own `package.json` and from npm.io). No code was copied and no package was installed.

## The audit: what main has today (69b33ca)

| Item | State | Where |
|---|---|---|
| (1) A v2 sub-path and a legacy sub-path, one engine, a thin adapter | **Done.** `./suncalc` and `./suncalc/legacy` are in `exports`. Both import `horizontalOf`, `moonEquatorial`, `moonPhase`, `sunEquatorial`, `sunDay`, `moonDay` from `src/sky/`; the legacy file (249 lines) only converts (radians, `fromSouth`, invalid `Date`, `inUTC`, bright-limb sign) | `src/suncalc.ts`, `src/suncalc-legacy.ts`, `package.json`, `scripts/check-package.ts` |
| (2) Read suncalc3 and suncalc-ts for extras | **Missing before this draft.** The guide said only "not covered yet". Done below | this file |
| (3) Dev-only oracle tests on a grid | **Mostly done.** `test/suncalc.test.ts` compares suncalc 2.1.2 on a grid of 6 places and 5 days for every function, astronomy-engine for rise and set, JPL Horizons figures, and **suncalc 1.9.0** (already a devDependency as `suncalc1`, `npm:suncalc@1.9.0`) for the Sun's altitude and the Moon's illumination only. **Partly missing:** the legacy Sun azimuth, `getTimes`, `getMoonPosition` and `getMoonTimes` are not compared with suncalc 1.9.0 on the grid; no oracle for suncalc2 or suncalc3 (not wanted, see licences) | `test/suncalc.test.ts` |
| (4) Check each fork's real licence before using it as an oracle | **Missing before this draft; done below.** The code path is clean: no fork is in `package.json`, and `NOTICE.md` lists only suncalc 1.9.0, 2.1.2 and astronomy-engine as dev-time comparisons | `NOTICE.md` |
| (5) "Coming from suncalc 1.x or suncalc2" guide, EN and JA | **Partly done.** A section existed in `docs/guides/suncalc.md` and `ja/suncalc.md`, with the three conventions and one example, but no side-by-side conversion, no day rule for the legacy functions, no before-and-after import line, and it did not name suncalc2 in the heading. This branch fills those in place | `docs/guides/suncalc.md`, `docs/guides/ja/suncalc.md` |

Result: the oracle suncalc 1.9.0 is **not** missing, so no download is needed to test suncalc 1.x more widely. Only the suncalc2 and suncalc3 packages would be new devDependencies, and this draft recommends against them.

One thing to confirm: a web search on 2026-11-17 reported suncalc on npm at 2.1.4, while the ticket and `package.json` have 2.1.2. Not verified (npmjs.com is blocked to the tool). The oracle test only needs a pinned version, so nothing breaks; it is a question of whether to bump.

## The forks side by side

| | suncalc 1.9.0 | suncalc2 1.8.1 | suncalc3 2.0.5 | suncalc-ts 3.1.1 | suncalc 2.1.2 |
|---|---|---|---|---|---|
| Repo | mourner/suncalc | andiling/suncalc2 | hypnos3/suncalc3 | e-adrien/suncalc-ts | mourner/suncalc |
| Forked from | | mourner/suncalc | mourner/suncalc | andiling/suncalc2 | |
| Types | none | none | `suncalc.d.ts` | `dist/index.d.ts` | built in |
| Angles | radians | radians | radians, plus `...Degrees` fields | radians | degrees |
| Azimuth from | south, toward west | south | south | south | north, clockwise |
| Height, utcOffset, Moon transit | no | no | `height`, `inUTC`, `moonTransit` | no | yes |
| No event | invalid `Date` | invalid `Date` | `NaN` date | invalid `Date` | `null` |
| npm `license` field | (not read here) | absent | absent | absent | (not read here) |
| Repo licence | BSD-2-Clause | BSD-2-Clause by the sidebar; LICENSE file is Agafonkin's BSD text | same | same | same |
| Oracle use | already (devDependency) | no | no | no | already |

## Licence findings (read 2026-11-17)

- **suncalc2** (https://github.com/andiling/suncalc2): `package.json` on `master` has no `license` field (https://raw.githubusercontent.com/andiling/suncalc2/master/package.json). The repo sidebar shows "BSD-2-Clause license"; the README says "SunCalc is a tiny BSD-licensed JavaScript library." The LICENSE file (https://github.com/andiling/suncalc2/blob/master/LICENSE) opens "Copyright (c) 2014, Vladimir Agafonkin", then "All rights reserved.", and the BSD two-condition text; it does not name itself. So the licence on GitHub is the original author's BSD-2-Clause; the npm metadata is silent. The ticket's reading is right.
- **suncalc3** (https://github.com/hypnos3/suncalc3): sidebar "BSD-2-Clause license"; LICENSE (https://github.com/hypnos3/suncalc3/blob/master/LICENSE) opens "Copyright (c) 2014, Vladimir Agafonkin". `package.json` at 2.0.5 has no `license` field (https://raw.githubusercontent.com/hypnos3/suncalc3/master/package.json). The added code has no licence line of its own that the page showed.
- **suncalc-ts** (https://github.com/e-adrien/suncalc-ts): sidebar "BSD-2-Clause"; LICENSE (https://github.com/e-adrien/suncalc-ts/blob/main/LICENSE) opens "Copyright (c) 2014, Vladimir Agafonkin"; `package.json` 3.1.1 has no `license` field (https://raw.githubusercontent.com/e-adrien/suncalc-ts/main/package.json) and npm.io shows none.
- **suncalc 2.x upstream** (https://github.com/mourner/suncalc/blob/master/LICENSE): "Copyright (c) 2026, Volodymyr Agafonkin", "All rights reserved."; BSD two-clause text.

Reading: all three forks carry the upstream BSD-2-Clause text (the licence of a dev-only oracle would be satisfied by keeping the notice) but **none declares a licence in its npm metadata**, so a tool that reads npm (licence checkers, `pnpm licenses`) would flag them as unlicensed. The fetch tool summarised the LICENSE files; it said none names the licence in the file, which is normal for the BSD text. These are readings of a summarised page, and a human check of the three files is cheap.

Recommendation: **do not add suncalc2, suncalc3 or suncalc-ts as oracles.** suncalc2 is suncalc 1 with one change (the nadir moved from past to future, per its changelog); suncalc-ts is suncalc2 retyped; both would give numbers suncalc 1.9.0 already gives, and cost an "unlicensed in metadata" flag. suncalc3 differs mainly in names and extra functions, which the oracle grid would not compare anyway. If John wants the nadir difference tested, it can be a fixed expectation in our own test, with no package.

## What the forks add over suncalc 2.1

From the READMEs (suncalc3: https://github.com/hypnos3/suncalc3, README; suncalc-ts: https://github.com/e-adrien/suncalc-ts, README). **suncalc-ts adds nothing**: its README is suncalc 1's with a new package name and types. suncalc3 adds:

| suncalc3 addition | What it does | Covered by wakusei? |
|---|---|---|
| `getSunTime(date, lat, lng, elevationAngle, height, degree, inUTC)` | rise and set of the Sun at any elevation | **Partly**: `addTime` plus `getTimes` gives it, but not as one call |
| `getSunTimeByAzimuth(date, lat, lng, azimuth, degree)` | when the Sun reaches an azimuth | **No** |
| `getSolarTime(date, utcOffset, lng)` | solar time | **No** (`localSolarTime` in `src/places.ts` is for other bodies, not this call) |
| `getMoonData(date, lat, lng)` | Moon position, illumination and zenith angle in one | **No** (three calls give it) |
| `moonTransit(rise, set, lat, lng)` | the Moon's transit and lower transit | **Yes**: `getMoonTimes` gives `transit` and `lowerTransit` |
| `getMoonIllumination().phase` object (id, name, emoji, css), `moonCycles` | one of eight named phases | **No** (only the number 0 to 1) |
| `getMoonIllumination().next` | dates of the next new, first quarter, full and third quarter Moon | **No** |
| `getPosition` extras: `zenith`, `declination`, and `azimuthDegrees`, `altitudeDegrees`, `parallacticAngleDegrees` on moon | convenience fields | **No**; degrees are the default in `/suncalc` |
| `getSunTimes` (renamed `getTimes`) with `addDeprecated`, `timesDeprecated`, `addDeprecatedTimeName`; new names (`civilDawn`, `astronomicalDawn`, `goldenHourDuskStart` and others) and blue hour times | alias names and extra times | **No** (a rename; blue hour is one `addTime` call) |
| `addTime(angle, riseName, setName, risePos, setPos)` | positions attached | **No** |
| per-time `pos` and `elevation` in `getSunTimes` | Sun position at each time | **No** |
| `inUTC` on sun times, `height` | UTC day, observer height | **Covered** by `utcOffset` and `height` |

The README of suncalc3 contradicts itself on the deprecated names (sunrise maps to `sunriseEnd` in one table and `sunriseStart` in another), so any alias support should wait for a read of its source by a person, not a copy.

## Plan for the missing parts

1. **Oracle grid for legacy (no download).** Extend `test/suncalc.test.ts` with suncalc 1.9.0 (`suncalc1`, already there): legacy Sun azimuth against its azimuth to 0.01 rad, `getMoonPosition` altitude, azimuth and distance to the Moon-theory limit, and `getTimes` solar noon and sunrise within the limit its missing delta T allows (measure first, then loosen a little, as the existing tests do). Same grid of places and days.
2. **Additions worth making to `/suncalc`**, all pure functions on the same engine, none from the forks' code, each a separate ticket so John can pick: (a) `getMoonPhases`-style next-phase dates (new, first quarter, full, last quarter), which the Moon theory supports with a root find on the phase angle; (b) the Sun's time at an azimuth; (c) a named phase (eight names) as a plain function, English only, names left to the app for JA. Leave out suncalc3's alias names and `...Degrees` fields.
3. **Not in `/suncalc/legacy`.** The legacy entry exists so old code changes one import; it should not grow suncalc3's names. If a suncalc3 user is wanted, a third thin entry is possible, but only after (2) and only on John's yes.
4. **NOTICE.** When oracle step 1 lands, `NOTICE.md` already names suncalc 1.9.0; no change. If a fork were ever used, its licence line would go there.

## What John must approve

- Not adding suncalc2, suncalc3 or suncalc-ts as devDependencies (recommended). Adding any is a download and a new dependency; none was installed.
- Whether to bump suncalc 2.1.2 to 2.1.4 if that version exists (unchecked).
- Which of the additions in plan step 2 become tickets.
- A third sub-path for suncalc3's names (not recommended now).
