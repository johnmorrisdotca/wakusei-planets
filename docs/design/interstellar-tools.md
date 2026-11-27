# interstellar-tools: what this package takes

Ticket: MODULES-530. Decision only. Nothing from that monorepo is copied, and this package does not depend on it. No `NOTICE.md` entry, because none of its text or numbers is shipped.

The package is MIT, one maintainer, and still on 0.x versions (read 2026-11-07; the licence line was read again on 2026-11-17, in `docs/design/ephemeris-survey.md`). A dependency would need a yes, and would be an optional peer or a dev tool, never the core. That yes is not given. Its own README calls the equations not yet battle-tested. Its Sun and Moon series is a short series, coarser than the positions this package already computes, so it is not an accuracy source.

Each piece:

| Piece | Decision |
|---|---|
| Shared types | Leave. They are tuples and result shapes, not data. |
| Body tables (planets, moons, asteroids, comets, belts, stars, galaxies) | Do not copy. The names are a checklist for the small-body work (MODULES-529). Every number is regenerated from JPL's Small-Body Database, or left out. |
| Time scales and the leap-second table | Skip theirs. This package keeps its own scales. |
| Equations (atmosphere, gravity, third body, entry, transfers) | Leave them here. They belong with the rocket work, not with this package. |
| Tracking (SGP4, TLE, passes, look angles, ground tracks) | Leave them here. They belong with the Earth-satellite work. |
| Maps and projections | Leave them here. A flat map of a body, if it is built, is our own maths (MODULES-546). |
| Sun and Moon position series | Leave. Coarser than what we already ship. |

Checked by reading the ticket's own survey and the licence line already recorded. Their source was not installed and not run for this decision.
