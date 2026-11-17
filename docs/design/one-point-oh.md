# The 1.0 criteria (DRAFT 1)

**Status: a draft for John's review. Not published on the docs site.** Built from the conventions draft (`api-conventions.md`, MODULES-540 and 552): its promise is that 1.0 is firm about **positions and time** and ships sky events as experimental. Each item is marked done, partly or not yet, with the evidence in the code at 69b33ca (version 0.60.0). The ticket's own wording of the quality bar was not available to the author of this draft, so the items follow the conventions' rules; John should compare them with the ticket.

## Checklist

### The surface is held still
- [x] **done** A public API snapshot: every export of every entry point with its signature (`test/api-snapshot.test.ts`, `test/api-snapshot.txt`, `pnpm api:update`; 833 exports, 97 entry points).
- [ ] **not yet** Known-answer tests for every old name that becomes an alias (rule 11); there are no aliases yet.
- [x] **done** A size budget per entry point (`pnpm size:budget`, `scripts/size-baseline.json`; only on branch feat/551-test-floors at the time of writing).

### Names and shapes (rules 1, 2, 4, 5, 6, 8)
- [ ] **not yet** One name for the moment, `when: When`, in every signature: the newer entries use it (56 signatures); 27 use `ms`, 24 `time`, 13 `t`, 14 `date`.
- [ ] **not yet** Angles never carry a suffix: `diameterDeg`, `rightAscensionDeg`, `declinationDeg`, `elongationDeg`, `phaseAngleDeg`, `tiltDeg` exist.
- [~] **partly** Lengths carry a unit: `radiusKm`, `distanceKm`, `distanceAu` and the like do; `MoonPlace.distance`, `x`, `y`, `z` do not.
- [ ] **not yet** Named position results; `Vec3` tuples remain the norm, `MoonPlace` and `orbitPath` differ.
- [ ] **not yet** Position names that state origin, frame, epoch and corrections (`heliocentricPosition` and the rest); `moonGeocentric`, `stopPlaceAu` and `heliocentric` remain.
- [ ] **not yet** An observer `{ latitude, longitude, heightM }` and the `(body, when, options)` call shape for the sky functions.

### Time and meaning (rules 0, 2, 12)
- [~] **partly** `When` (a `Date` or milliseconds) is accepted by the newer entries; the older pure functions take a number only. A time scale is stated by `/time` (`src/time.ts`, `src/clock.ts`).
- [~] **partly** Accuracy is published: the `accuracy` guide and `test/accuracy*.test.ts`, `test/comparison.test.ts` and the per-body tests compare with JPL Horizons; not every calculation states a supported range.
- [ ] **not yet** Every position states its origin, frame, epoch and corrections in its result type.

### Errors and events (rules 7, 9)
- [~] **partly** Invalid input throws: 30 source files throw `RangeError` or `TypeError` and 24 test files assert it; a grid test with no `NaN` over the poles and the date line is not written.
- [~] **partly** Events: `src/sky/events.ts` exists and `/sky-bodies` is an entry; the experimental marking, the interval functions and the one horizon status are not in the conventions' form yet.

### Structure (rule 10)
- [~] **partly** Sub-paths so a page pays for what it imports (97 entry points); an import-graph test that a pure sub-path never reaches rendering, browser globals or textures is not written (`test/lazy-size.test.ts` covers part).
- [x] **done** Coverage floor and size budget in CI (feat/551-test-floors) and the "How we test" guide.

### Release (1.0 itself)
- [ ] **not yet** John has settled the conventions and the migration plan; every old name has its alias and its known-answer test; the deprecation notes are in the doc comments.
- [ ] **not yet** The first stable promise is written down (positions and time) with the experimental list (events) beside it.
- [ ] **not yet** A decision on what, if anything, 1.0 removes: nothing is removed before it (rule 11).
