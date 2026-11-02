---
title: How it works
section: explanation
order: 9
description: Where the numbers come from, how a body is turned toward you and why a page of them stays light.
---

## The numbers

Sizes, flattening, poles and rotation are the IAU's (Archinal et al., 2018) with NASA's fact sheets. Planet positions are JPL's approximate Keplerian elements; the Moon's are the largest terms of Meeus. The other moons use JPL's mean elements. The tests compare the Galilean moons and four planets with an independent library, and check that Saturn's rings are edge-on in March 2025 and that the Moon is new and full on the right days.

## A body turned toward you

For a date, the package works out the pole, the prime meridian and the Sun's direction in the viewer's frame (x to the right, y up, z toward you). Both drawings and the shaders use that one pose. Light travel time is allowed for, so Jupiter shows the face it showed when the light left.

## The shaded look

A sphere with a shader: bands, craters, spots and caps are worked out from the body's latitude and longitude, lit by the Sun's direction with the terminator softened by its air, with the rings casting shadows on the planet and the planet on the rings. Height drives the shading of craters.

## Staying light

Nothing is drawn until something changes; a moving picture is drawn at most thirty times a second; the shared renderer owns the one WebGL context; textures start small. The tests count draws, animation frames, contexts and GPU objects at rest and over a run of changes.
