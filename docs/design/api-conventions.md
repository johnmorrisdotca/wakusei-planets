# API conventions (DRAFT 3)

**Status: a draft for John to read and change. Not published on the docs site, not in the README, not a promise.** Nothing here is built unless it says "today". Tickets: MODULES-540 and MODULES-552. Each feature's own design page will name the ticket that builds it.

**Reviewed by:** John, and a second developer (2026-11-07, two rounds), whose points are built in below and marked (R). Every open question of draft 2 is now answered.

The ambition is one consistent API for the whole sky, so that someone who finds this package rarely needs another. That is a long-term aim. For 1.0 the promise is smaller and firmer: **positions and time** (R). Sky events are designed now, so the foundations are tested against them, and ship as explicitly experimental during 0.x until their search bounds, local-day meaning, missing-event behaviour and accuracy are validated.

## What is true today

- A body is a `BodyId` (`"mars"`, `"io"`, `"sun"`); a planet that can host moons is a `HostId`.
- A function takes the body first and the time second: `apparent(id, time)`, `heliocentric(planet, ms)`, `system(planet, time)`.
- A time is a number of milliseconds since 1970, taken as UTC.
- A vector is a `Vec3` tuple, in astronomical units or kilometres as the function says. Angles are degrees. Results are plain objects.
- The pure side (`apparent`, `heliocentric`, `system`, `orbitPath`, `lineSvg`) runs on a server with no browser.

## Audit of today's API (2026-11-07)

Read from the exports. Ticket: MODULES-552.

| # | What is inconsistent today | Proposed fix | Old name |
|---|---|---|---|
| 1 | The time is `ms` in `heliocentric`, `moonVector`, `moonGeocentric`, `stopPlaceAu` and `time` in `apparent`, `system`, `orbitPath` | one name, `when`, in every signature (parameter names are not API) | none needed |
| 2 | `radiusKm`, `distanceKm`, `escapeKmS`, `sunAu`, `massKg` carry a unit; `MoonPlace` has a bare `distance` and `x`, `y`, `z` in planet radii | lengths always carry a unit; `MoonPlace` gets `distancePlanetRadii` and a named position | keep `distance`, `x`, `y`, `z` with the same values until 1.0 |
| 3 | `diameterDeg` carries a suffix, other angles do not | angles never carry a suffix: `angularDiameter` | keep `diameterDeg`, same value |
| 4 | positions are `Vec3` tuples, except `MoonPlace` (named) and `orbitPath` (a flat `Float32Array`) | named objects for people, tuples or typed arrays for numerical and renderer interfaces, each saying which | none |
| 5 | some functions take an id, others a whole `BodyFacts` (`drawnTilt`, `polarRatio`, `ringReach`, `ringStrip`) | both are legitimate: a calculation from supplied facts may differ from a lookup (R). Keep them, but name and document the facts versions as such | none |
| 6 | six names for "where is it": `heliocentric`, `moonVector`, `moonGeocentric`, `stopPlaceAu`, `apparent`, `system` | specific names, one per meaning (rule 5); each old name says in its doc comment which new call it equals | all six stay until 1.0 |
| 7 | `stopPlaceAu` is the name that most needs the docs (R); nouns and verbs are mixed | a plain noun for a thing, a verb for an action; renamed in the glossary (rule 8) | stays as an alias |

## The rules

### 0. Scientific meaning is never optional (R)

Units, frames, corrections and defaults are always knowable from the name, the type or the doc comment. Only extra detail such as the model that made a number may be optional metadata (rule 11).

### 1. The shape of a call (R)

`(body, when, options)`: two positional essentials, then one options object for everything else. Four positional slots end in `undefined` placeholders; an object for absolutely everything repeats labels for nothing.

An observer is required where it matters, inside the options, and separate meanings are separate functions, so a function is never given an optional observer just to look like the others. Consistent meaning matters more than identical arity.

