---
title: Looks and bodies
section: how-to
order: 7
description: The three looks, each body's own entry point, three.js, pictures and the budget that keeps the page light.
---

## The looks

- `line`: a clean outline drawing, an SVG string. It needs nothing else.
- `realistic`: a shaded sphere drawn with three.js from the body's real colours and features, lit from the Sun's side. No pictures are fetched: the surface is worked out in the shader.
- `painted`: a real surface map from public-domain NASA, USGS and JPL imagery, for the Sun, the planets from Mercury to Pluto, the Moon, the four Galilean moons, Titan, Rhea, Enceladus and Mimas; Saturn's rings come from a Cassini picture of them. A small picture is drawn first and a sharper one is fetched when the view is zoomed in; if a picture cannot be fetched the shaded look stays. Saturn, Uranus, Neptune and the Sun have no global map: theirs come from one photograph each, as NOTICE.md says.

## Each body is its own entry point

A shaded look is code and data for one body, so each has its own import: `@johnmorrisdotca/wakusei-planets/saturn`, and `/moons-jupiter` for the Galilean moons. `/all` imports every one. A body whose entry has not been imported is drawn as a plain lit ball in its colour.

## The Earth

The Earth is not drawn here: `@johnmorrisdotca/wakusei-planets/earth` hands it to [chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth)'s own elements, so the page shows the same Earth everywhere. Install `@johnmorrisdotca/chikyu-earth` (an optional peer) and import `/earth`; the line look is its line globe, and the shaded and painted looks are its Earth from space, with the real Sun at `time`, clouds and night lights. chikyu-earth keeps its own WebGL context, so a page with a live Earth beside another live body holds two.

## One WebGL context, drawn on demand

Every shaded body on a page shares one WebGL context through kazoku-ui's shared renderer. The body in focus is live and the others show pictures: set `live="hover"` to give the context to whichever one the reader points at, `live="off"` for pictures only. Nothing is drawn while nothing changes, no animation frame is asked for while the page is at rest, a moving picture is drawn at most thirty times a second, the canvas is held to 4096 pixels a side and six million pixels, and everything is freed when the element leaves. A body that is out of sight or in a hidden tab is not drawn, and a lost WebGL context comes back by itself.

## Real sizes

`scale-to="jupiter"` draws a body at its real size relative to Jupiter. The body's `radiusKm`, `tiltDeg` and `rotationHours` are in `BODIES`.
