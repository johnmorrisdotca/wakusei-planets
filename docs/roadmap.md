# Roadmap

**Status: planned, not promised. Not a published guide, and not in the README.** Ticket: MODULES-540. A row says where that area stands on main. A measured error lives only in `docs/guides/accuracy.md`, which the tests hold against JPL Horizons. This page adds no new figure.

This package owns the bodies and their positions. A place on the Earth, the horizon and a satellite catalogue belong to chikyu-earth. The stars belong to hoshi-stars. The API shape under discussion is `docs/design/api-conventions.md`. The 1.0 checklist in `docs/design/one-point-oh.md` is a draft whose evidence line is from version 0.60.0, so it is not this table.

| Area | Ticket | On main | Still planned |
|---|---|---|---|
| Positions and time | 528 | The VSOP87B planets, the ELP Moon, and the time scales. | The 1.0 name cleanup, when that draft is settled. |
| Sky from a place | 534 | Rise, set and transit, phases, the Moon's age and lunation, eclipses, and the transits of Mercury and Venus. | The Moon covering a planet or a star, and an eclipse list in the demo. |
| A drop-in for suncalc | 535, 537 | `/suncalc` and `/suncalc/legacy`, with the guides. | suncalc3's extra calls. They are listed in the replacing-suncalc guide and not built. Which of them to build is open. |
| Fact sheets | 529 | Radius, year, day, known moons, NASA's page, and a short description, for the Sun, the planets and Pluto. | Meteor showers, and the definitions of planet, moon, asteroid and comet, after those sources' terms are read. |
| Comets and asteroids | 529 | `listComets` and `asteroidsOfKind`, from JPL's Small-Body Database. | |
| Orbital elements on file | 706 | Both JPL spans in the export. The positions the package computes are unchanged. | |
| interstellar-tools | 530 | Nothing copied and nothing depended on. The decision is `docs/design/interstellar-tools.md`. | |
| Astrology | 536 | Not in this package. | Houses and ayanamsa would be a new package. It is low priority and has no name yet. |

Which other package to reach for: `docs/guides/accuracy.md` compares this package with astronomy-engine and suncalc on the same samples. The licence record is `docs/design/ephemeris-survey.md`.