```ts no-run
heliocentricPosition("mars", when);
horizontalPosition("mars", when, { observer: { latitude: 49.3, longitude: -123.1, heightM: 0 }, refraction: "none" });
```

### 2. A time (R)

`when` is a `Date` or a number: Unix epoch milliseconds, as JavaScript counts them (leap seconds are not counted). It is normalised on entry. A `Date` is never mutated; an invalid date or a non-finite number throws; a number is never guessed to be seconds. Everything is UTC at the door; the conversion to the scale a theory needs happens inside (MODULES-538).

The exact instant `{ day, ms }` lives in `/time`, and always states its epoch (the Julian day number, days starting at noon) and its time scale. Event times (rise, set, transit) are always `Date`, whatever the input was; a result that echoes the moment (`time`) is always milliseconds.

### 3. An observer

`{ latitude, longitude, heightM }`: degrees north, degrees east (west negative), and metres above mean sea level (the reference is stated in the doc comment; it changes the horizon by a fraction of a degree). The full words, never `lat` or `lng` (the legacy suncalc sub-path keeps its own `lat` and `lng`, rule 10). A latitude outside -90 to 90 throws a `RangeError` with the value in the message. `heightM` defaults to 0, and a function sensitive to it says so.

### 4. Units, ranges and directions (R)

Angles are degrees everywhere and never carry a suffix, because there is one angle unit. That includes right ascension: degrees from 0 to 360, never hours. A length or a speed always carries its unit: `distanceKm`, `distanceAu`, `radiusKm`, `speedKmS`, `heightM`. The legacy suncalc sub-path keeps radians and a south-based azimuth and is documented as the exception.

| Quantity | Name | Range and direction |
|---|---|---|
| height above the horizon | `altitude` | -90 to 90, apparent only where `refraction` says so |
| compass direction | `azimuth` | 0 to 360, 0 is north, clockwise |
| longitude of a place | `longitude` | -180 to 180, east positive |
| right ascension | `rightAscension` | 0 to 360 degrees |
| declination | `declination` | -90 to 90 |
| ecliptic longitude and latitude | `eclipticLongitude`, `eclipticLatitude` | 0 to 360, -90 to 90 |
| central meridian | `centralMeridian` | 0 to 360, increasing as the body turns |
| angle Sun-body-observer | `phaseAngle` | 0 to 180 |
| fraction of the disc lit | `illuminatedFraction` | 0 to 1 |
| the cycle of a moon or planet | `phase` | 0 to 1, 0 is new |
| size on the sky | `angularDiameter` | degrees (a physical size is `radiusKm`) |

### 5. What a position means (R)

Every position states its **origin** (heliocentric, geocentric, topocentric), its **frame** and the frame's **epoch** (`eclipticJ2000`, `equatorialJ2000`, `equatorialOfDate`, `horizontal`) and its **corrections** (`geometric`, `apparent`: light time, aberration, precession and nutation; `refracted`). A unit suffix says what a number is measured in; it does not say what coordinate system it is in, so each result type defines all four. There is no function called just `position`. The names carry the meaning, and the result echoes it:

`heliocentricPosition`, `geocentricPosition`, `horizontalPosition`, `equatorialPosition`, each with documented defaults and the same facts in the result (`origin`, `frame`, `epoch`, `corrections`).

### 6. Results

A result for people is a named object. A Cartesian position is `{ xKm, yKm, zKm }` (or `xAu`, `yAu`, `zAu`) (R): the components are lengths too, so they follow the length rule, and a destructured value is still understood. Tuples and typed arrays stay for numerical and renderer interfaces, and say so. A frame is always named, never implied.

### 7. Events and intervals (R)

"The next rise" and "the rises on this local date" are different questions with different functions:

```ts no-run
nextRise("moon", from, { observer, within: { days: 3 } });
riseSetTimes("moon", date, { observer, timeZone: "America/Vancouver" });   // or "-08:00"
```

