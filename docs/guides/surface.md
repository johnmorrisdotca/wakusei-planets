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

Attributes: `site`, `time` (an ISO date and time, milliseconds since 1970 or `now`; the landing itself when left out), `heading` (degrees clockwise from north), `pitch`, `fov`, `tiles` (where the height tiles are served from), `lang`, `quality` (`auto`, the default, or `full`, `medium` or `fast`: see What it costs), and `shadows="off"`, `detail="off"` and `exposure` for trying things.

## Where the ground comes from

The height tiles are made by `scripts/make-moon-terrain.py` from public-domain NASA data (NOTICE.md lists each file, where it comes from and what it asks for): the 5 m height model of the narrow angle camera on the Lunar Reconnaissance Orbiter, which is tied to the laser altimeter's own measurements, so it is good to about a metre in height and about ten metres in place, and the altimeter's global map for everything beyond it. They are cut into four levels (5 m, 20 m, 80 m and 480 m between samples) of 256 sample tiles, 16 bits to a height, held as lossless WebP pictures, bit for bit the same as the heights they were made from (the two bytes of a height are two colours, because a browser cannot read a 16 bit picture whole). The tiles are in no package and no repository: the Pages workflow makes them and serves them beside the demo, and the element looks there by default.

The horizon is measured: the model reaches 29 kilometres from the site, the global map the rest of the way, so a mountain 80 kilometres off is where it really is, with the Moon's curve taken off (the ground falls 29 centimetres in a kilometre, and the horizon from eye height is two and a half kilometres on flat ground).

The ground picture is the narrow angle camera's own mosaic with the shading of the heights divided out: the script fits the Sun the mosaic was lit by (its azimuth and elevation, to the heights it covers), divides that shading out, and keeps what is left, the ground's own light and dark. The picture is lit again by the Sun of the moment shown, so the two lights never meet.

## Light and shadow

The Sun and the Earth come from the package's own ephemeris: `moonSky(lat, lon, time)` returns the Sun's and the Earth's azimuth and altitude, their sizes, and the lit share of the Earth, which is the opposite of the Moon's (a full Moon is a new Earth). The ground is lit by Lommel-Seeliger, the law the Moon's dust follows (bright toward the Sun and not at all toward the shadow), with no air: no haze and a black sky.

```ts
import { moonSky } from "@johnmorrisdotca/wakusei-planets/surface";

const sky = moonSky(20.1911, 30.7723, Date.UTC(1972, 11, 11, 19, 54));
console.log(`the Sun ${sky.sun.altitude.toFixed(0)} degrees up, the Earth ${sky.earth.altitude.toFixed(0)} degrees up and ${(100 * sky.earthIllumination).toFixed(0)} % lit`);
```

Shadows are hard and come in two parts. The measured ground's shadows are baked: the script walks the heights once and keeps, for every point of the 5, 20 and 80 m levels, how high the horizon stands in each of eighteen directions (a horizon map, a picture of the same size, 4.4 MB for the site). The shader reads the horizon in the Sun's direction and compares it with the Sun's height, so a mountain's shadow costs one read. Only what is made is marched, a short walk of a fixed number of steps toward the Sun over the heights and the nearby made craters, so a crater's rim and a stone throw crisp shadows near the feet.

## What is made, not measured

Below the 5 m grid the page is told nothing, so it makes something: small craters from half a metre to twenty by the lunar size-frequency law (many small, few large, and most of them old: only about one in twenty-five is fresh, a fifth as deep as it is wide with a sharp rim, and three in four are worn, shallow bowls with a soft rim that melts into the ground; the bigger ones are thinned by half and may overlap, so the ground is not a tray of stamped circles), a fine roughness of the dust in the normals, and rocks, most of them smaller than thirty centimetres and none larger than a metre and a half, rounded and part buried, lit by the same law as the ground (a lit face a little brighter than the dust), and fewer away from fresh rims. All of it is seeded from the place, so the same spot is always the same, and it fades out with distance so nothing shimmers. **It is made, not measured**, and the picture says so under the ground; `detail="off"` shows the measured ground alone. The eyes' height follows the made craters too, so a step into one is a step down.

