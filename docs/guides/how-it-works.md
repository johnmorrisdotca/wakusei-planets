---
title: How it works
section: explanation
order: 9
description: Where the numbers come from, how a body is turned toward you and why a page of them stays light.
---

## The numbers

Sizes, flattening, poles and rotation are the IAU's (Archinal et al., 2018) with NASA's fact sheets. Mercury to Neptune are the VSOP87B series of Bretagnon and Francou, cut down and run in terrestrial time; Pluto is a table fitted to Horizons; the Moon's are the lunar solution ELP2000-82B (Chapront-Touzé and Chapront, IMCCE) cut to its 540 largest terms. The other moons are fitted to JPL Horizons' positions for 1950 to 2050. The tests compare every planet, the Moon and every moon with Horizons ([Accuracy](accuracy.md)), and check that Saturn's rings are edge-on in March 2025 and that the Moon is new and full on the right days.

## A place to go

`JOURNEY_STOPS` is every body, one row each: the name, the kind, a moon's parent, the radius, the mean distance from the Sun (`sunAu`; 0 for the Sun, a moon's parent's distance), the gravitational parameter `gmKm3s2`, the mass and the escape speed `escapeKmS`. `stopPlaceAu(id, ms)` is where it is in the Sun's frame, in astronomical units, at a date. The Sun is the origin, a planet or a dwarf planet comes from `heliocentric`, and a moon is its parent plus its offset. Where no page gives a mass, the gravity fields are empty. There is no star here but the Sun.

## A body turned toward you

For a date, the package works out the pole, the prime meridian and the Sun's direction in the viewer's frame (x to the right, y up, z toward you). Both drawings and the shaders use that one pose. Light travel time is allowed for, so Jupiter shows the face it showed when the light left.

## The shaded look

A sphere with a shader: bands, craters, spots and caps are worked out from the body's latitude and longitude, lit by the Sun's direction with the terminator softened by its air, with the rings casting shadows on the planet and the planet on the rings. Height drives the shading of craters.

## Staying light

Nothing is drawn until something changes; a moving picture is drawn at most thirty times a second; the shared renderer owns the one WebGL context; textures start small. The tests count draws, animation frames, contexts and GPU objects at rest and over a run of changes.
