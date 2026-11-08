---
title: The space view
section: how-to
order: 16
description: The Earth, the Moon, the Sun and the planets in their places for any date, with the Moon's phase and the Earth's day side coming from the real Sun. Two scales, time both ways, a zoom from the Earth out to the whole solar system.
---

`@johnmorrisdotca/wakusei-planets/space/element` registers `<wakusei-space>`: the Earth, the Moon, the Sun, the seven other planets and Pluto in their places for a date and time, drawn with three.js through the page's one shared WebGL context. The Moon's phase and the Earth's sunlit side come out of the light, not out of a table. Zoom from the Earth out to the whole solar system and back, and run time forwards or backwards.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Earth, the Moon and the planets on 2 November 2026</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/space/element/+esm"></script>
  </head>
  <body>
    <wakusei-space time="2026-11-02T14:00Z" speed="0" look="realistic" style="width: 420px"></wakusei-space>
  </body>
</html>
```

The element needs `three` (an optional peer). The pictures of a painted look come from jsDelivr, or from the folder named by `texture-base`. Everything is drawn by the package's own painter ([in your own three.js scene](in-your-own-scene.md)), so the looks are the same as in `<wakusei-body>`.

## Where things are

Positions come from this package's own models and nothing else: the Sun and the planets from the VSOP87B series, Pluto from a table fitted to JPL Horizons, the Moon from ELP2000. They are geometric places in J2000 equatorial axes. The space view does not apply aberration or nutation, which would move a body by about 20 arc-seconds: far less than a pixel at this scale. The pure functions are in `@johnmorrisdotca/wakusei-planets/space` and import on a server:

```ts
import { frameAt, placeAround, placeSun } from "@johnmorrisdotca/wakusei-planets/space";

const frame = frameAt(Date.UTC(2026, 10, 2, 14));
const sun = placeSun("compressed", frame.sun);
const [x, y, z] = placeAround("compressed", sun, [frame.planets.mars[0] - frame.sun[0], frame.planets.mars[1] - frame.sun[1], frame.planets.mars[2] - frame.sun[2]]);
console.log(Math.hypot(x - sun[0], y - sun[1], z - sun[2]).toFixed(0));
```

`frameAt(ms)` is the Sun, the Moon and the planets in astronomical units from the Earth's centre. Against astronomy-engine (a dev-only test oracle) the Sun and the Moon agree to a hundredth of a degree and the planets to a few hundredths. `createTrack(stepMs)` answers for any moment from two real ones and interpolates, so a draw at a day a second costs about two lookups a second, not one a frame.

## Two scales

Space is mostly empty, so a picture at true scale shows two dots. The element has both and says which with `scale`:

| `scale` | Distances | Sizes |
|---|---|---|
| `compressed` (default) | Every direction is real. The Moon is drawn 10 Earth radii away (it is 60); the Sun 44 (it is 23,500); each planet is drawn in its real direction from the Sun at 44 radii times its distance in astronomical units to the power 0.45, so the Earth's own orbit is the 44 and Neptune's about 200 (it is 30 times as far) | the Sun 5, the Moon 0.9 and the planets 0.4 to 1.8 Earth radii (larger than life) |
| `true` | Real distances and sizes, the Earth's equatorial radius for a unit | real: the planets are specks and the Sun is a dot with a glow; names mark where they are |

Say "compressed scale" on the page whenever the compressed one is on; the demo does.

## Time

`time` is an ISO date (`2026-11-02T14:00Z`) or `now`; `speed` is game seconds a second: `1` real time, `0` held still, `3600` an hour a second, `86400` a day a second, a negative number runs backwards. Setting `time` points the camera at the same place on the ground again. The Earth turns by its real rotation, the Moon shows its near side to the Earth, and each planet is lit from the Sun, so Venus has its crescent and the Moon its quarter.

`light="lit"` lights the Earth as if by daylight from the camera's side, so a view of the night side is never a black frame. The Sun, the Moon and the planets keep their true places either way.

## Zoom, looking at a body, naming

`zoom-min="0.000001"` and `zoom-max="2.5"` on the family's `<kazoku-view-controls>` let it zoom far enough out. The camera sits `3.4 / zoom` radii of the body it looks at from that body: zoom 1 fills the view with it. `space.zoomFor("moon" | "sun" | "inner" | "solar-system" | "earth" | "jupiter-moons")` gives the zoom that shows each part of the sky at the current scale and moment, and `controls.controller.set({ zoom }, true, "jump")` goes there. `space.setView(controls detail)` turns the camera round the body: it is fixed to the stars, so the Earth turns under it as time runs.

`space.body = "jupiter"` points the camera at a body (`earth`, `sun`, `moon`, `mercury` to `neptune`, `pluto`). The name beside each body is a button (Tab, Enter). A press on a body that is not a drag fires `wakusei-body-click` (`wakusei-body-focus` for the keyboard) with `{ id, name, radiusKm, distanceKm }`; `space.bodyInfo(id)` gives the same. `space.bodyNames = { mars: "火星" }` and `lang="ja"` change the words.

A planet's nearer moons appear round it once the planet is a few pixels across, at the places the package's moon models give (`zoomFor("jupiter-moons")`). The planets' paths round the Sun are drawn unless `orbits="off"`.

## Properties, events, stats

Attributes: `center` (`"lon,lat"`), `time`, `speed`, `scale`, `look` (`realistic` or `painted`), `light`, `labels` and `orbits` (`off` hides them), `lang`, `texture-base`, `texture-far-base`, `max-texture`. Events: `wakusei-ready`, `wakusei-unavailable`, `wakusei-state`, `wakusei-time` (while time runs), `wakusei-body-click`, `wakusei-body-focus`. `stats` has `state`, `draws`, `contexts`, `canvas`, `distance`, `time`, `lookups`, `camera` and `bodies`.

## Riding along

`space.ride("moon")`, `space.ride("io")` or `space.ride({ at })` puts the camera on a moving point and looks at the body it goes round: see [Riding along](ride-along.md).

## The budget

The view keeps the same rules as every live 3D view in the package, and `pnpm test:freeze` proves them: one WebGL context through the shared renderer, a canvas inside 4096 pixels a side and 6 million pixels, nothing drawn at rest, at most 30 frames a second, real time redrawn once a minute, nothing drawn out of sight, everything freed when the element goes, and a lost context recovered.
