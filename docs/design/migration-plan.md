# API migration plan (DRAFT 1)

**Status: every proposal below is for John's review. Nothing here is built.** No export in `src/` has been renamed or aliased, and none will be until John has read `api-conventions.md` and this page. Not published on the docs site. Tickets: MODULES-552, MODULES-540.

**The promise while this is open (conventions rule 11):** nothing that exists is removed or renamed before 1.0. A rename adds the new name beside the old one; the old name keeps its **behaviour** (fields, units, defaults), says in its doc comment which new call it equals, and is marked `@deprecated` with the one line below. `test/api-snapshot.txt` (`pnpm api:update`) catches a name or signature that changes; a known-answer test for each old name, written when its alias is, catches a changed value.

**How the snapshot helps:** the counts below are read from `test/api-snapshot.txt` (833 exports, 97 entry points, as of 69b33ca).

## 1. A moment: `ms`, `time`, `t`, `date`, `epoch` and `when`

*Today.* The moment's parameter is `ms: number` in 27 signatures (`heliocentric(planet, ms)`, `moonGeocentric(ms)`, `stopPlaceAu(id, ms)`), `time: number` in 24 (`apparent(id, time)`, `system(planet, time)`), `t` in 13, `date` in 14 and `when: When` in 56 of the newer entries (`/nearest`, `/approaches`, `/asteroids`, `/comets`). `When` (a `Date` or milliseconds) is already the package's normal door; the older pure functions take only a number.

*Proposal (for John's review).* One name, `when`, typed `When`, in every signature. A parameter's name is not API, so this changes no caller. The part that is API is the type: widening `number` to `When` accepts everything it accepted before.

*Alias kept.* None needed for the name. The widening is additive.

*Deprecation note.* None: no old name is being retired. The doc comments say "`ms` is `when`" until the signatures change.

## 2. Unit suffixes: lengths and angles

*Today.* Lengths carry a unit (`radiusKm` 10 times, `distanceKm` 10, `distanceAu` 6, `altitudeKm`, `sunAu`, `uncertaintyKm`), as rule 4 asks. Angles are inconsistent: `diameterDeg`, `rightAscensionDeg`, `declinationDeg`, `phaseAngleDeg`, `elongationDeg`, `tiltDeg` carry `Deg`, while `phaseAngle` and `centralMeridian` on `Apparent` do not; `MoonPlace` has a bare `distance` and unlabelled `x`, `y`, `z`; some names are shortened (`subObserverLat`, `centerLat`, `centerLon`, `showLon`); some quantities differ in name only (`Apparent.illumination` is the lit fraction the conventions call `illuminatedFraction`).

*Proposal (for John's review).* Angles never carry a suffix (rule 4): `angularDiameter`, `rightAscension`, `declination`, `elongation`, `tilt`; full words, not `Lat` and `Lon`: `subObserverLatitude`, `centerLatitude`, `centerLongitude`; `illumination` becomes `illuminatedFraction`. `MoonPlace` gets `distancePlanetRadii` and a named position (item 3). Where the doc comment does not say degrees, it will.

*Alias kept.* Every old field stays on the result with the same value (an object carrying both names until 1.0). An option that takes an old name keeps taking it.

*Deprecation note.* "`diameterDeg` is `angularDiameter`, in degrees. Removed no earlier than 1.0." (one line each, on the field.)

## 3. A position: `Vec3`, `x, y, z`, `Float32Array`

*Today.* 73 snapshot lines use `Vec3`. `MoonPlace` is the exception (named `x`, `y`, `z` in planet radii) and `orbitPath` returns a flat `Float32Array`.

*Proposal (for John's review).* The conventions' rule 6: a result for people is a named object, `{ xKm, yKm, zKm }` (or `xAu`...); tuples and typed arrays stay for numerical and renderer interfaces and their doc comment says so. A new family of functions returns the named object; the existing `Vec3` functions are not changed.

*Alias kept.* Every `Vec3` function and `orbitPath` stay as they are, as the "numerical" form. Nothing is replaced, so nothing needs an alias; the new calls are additions.

*Deprecation note.* None for the tuples. `MoonPlace.x, y, z, distance`: "in planet radii; see `distancePlanetRadii`".

## 4. An id or a `BodyFacts`

*Today.* `apparent(id, time)` and `system(planet, time)` take an id; `drawnTilt`, `polarRatio`, `ringReach` and `ringStrip(facts, width?)` take a whole `BodyFacts`.

*Proposal (for John's review).* Keep both (the second review judged them both legitimate: a calculation from supplied facts may differ from a lookup). Name the facts versions as such in their doc comments ("from the facts you give, not looked up by id"). If John prefers parallel names, `ringStripOf(id)` could be added beside `ringStrip(facts)`; this plan does not propose it.

*Alias kept.* None; nothing is renamed.

*Deprecation note.* None.

## 5. "Where is it": six names

*Today.* `heliocentric(planet, ms)`, `moonGeocentric(ms)`, `stopPlaceAu(id, ms)`, `apparent(id, time)`, `system(planet, time)` are exported through entry points; `moonVector` is exported by `src/ephemeris.ts` and used inside, but no entry point re-exports it, so it is not public today. All return different things (a `Vec3` in astronomical units, a `Vec3` in kilometres, an `Apparent`, a `System`).

*Proposal (for John's review).* Specific names, one per meaning (rule 5 of the conventions): `heliocentricPosition(body, when)` (origin, frame and units stated in the result), `geocentricPosition(body, when)`, and later `horizontalPosition(body, when, { observer })`. Each result says its origin, frame, epoch and corrections. `apparent` keeps its name but its doc comment says which coordinates and corrections it returns.

*Alias kept.* All five public names stay, unchanged in behaviour, until 1.0; each says in its doc comment which new call it equals ("`heliocentric(planet, ms)` equals `heliocentricPosition(planet, ms).positionAu`").

*Deprecation note.* "Use `heliocentricPosition`. Same values. Removed no earlier than 1.0."

## 6. Nouns and verbs; the name that needs the docs

*Today.* `stopPlaceAu` needs its doc comment to be understood; nouns and verbs are mixed (`apparent` is an adjective; `system` a noun for a thing the function computes).

*Proposal (for John's review).* A plain noun for a thing, a verb for an action (rule 8): `stopPlaceAu` becomes `stopPosition`; `system` stays a noun but its doc comment names what it returns; calculations that are events take verbs and intervals (`nextRise`, `riseSetTimes`, `findEclipses`: experimental in 0.x).

*Alias kept.* `stopPlaceAu` stays as an alias of `stopPosition`, same value and unit.

*Deprecation note.* "Use `stopPosition`. Same values. Removed no earlier than 1.0."

## Order and checks

1. Items 1 and 2 first: they add nothing and touch no behaviour (item 1), or add fields beside the old ones (item 2).
2. A known-answer test for each old name is written **before** its alias (so it records today's answer), then the alias and the snapshot update in one commit with a CHANGELOG line.
3. Items 5 and 6 after John has settled the names. Item 3 and 4 are additions or documentation only.
4. Nothing is removed before 1.0; what 1.0 removes, if anything, is a separate decision in `one-point-oh.md`.
