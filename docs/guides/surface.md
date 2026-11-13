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

On a touch screen one finger on the view looks, two fingers pinch to zoom, and a walking stick at the bottom left (shown where the main pointer is a finger, `stick="on"` or `"off"` to choose) walks: push it up to go forward, sideways to sidestep, and the harder the push the faster, up to the walking pace; the finger on the stick never turns the view. A touch screen has no keys, so the stick is the whole of walking there, and nothing is drawn when it is let go.

Attributes: `site`, `time` (an ISO date and time, milliseconds since 1970 or `now`; the landing itself when left out), `heading` (degrees clockwise from north), `pitch`, `fov`, `tiles` (where the height tiles are served from), `lang`, `quality` (`auto`, the default, or `full`, `medium` or `fast`: see What it costs), `scale` (`auto`, the default, or a number from 0.25 to 1: the share of the picture's width and height the ground is drawn at, see What it costs), `stick`, `objects` (`off` leaves the things at the site out), `drive` (`on` drives the rover), `drive-camera` (`seat` starts in the seat) and `watch`, `watch-camera` and `watch-from` (the landing), and `shadows="off"`, `detail="off"` and `exposure` for trying things.

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

## Things at the site

At Apollo 17 the things that were left there stand at their published places: the descent stage of the lunar module, the flag, the ALSEP central station, the electrical-properties transmitter and the rover, with the rover's nine traverses as a faint pair of tracks along the published line. The positions are coordinates from the map of Haase and others (2019), in NOTICE.md; each thing has a small button (Lunar module, Rover, Flag, ALSEP, Transmitter) that goes to it, a few metres off and looking at it, and says in a line what it is and that **it was placed by this package**: the shapes are plain drawings made here (an octagonal body on four legs, a floor on four wheels, a pole), not scans, the rover stands where its last traverse ends with a heading read from the line (its own published parking place was not available), and the track marks are made along a published path. The made craters and rocks keep away from them, so no crater cuts a leg, and their shadows are cast by the Sun of the moment. `choose(id)` does the same as a press, `objects` lists them, `wakusei-surface-object` says which was chosen, and `objects="off"` leaves them out.

## Driving the rover

With `drive="on"` the eyes are the rover's: it stands where its last traverse ended at Apollo 17 and the view is from behind and above it. **W** and **S** (or the arrows, or the walking stick up and down) are the throttle, **A** and **D** the steering, **C** turns between the chase view and the commander's seat, and a drag turns the view round it. The rover is the same plain drawing, now on four wheels that turn and steer (all four steer, the back ones the other way, so the turn is tight).

It is a small physical model, and the ground it drives on is the ground the eyes walk on: the measured heights and the made craters. Each wheel reads the height where it touches, the rover tilts to the plane the four make and sits on a spring over their mean, and where the ground falls away it is in free fall at the Moon's gravity (1.62 m/s2), so a crest throws it, and it lands on its springs. The speed follows the throttle to about 12 km/h (the design speed is 13), uphill the Moon's gravity takes some of it, a slope over 25 degrees it will not climb, and a big rock, the lunar module, the flag or the station stops it. What is real is its size, the gravity and the speed; the spring, the steering, the limits and the rock stops are made.

Each wheel on the ground throws grains of dust up and back. With no air they fly in clean parabolas at the Moon's gravity and fall where they fall, with no cloud (the grains and their number are made). The wheels leave two bands behind them, the same faint tracks as the published traverse. While a key or the stick is held, and while the rover is still rolling or settling, it is stepped by the real time between frames, up to thirty times a second, and nothing is drawn once it is at rest. `driveFor(seconds, input)` drives by a set time instead, for a test or a row of pictures; `vehicle` is its state and `driveCamera` the view.

## Watching the landing

`watch="landing"` runs Apollo 17's powered descent at the real moment: the Sun, the Earth and the shadows are those of 19:42:52 to 19:54:57 UTC on 11 December 1972, and the clock shows the seconds from ignition (`T+04:00`) and the mission's ground elapsed time (110:13:53). `land(site, { watch: "landing" })` on the space view does it as it comes down; `watch-camera` is `lander` (the commander's window, the default, starting at T+4:00) or `ground` (an observer, starting at T+9:00 when the lander is two and a half kilometres up), and `watch-from="150 0"` is where the ground camera stands, as metres from the touchdown point and a bearing (150 m north by default, looking south, with the field of view narrowed so that the stage is about a tenth of the picture at touchdown). `playLanding()`, `pauseLanding()`, `landingRate` (1 is real time, 12 minutes 5 seconds) and `landingTime` (seconds, setting it goes there) are the controls, and `wakusei-landing-clock` is sent with the time, the altitude and speed, and the report's moment that has just passed.

**What is real** is what the Apollo 17 Mission Report (NASA, JSC-07904) prints: the table of events (ignition at 110:09:53, radar lock at T+3:35, throttle down at T+7:26, the high gate at T+9:22, the first of eight landing-point redesignations, the low gate at T+10:58, touchdown at T+12:05), the state at ignition (19.13 N, 48.75 E, 8.7 nautical miles up, 5,550 ft/s, heading 276 degrees), and the altitudes it names (30,000 ft, 13,000 ft, pitchover at about 7,500 ft, manual takeover just under 300 ft, dust first seen at 60 to 70 ft, touchdown at about 3 ft/s). The words on the picture show those moments as they pass. **What is made**: the report prints no full table, so **the altitude and speed between the reported moments are a smooth curve of ours** (it passes through every altitude above, covers the real distance from the start to the touchdown, never rises and never speeds up), the straight path along the ground, the attitude of the window, the throttle, the plume and the dust it throws (grains in parabolas at the Moon's gravity, from the 60 to 70 ft call-out on), and the times of the altitude call-outs, which are the moments our curve reaches them (the picture says so beside each). The first four minutes are 514 km up-range of the ground the package has, so the view starts at T+4:00. The descent runs only while it is playing: a stopped or finished descent draws nothing.

## What is made, not measured

Below the 5 m grid the page is told nothing, so it makes something: small craters from half a metre to twenty by the lunar size-frequency law (many small, few large, and most of them old: only about one in twenty-five is fresh, a fifth as deep as it is wide with a sharp rim, and three in four are worn, shallow bowls with a soft rim that melts into the ground; the bigger ones are thinned by half and may overlap, so the ground is not a tray of stamped circles), a fine roughness of the dust in the normals, and rocks, most of them smaller than thirty centimetres and none larger than a metre and a half, rounded and part buried, lit by the same law as the ground (a lit face a little brighter than the dust), and fewer away from fresh rims. All of it is seeded from the place, so the same spot is always the same, and it fades out with distance so nothing shimmers. **It is made, not measured**, and the picture says so under the ground; `detail="off"` shows the measured ground alone. The eyes' height follows the made craters too, so a step into one is a step down.

## What it costs

One draw when something changes (a look, a step, a new time) and nothing at rest or out of sight, at most thirty a second while a key is held. The canvas is the shared renderer's: one WebGL context for the page, within 6 million pixels and 4096 a side.

The cost is the fragment shader, in three tiers set by `quality`. `full` marches the made detail 56 steps over 80 m and reads made craters to 36 m; `medium` 28 steps over 40 m and craters to 16 m; `fast` 10 steps over 14 m and no made craters in the march. Made craters beyond about 60 m change the surface's normal only, never its shadow. The default, `auto`, draws the first picture and every picture while moving at `fast`, then one picture at `full` a moment (160 ms) after the last change; if a draw takes over 120 ms it steps one tier down, and over 250 ms two, and it says so in `stats.quality`. On a graphics card (an Apple M1 Ultra through ANGLE and Metal) every tier draws in about 2 ms at 1280 by 720 and at 780 by 438, the time of the card's own overhead, so the tiers cannot be told apart there. A phone has not been measured: a recent one is likely to take some 15 to 30 ms at a million pixels at `full`, and a cheap one 100 ms or more, which is why `auto` steps down. In software drawing (the tests') a 640 by 360 picture takes about 30 s at `full` and 5 s at `fast`, so the tests use small pictures and `fast`.

While the view moves, the draws are timed too (the first few): a machine that takes over 24 ms for one, as a phone may, draws the ground at half the width and height (a quarter of the pixels) into a smaller target that is stretched to the canvas, and the picture goes back to full size one draw after the view stops. It is the same draw, softer for the moment; `stats.scale` and `stats.scaled` say what was done. A page whose three.js module has no `WebGLRenderTarget` draws at full size. `scale="0.5"` draws every draw at that size, as a low-power mode.

The ground is fetched in rings. The first view is 4.2 MB: the coarse level whole (80 m between samples), the finest level (5 m) over the middle 4 by 4 tiles round the landing site, their pictures and the finest horizon map. The levels are whole from the first draw, and a tile not yet fetched holds what the coarser level makes of it, so the ground gets sharper in place as the rest comes in, nearest first: the other 5 m and 20 m tiles, the other horizon maps, and last the far terrain beyond 80 km, which only the farthest mountains need. The whole site is 12.9 MB (heights 7.0 MB, ground picture 2.0 MB, horizon maps 3.9 MB). The element's `data-loading` attribute is `more` while tiles are still coming, `done` at the end and `failed` if one could not be had (the first view still stands), and `stats.tiles` counts them.

## Coming down from orbit

`<wakusei-space>` can bring the viewer down to a site in one move. Import `@johnmorrisdotca/wakusei-planets/surface/land` for its effect and the space element gains `land(site)`, `leave()` and two readers, `landed` and `standing`; a page that never imports it carries none of the standing view.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/space/element";
import "@johnmorrisdotca/wakusei-planets/surface/land";

const space = document.querySelector("wakusei-space")!;
space.addEventListener("wakusei-landed", (event) => console.log("down at", (event as CustomEvent).detail.site));
await space.land("apollo-17");
console.log(space.landed); // "apollo-17"
await space.leave();
```

The camera goes to the Moon if it is not there, turns over the site and comes in to the Moon's closest zoom. Meanwhile the standing view is made on standby: its ground (the first 4.2 MB) is fetched, and it takes nothing from the page's renderer. The page has one renderer and one view has it at a time, so when the ground is in, the orbit view goes down into black (the black of the lunar sky) as the standing view takes the renderer, and the ground fades up out of it. A person who asked for reduced motion gets a cut. `wakusei-landing` is sent when it starts and `wakusei-landed`, with the site in `detail.site`, when the person is standing. `leave()` (or the Escape key on the ground) goes dark, gives the renderer back to the orbit view (`resume()` on the space element), rises to the whole Moon, comes up out of the dark and sends `wakusei-left`. `land` resolves the `<wakusei-surface>` element, and rejects when there is no such site, the device cannot draw 3D, the ground does not come in (`timeout`, 20 seconds by default) or `leave` was called first; the orbit view is then as it was. A second `land` at the same site returns the same view, at another site it calls the first off.

## From a space view

For a page whose `<wakusei-space>` is already there (the clock driven by the page, other views beside it), five lines are all it needs:

```ts no-run
import "@johnmorrisdotca/wakusei-planets/surface/land"; // once: adds land(), leave(), landed and standing to <wakusei-space>
const space = document.querySelector("wakusei-space")!;
document.querySelector("#land")!.addEventListener("click", () => space.land("apollo-17").catch(() => alert("The ground did not come in."))); // the ground comes from the Pages tiles by default
document.querySelector("#leave")!.addEventListener("click", () => space.leave());
for (const type of ["wakusei-landed", "wakusei-left"]) space.addEventListener(type, () => console.log(type, space.landed));
```

- **The moment.** The ground shows the orbit view's own moment, read once when `land` is called (`space.time`), so the Sun and the Earth over the ground are the ones the view showed. It does not follow the clock after that: `land` starts no clock, timer or loop of its own, only the frames of the descent and the fades, and nothing at rest. `{ time: "landing" }` shows the landing's moment instead (the Sun 13 degrees up); any other moment can be given as an ISO date or milliseconds. Where it is night at the site at that moment the ground is dark, as it is.
- **Where it is mounted and who sizes it.** The `<wakusei-surface>` element is put inside the space element's own shadow root, covering it (`position: absolute; inset: 0`), so the space element's box is its box: the page sizes the space element and nothing else, and needs to mount nothing. `space.standing` returns it, for a page that sets its `heading`, `pitch` or `time`, or listens to it.
- **How `leave` removes it.** `leave()` removes the element and its veil from the shadow root and gives the renderer back to the space view; nothing is left in the page, and `landed` is `null`.
- **The renderer is one.** While the person stands, any other live view on the page (the Earth beside the space view) is on its still, since the page has one renderer. The page's own controls over the space view should be hidden meanwhile, as the ground is over them.
- **The tiles.** The default is `https://johnmorrisdotca.github.io/wakusei-planets/tiles/`, with the first file at `moon/apollo-17/manifest.json` under it (`{ tiles: "..." }` for any other place).

## What the package exports

`WakuseiSurface` (the element, from `surface/element`) and `SURFACE_SITES` say what can be stood on; `moonSky` and `localFrame` the sky; `forward`, `viewProjection`, `clampLook` and `stepOver` the camera; `loadTerrain`, `tileAddress`, `groundAt`, `sampleLevel` and `decodeHeight` the heights; `loadPlan` the order the files come in, `fillFromCoarser` what a tile not yet fetched holds, `madeGround`, `craterIn`, `rocksAround` and `rockMesh` the made detail, with the same formulas as the shader (written once, in `src/surface/detail.ts`, and held together by the tests).