A calendar-day query needs an explicit time zone, and the machine's zone is never assumed (R). `timeZone` is a string: an IANA name (`"America/Vancouver"`, which carries historical and daylight-saving rules) or a fixed offset (`"-08:00"`, which deliberately does not). If minutes are wanted, they are a separate `offsetMinutes` field, positive east of UTC, mutually exclusive with `timeZone`. A zone belongs to calendar-day queries and to formatting; the position of an instant does not need one, and the zone is not part of the observer. A search interval states its bounds: the start is included and the end is not.

Event functions (`nextRise`, `riseSetTimes`, `findEclipses` and the rest) are **experimental during 0.x**: exported under `/sky`, marked `@experimental` in their doc comments and the docs, until validated.

An event that does not happen in the interval is `null`. The horizon's status over the interval is one field, `"crosses"`, `"above"` or `"below"`, not two independent booleans (a Moon rise without a set in one day is legitimate, and is not polar night). Invalid input throws; a numerical failure throws with a message. The legacy suncalc sub-path keeps `alwaysUp` and `alwaysDown`.

### 8. Names

camelCase; a plain noun for a thing and a verb for an action; the same word for the same job in every sub-path. `illuminatedFraction` is 0 to 1, `phaseAngle` is an angle, `phase` is the cycle; "times" alone is too vague, so `riseSetTimes`, `nextRise`, `findEclipses`. `apparent` stays but its doc comment says which coordinates and corrections it returns. `stopPlaceAu` stays as an alias of a clearer name.

### 9. Errors

Invalid input throws a `RangeError` or `TypeError` with the argument's name and the value. No function returns `NaN` for bad input and none fails silently.

### 10. Where it lives, and what it may import (R)

Sub-paths, so a page pays only for what it imports: `/time`, `/sky`, `/suncalc`, `/suncalc/legacy`, `/stars`, `/bodies`. A sub-path does not guarantee a small bundle, so it is checked: the import graph of each sub-path must not reach rendering, browser globals, textures or the star catalogue, and each has a size budget. The core imports nothing from a peer. The pure side never needs a browser.

### 11. Compatibility and provenance (R)

An alias keeps the old **behaviour**, not only the old name: the same fields, units and defaults. A public export snapshot catches a renamed or removed name; **known-answer tests for the old names** catch a changed value, unit or default. Nothing that exists is removed or renamed before 1.0.

A result may carry the model that made it (`{ theory, timeScale }`): optional metadata, off by default, `{ provenance: true }` adds it. Units, frames and corrections are never optional.

### 12. Accuracy and range

A calculation that works "for any date" publishes its supported range and its measured error by body and by calculation (a position check does not establish eclipse-timing accuracy). Outside the range it still answers and says so.

## Decisions

**Settled in review (2026-11-07):**
- the shape `(body, when, options)`, with `observer` (`{ latitude, longitude, heightM }`, height reference documented, no time zone inside it);
- `Date` and milliseconds both accepted;
- `timeZone` as a string (IANA name or fixed offset such as `"-08:00"`), or a separate `offsetMinutes` (positive east of UTC), never both; zones only for calendar-day queries and formatting;
- angles without a suffix, lengths with one, including the components `xKm`, `yKm`, `zKm` (or `xAu`...);
- each result type defines its origin, frame, epoch and corrections;
- specific position names; interval-scoped events and one horizon status, events experimental in 0.x;
- behaviour-preserving aliases; verified import graphs and size budgets;
- the first stable promise is positions and time.

**Still open:** none from the reviews. A new question comes up when the first function is written to this draft; each design page lists its own.

## How each rule is tested

A type test for each result shape and unit, and for the `timeZone` and `offsetMinutes` exclusion; a property test that a `Date` and the same milliseconds give the same answer; a grid test with no `NaN` over both poles and the date line; an import-graph test and a size budget for each sub-path; known-answer tests for every old name that becomes an alias; an interval test for events (a Moon with a rise and no set in the day, a polar day, endpoints included and excluded). See MODULES-551 and 552.
