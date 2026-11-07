---
title: Accuracy
section: explanation
order: 12
description: How far the planets' and moons' positions are from JPL Horizons, body by body, and how each was made.
---

The positions are checked against NASA's JPL Horizons, the reference for the sky. `test/accuracy.test.ts` compares every planet, the Moon and every moon with Horizons on several dates, and fails if any body is further away than the limit below. The numbers are the worst of those dates, as a direction (the angle between the two answers, seen from the Sun for a planet and from the planet for a moon), not a distance.

For a picture, one degree on a moon's orbit is about the width of the moon's own disc on a screen; an arc-minute is a fraction of a pixel.

## Planets

Planet positions are JPL's approximate Keplerian elements for 1800 to 2050, a polynomial for each planet. They are small and fast, and JPL gives them as approximate. Checked on five dates from 1800 to 2050.

| Body | Worst measured | Held to |
|---|---|---|
| Mercury | 41″ | 60″ |
| Venus | 14″ | 25″ |
| Earth | 8″ | 15″ |
| Mars | 58″ | 90″ |
| Jupiter | 309″ (5′) | 450″ |
| Saturn | 545″ (9′) | 800″ |
| Uranus | 79″ | 120″ |
| Neptune | 45″ | 70″ |
| Pluto | 39″ | 60″ |

An arc-second is 1/3600 of a degree. Jupiter and Saturn are the loosest: the table has no correction for their pull on each other.

## The Moon and the moons

The Moon is the largest terms of Meeus's series. Every other moon's orbit is fitted to Horizons' own positions and velocities for 1950 to 2050: a mean orbit plane, a mean longitude that moves at a steady rate, and a periapsis and node that turn at steady rates. Where a steady rate is not enough, a moon has one more term: Phobos, whose orbit is shrinking, has an acceleration, and Mimas and Tethys, which pull on each other, swing back and forth over about 70 years. Checked on seven dates from 1900 to 2100, so the table includes 50 years either side of the fitted window.

| Body | Worst measured | Held to |
|---|---|---|
| The Moon | 0.21° | 0.3° |
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
