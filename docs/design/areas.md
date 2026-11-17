# Design pages by area (DRAFT 1, for John's review)

**Status: a draft for John's review. Not published, not a promise.** Ticket: MODULES-540. One section for each area the ticket names, written on top of `api-conventions.md` (rules cited as "rule N"). Every example is marked `no-run`: the call does not exist yet unless the section says "today". Each section names the ticket that would build it, what is true today, and what John must decide. No number appears here that has no Horizons measurement; where a limit is wanted, the section says which Horizons request would give it.

Longer plans already written are linked, not repeated: the sky-events hand-off plan (handoffs, 2026-11-17) (sky events), the core-stats hand-off plan (handoffs, 2026-11-17) (fact sheets and core stats), the 539 hand-off plan (handoffs, 2026-11-17) (the sky behind), `suncalc-forks.md` (on branch docs/537-suncalc-legacy).

## 1. Time (MODULES-538)

**Today.** `/time` exports Julian date functions, calendars, `deltaT`, sidereal time and Mars time. Newer entries accept `When` (a `Date` or milliseconds); older pure functions take only a number (see `migration-plan.md`, item 1).

**Proposed (rule 2).** A time is a `Date` or milliseconds, normalised on entry. The exact instant is `{ day, ms }` in `/time`, always stating its epoch and its time scale. A result that depends on a scale says which (UTC, UT1, TT, TDB).

```ts no-run
import { instant, toScale } from "@johnmorrisdotca/wakusei-planets/time";

const t = instant(new Date("2026-11-17T12:00:00Z"));      // { day, ms, scale: "UTC" }
toScale(t, "TT");                                          // { day, ms, scale: "TT" }
```

**Test.** Round trips between scales; the whole-day and millisecond split never loses a millisecond over the supported range; the UT1 minus UTC limit is stated, not hidden (the 0.9 s floor already noted in `scripts/compare/README.md`). An accuracy claim for the conversions needs a Horizons UT and TDB table: **not measured**.

**Decide.** Is `scale` a field of the instant or a separate argument? Does an unknown future UT1 minus UTC throw, or answer with a flag?

## 2. Positions (MODULES-528)

**Today.** `heliocentric`, `apparent`, `system` and the moon calls, held to the limits in `test/accuracy*.test.ts` and listed in `docs/guides/accuracy.md`. Six names for "where is it" (`migration-plan.md`, item 5).

**Proposed (rules 5 and 6).** Names that carry the meaning, results that state origin, frame, epoch and corrections:

```ts no-run
const p = heliocentricPosition("mars", when);
// { xAu, yAu, zAu, origin: "heliocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric" }

const h = horizontalPosition("mars", when, { observer: { latitude: 49.3, longitude: -123.1, heightM: 0 }, refraction: "none" });
// { altitude, azimuth, distanceKm, origin: "topocentric", frame: "horizontal", corrections: "apparent" }
```

**Test.** The existing Horizons grid, run through the new names and compared with the old ones to the last digit (known-answer tests first, per rule 11). The topocentric case is checked against the Horizons observer table already in `scripts/compare/horizons-observer.json` (at one place); further places need a new Horizons request.

**Decide.** `refraction` default: `"none"` (as the conventions say airless) or a standard atmosphere. Name of the apparent-place option.

## 3. Sky events (MODULES-534)

**Today.** The Sun and Moon rise, set and transit by calendar day, within 1 s of Horizons (`rise-set-limits.json`). Nothing for planets, seasons, phases, apsides, eclipses, alignments or libration. `src/sky/` is internal; `./sky` is reserved by rule 7.

**Proposed.** The plan is the sky-events hand-off plan (handoffs, 2026-11-17): an experimental `./sky` entry wrapping astronomy-engine as an optional peer, `topocentricEquatorial` native, Jupiter's moons and constellations not wrapped. The shape, from rule 7:

```ts no-run
nextRise("venus", from, { observer, within: { days: 3 } });          // Date | null
riseSetTimes("moon", date, { observer, timeZone: "America/Vancouver" }); // { rise, set, transit, horizon: "crosses" | "above" | "below" }
seasons(2027);                                                        // { marchEquinox, juneSolstice, septemberEquinox, decemberSolstice }
findEclipses(from, to);                                               // [{ type, kind, peak, magnitude? }]
```

**Test.** Per event, from the plan's section 3 (Horizons observer tables, USNO tables, the NASA eclipse canon), each read one page at a time. Accuracy per event is **not measured** except the Sun and Moon rise and set.

**Decide.** The eight questions at the end of the plan (peer versus bundled, the missing-peer error, whether `topocentricEquatorial` is native). A calendar-day query needs a `timeZone` (rule 7): confirm there is no machine-zone default even for the Sun and Moon calls that exist today.

## 4. The suncalc superset (MODULES-535, 537)

**Today.** `/suncalc` (degrees, azimuth from north, `null` for no event) and `/suncalc/legacy` (radians, azimuth from south, invalid `Date` for no event), one engine and a thin adapter. The forks audit is `suncalc-forks.md`: it recommends not adding suncalc2, suncalc3 or suncalc-ts as oracles and lists what suncalc3 adds that `/suncalc` lacks.

