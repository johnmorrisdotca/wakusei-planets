---
title: Standing on the Moon
section: how-to
order: 33
description: A person at a landing site, drawn from the real measured ground, with the Sun and the Earth where they really are, hard shadows, and made detail that is marked as made.
---

`<wakusei-surface>` puts the viewer on the Moon at a place with measured heights: the ground is drawn from a model of the real surface, lit by the Sun where it really is at the moment shown, shadowed by the ground itself, under a black sky with the Earth where it really is and its real phase. Today there is one site, the Apollo 17 landing site in Taurus-Littrow, a valley a few kilometres wide between mountains two kilometres high.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/surface/element";

const view = document.createElement("wakusei-surface");
view.setAttribute("site", "apollo-17");
view.setAttribute("time", "1972-12-11T19:54Z"); // the landing: the Sun 13 degrees up, long shadows
view.setAttribute("tiles", "https://johnmorrisdotca.github.io/wakusei-planets/tiles/");
document.body.append(view);
```

## Hands

A drag turns the view. The keys W, A, S and D (or the arrows) walk at a walking pace, 1.4 metres a second, and the eyes rise and fall with the ground, craters included. Q and E turn, + and - zoom, and Ctrl with the wheel or a pinch zooms: zoom is the field of view, from 8 to 100 degrees from the top of the picture to its bottom. Nothing is drawn at rest, and while a key is held no more than thirty frames a second.

Attributes: `site`, `time` (an ISO date and time, milliseconds since 1970 or `now`; the landing itself when left out), `heading` (degrees clockwise from north), `pitch`, `fov`, `tiles` (where the height tiles are served from), `lang`, and `shadows="off"`, `detail="off"` and `exposure` for trying things.

## Where the ground comes from

The height tiles are made by `scripts/make-moon-terrain.py` from public-domain NASA data (NOTICE.md lists each file, where it comes from and what it asks for): the 5 m height model of the narrow angle camera on the Lunar Reconnaissance Orbiter, which is tied to the laser altimeter's own measurements, so it is good to about a metre in height and about ten metres in place, and the altimeter's global map for everything beyond it. They are cut into four levels (5 m, 20 m, 80 m and 480 m between samples) of 256 sample tiles, 16 bits to a height, held as pictures (the two bytes of a height are two colours, because a browser cannot read a 16 bit picture whole). The tiles are in no package and no repository: the Pages workflow makes them and serves them beside the demo, and the element looks there by default.

The horizon is measured: the model reaches 29 kilometres from the site, the global map the rest of the way, so a mountain 80 kilometres off is where it really is, with the Moon's curve taken off (the ground falls 29 centimetres in a kilometre, and the horizon from eye height is two and a half kilometres on flat ground).

The ground picture is the narrow angle camera's own mosaic with the shading of the heights divided out: the script fits the Sun the mosaic was lit by (its azimuth and elevation, to the heights it covers), divides that shading out, and keeps what is left, the ground's own light and dark. The picture is lit again by the Sun of the moment shown, so the two lights never meet.

## Light and shadow

The Sun and the Earth come from the package's own ephemeris: `moonSky(lat, lon, time)` returns the Sun's and the Earth's azimuth and altitude, their sizes, and the lit share of the Earth, which is the opposite of the Moon's (a full Moon is a new Earth). The ground is lit by Lommel-Seeliger, the law the Moon's dust follows (bright toward the Sun and not at all toward the shadow), with no air: no haze and a black sky.

```ts
import { moonSky } from "@johnmorrisdotca/wakusei-planets/surface";

const sky = moonSky(20.1911, 30.7723, Date.UTC(1972, 11, 11, 19, 54));
console.log(`the Sun ${sky.sun.altitude.toFixed(0)} degrees up, the Earth ${sky.earth.altitude.toFixed(0)} degrees up and ${(100 * sky.earthIllumination).toFixed(0)} % lit`);
```

Shadows are hard and are found by walking from each point toward the Sun over the same heights, a horizon-angle march, rather than by a shadow map: a shadow map cannot hold a stone's shadow and a mountain's in one picture, and a march does, with no extra pass. Near a point the march also reads the made craters, so a crater's rim throws a crisp shadow into it.

## What is made, not measured

Below the 5 m grid the page is told nothing, so it makes something: small craters from half a metre to twenty by the lunar size-frequency law (many small, few large; a fresh one a fifth as deep as it is wide, a worn one shallower, with a soft rim), a fine roughness of the dust in the normals, and rocks from ten centimetres to a metre and a half, denser by young crater rims. All of it is seeded from the place, so the same spot is always the same, and it fades out with distance so nothing shimmers. **It is made, not measured**, and the picture says so under the ground; `detail="off"` shows the measured ground alone. The eyes' height follows the made craters too, so a step into one is a step down.

## What it costs

One draw when something changes (a look, a step, a new time) and nothing at rest or out of sight, at most thirty a second while a key is held. The canvas is the shared renderer's: one WebGL context for the page, within 6 million pixels and 4096 a side. A draw costs the fragment shader: a march for each pixel and a few crater cells. On a graphics card that is a few milliseconds; in software drawing (the tests') a small picture takes seconds, so the tests use small pictures. The first view fetches about 8 MB of tiles.

## What the package exports

`WakuseiSurface` (the element) and `SURFACE_SITES` say what can be stood on; `moonSky` and `localFrame` the sky; `forward`, `viewProjection`, `clampLook` and `stepOver` the camera; `loadTerrain`, `tileAddress`, `groundAt`, `sampleLevel` and `decodeHeight` the heights; `madeGround`, `craterIn`, `rocksAround` and `rockMesh` the made detail, with the same formulas as the shader (written once, in `src/surface/detail.ts`, and held together by the tests).