## What it costs

One draw when something changes (a look, a step, a new time) and nothing at rest or out of sight, at most thirty a second while a key is held. The canvas is the shared renderer's: one WebGL context for the page, within 6 million pixels and 4096 a side.

The cost is the fragment shader, in three tiers set by `quality`. `full` marches the made detail 56 steps over 80 m and reads made craters to 36 m; `medium` 28 steps over 40 m and craters to 16 m; `fast` 10 steps over 14 m and no made craters in the march. Made craters beyond about 60 m change the surface's normal only, never its shadow. The default, `auto`, draws the first picture and every picture while moving at `fast`, then one picture at `full` a moment (160 ms) after the last change; if a draw takes over 120 ms it steps one tier down, and over 250 ms two, and it says so in `stats.quality`. On a graphics card (an Apple M1 Ultra through ANGLE and Metal) every tier draws in about 2 ms at 1280 by 720 and at 780 by 438, the time of the card's own overhead, so the tiers cannot be told apart there. A phone has not been measured: a recent one is likely to take some 15 to 30 ms at a million pixels at `full`, and a cheap one 100 ms or more, which is why `auto` steps down. In software drawing (the tests') a 640 by 360 picture takes about 30 s at `full` and 5 s at `fast`, so the tests use small pictures and `fast`.

The ground is fetched in rings. The first view is 4.2 MB: the coarse level whole (80 m between samples), the finest level (5 m) over the middle 4 by 4 tiles round the landing site, their pictures and the finest horizon map. The levels are whole from the first draw, and a tile not yet fetched holds what the coarser level makes of it, so the ground gets sharper in place as the rest comes in, nearest first: the other 5 m and 20 m tiles, the other horizon maps, and last the far terrain beyond 80 km, which only the farthest mountains need. The whole site is 12.9 MB (heights 7.0 MB, ground picture 2.0 MB, horizon maps 3.9 MB). The element's `data-loading` attribute is `more` while tiles are still coming, `done` at the end and `failed` if one could not be had (the first view still stands), and `stats.tiles` counts them.

## Coming down from orbit

`<wakusei-space>` can bring the viewer down to a site in one move. Import `@johnmorrisdotca/wakusei-planets/surface/land` for its effect and the space element gains `land(site)`, `leave()` and two readers, `landed` and `standing`; a page that never imports it carries none of the standing view.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/space/element";
import "@johnmorrisdotca/wakusei-planets/surface/land";

const space = document.querySelector("wakusei-space")!;
space.addEventListener("wakusei-landed", (event) => console.log("down at", (event as CustomEvent).detail.site));
await space.land("apollo-17", { tiles: "https://johnmorrisdotca.github.io/wakusei-planets/tiles/" });
console.log(space.landed); // "apollo-17"
await space.leave();
```

The camera goes to the Moon if it is not there, turns over the site and comes in to the Moon's closest zoom; the standing view is made and its first 4.2 MB fetched meanwhile, and it fades in over the picture when both are ready (a person who asked for reduced motion gets a cut). `wakusei-landing` is sent when it starts and `wakusei-landed`, with the site, when the person is standing; `leave()` (or the Escape key on the ground) fades it out, lifts the camera back to the whole Moon and sends `wakusei-left`. `land` resolves the `<wakusei-surface>` element, so its `time` and `heading` can be set at once, and rejects when there is no such site, the device cannot draw 3D, the ground does not come in (`timeout`, 20 seconds by default) or `leave` was called first. A second `land` at the same site returns the same view.

## What the package exports

`WakuseiSurface` (the element, from `surface/element`) and `SURFACE_SITES` say what can be stood on; `moonSky` and `localFrame` the sky; `forward`, `viewProjection`, `clampLook` and `stepOver` the camera; `loadTerrain`, `tileAddress`, `groundAt`, `sampleLevel` and `decodeHeight` the heights; `loadPlan` the order the files come in, `fillFromCoarser` what a tile not yet fetched holds, `madeGround`, `craterIn`, `rocksAround` and `rockMesh` the made detail, with the same formulas as the shader (written once, in `src/surface/detail.ts`, and held together by the tests).