**Proposed.** Three additions as separate tickets (from `suncalc-forks.md`, plan step 2): next-phase dates, the Sun's time at an azimuth, a named phase. Nothing from the forks' code. Legacy stays a one-import migration and does not grow the forks' names.

```ts no-run
import { nextMoonPhase } from "@johnmorrisdotca/wakusei-planets/suncalc";

nextMoonPhase(new Date("2026-11-17"), { phase: "full" });   // Date
```

**Test.** The legacy grid against suncalc 1.9.0 (already a dev dependency): Sun azimuth, Moon position, `getTimes`, limits to be measured first and then set (rule 12). Times against Horizons.

**Decide.** The four decisions at the end of `suncalc-forks.md`.

## 5. Stars and constellations (MODULES-539)

**Today.** `/stars` has the Yale bright stars; the space view draws no star backdrop. hoshi-stars already holds the constellations, lines, boundaries, Milky Way and deep sky (see the 539 plan).

**Proposed.** One owner for each table: hoshi-stars owns every table; wakusei-planets draws a backdrop from them, taking hoshi-stars as an optional peer (the chikyu-earth pattern), black sky when absent. The direction stays one way.

```html no-run
<wakusei-space sky="stars"></wakusei-space>   // draws hoshi-stars' tables behind the planets when the peer is installed
```

**Test.** The freeze test (one draw at a time, nothing at rest) stays green with the backdrop; the backdrop is one instanced draw. A planet against a star in the picture agrees with the sky position from Horizons: **not measured**.

**Decide.** The `/stars` duplicate: re-export hoshi's bright tier (needs hoshi as a dependency of that entry) or deprecate it. A new optional peer needs John's yes. The licence questions the 539 plan lists are not wakusei's to settle.

## 6. Comets, asteroids, meteor showers and the fact sheets (MODULES-529, 558, 732)

**Today.** `/asteroids` and `/comets` (about a hundred and a few well-known bodies), `/belts` (seven belts of numbered bodies, with filters and tiers on branch `feat/558-belt-meta`), `BodyFacts`. No meteor showers.

**Proposed.** Meteor showers as a small pure table (name, radiant, peak date, parent body) from a cited source, each with a source in NOTICE. Fact sheets move to the shared `Stat` shape in the core-stats plan: every number carries its source, whether it is measured or estimated, and the date read. A missing value is absent, never zero.

```ts no-run
const stat = bodyStats("mars").massKg;
// { value, error?, basis: "measured", source: "nasa-planetary-fact-sheet", read: "2026-11-17" }
```

**Test.** A conformance test that every field has a source and a read date; belt bodies are two-body orbits at one epoch, so a belt position against Horizons is **not measured** and must be before any claim.

**Decide.** The six decisions at the end of the core-stats plan. Whether meteor-shower data is wanted here or in a separate package.

## 7. The space view (MODULES-518)

**Today.** `<wakusei-space>` draws the Sun, planets, moons, belts, craft and the Roadster through the shared renderer; goTo, ride, belts flight, a labelled Oort shell.

**Proposed.** This area is about the element, not the numbers: one way to ask for a look (conventions: one way to pick a look), one name for the same thing as the other packages (altitude, azimuth, illumination, phase, magnitude), and the pure side never importing the view.

```html no-run
<wakusei-space look="realistic" at="mars" when="2026-11-17T12:00:00Z"></wakusei-space>
```

**Test.** The freeze test, the usage examples, the import-graph rule (a pure sub-path never reaches rendering).

**Decide.** Which attributes are renamed in 1.0 (each rename keeps its old name until then, rule 11).

## 8. Swiss Ephemeris style results (MODULES-536)

**Today.** None. The ticket says an astrology package is a new package (low priority) and that results of that style stay here only from public sources.

**Proposed.** Nothing until John decides. If it goes ahead: ecliptic longitude and latitude, speed in longitude, retrograde flag, lunar nodes and house cusps for a place, each as a plain pure function with the result shape of rule 5. Swiss Ephemeris itself is licensed AGPL or commercial, so it is never a source or an oracle here.

```ts no-run
eclipticPosition("mars", when);   // { eclipticLongitude, eclipticLatitude, speedLongitude, retrograde }
```

**Test.** Each quantity against a Horizons ecliptic observer table. **Not measured.** House systems have no Horizons reference: a house cusp would need a published formula and a worked example, or it is left out.

**Decide.** Whether this is wanted at all; a new package name needs John's yes (AGENTS.md).

## 9. Things all the sections share

- Every function that needs a place takes `{ latitude, longitude, heightM }` (rule 3) and a calendar-day question takes `timeZone` (rule 7).
- Every area lists its supported date range and its measured error from a Horizons table before it is called stable (rule 12). Until then it is experimental.
- A model note (`{ theory, timeScale }`) is optional metadata, never the meaning of a number (rule 11). The caelis-engine note on the ticket adds two test cases worth keeping: refraction in arc-minutes read as degrees, and sidereal time fed TT instead of UT1.
