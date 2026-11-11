---
title: The space view
section: how-to
order: 16
description: The Earth, the Moon, the Sun and the planets in their places for any date, with the Moon's phase and the Earth's day side coming from the real Sun. Two scales, time both ways, a zoom from the Earth out to the whole solar system.
---

`@johnmorrisdotca/wakusei-planets/space/element` registers `<wakusei-space>`: the Earth, the Moon, the Sun, the seven other planets, Pluto, the eight other dwarf planets and five minor bodies (Vesta, Pallas, Chiron, Pholus and Halley's comet) in their places for a date and time, with every moon the package knows round its planet, drawn with three.js through the page's one shared WebGL context. The Moon's phase and the Earth's sunlit side come out of the light, not out of a table. Zoom from the Earth out to the whole solar system and back, and run time forwards or backwards.

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

The element needs `three` (an optional peer). The pictures come from jsDelivr, or from the folder named by `texture-base`. In this view every body that has a surface picture is drawn from it in both looks (`look="realistic"` and `look="painted"`), the Moon and Mars too, and the finer map tiles come to them when the camera is near; a body with no picture (Phobos, Deimos, Uranus's moons) is shaded from its numbers. Your own three.js scene gets the same with `mapped: true` in the painter's context. Everything is drawn by the package's own painter ([in your own three.js scene](in-your-own-scene.md)), so the looks are the same as in `<wakusei-body>`.

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

Space is mostly empty, so a picture at true scale is mostly black, with the bodies as specks. The element has both and says which with `scale`; it opens at true distances (`true`, the default):

| `scale` | Distances | Sizes |
|---|---|---|
| `true` (default) | Real distances and sizes, the Earth's equatorial radius for a unit | real: the planets are specks and the Sun is a dot with a glow. A body whose disc is under 4 CSS pixels across its radius is marked with a ring round its place as well as its name, so no planet is lost |
| `compressed` | Every direction is real. The Moon is drawn 3.5 Earth radii away (it is 60); the Sun 70 (it is 23,500); each planet is drawn in its real direction from the Sun at 70 radii times its distance in astronomical units to the power 0.45, so the Earth's own orbit is the 70 and Neptune's about 320 (it is 30 times as far). The Sun, the bodies and their orbit lines all go through the one mapping (`placeBodies`, `orbitLine`), so every body, the Earth too, lies on its own orbit line. The moons of a planet are drawn nearer when their real distance would cross the next planet's orbit (`moonDistance`): the farthest at a third of the gap, the others in the order they are | the Sun 5, the Moon 0.273 (its true size beside the Earth: a quarter of it) and the planets 0.4 to 1.8 Earth radii (larger than life) |

The element always names the scale in use on its own view: "True distances" or "Distances squeezed to fit" (`lang="ja"` gives the Japanese, `space.scaleNames = { true: "..." }` a page's own words, and `::part(scale)` styles the line). A page that wants the old opening writes `scale="compressed"`. `space.placeOf(id)` says where a body is on the screen now (its centre and radius in CSS pixels in the element).

## Time

`time` is an ISO date (`2026-11-02T14:00Z`) or `now`; `speed` is game seconds a second: `1` real time, `0` held still, `3600` an hour a second, `86400` a day a second, a negative number runs backwards. Setting `time` points the camera at the same place on the ground again. The Earth turns by its real rotation, the Moon shows its near side to the Earth, and each planet is lit from the Sun, so Venus has its crescent and the Moon its quarter.

`light="lit"` lights every body as if by daylight from the camera's side (the Sun is its own light), so a view of a night side is never a black frame. The bodies keep their true places either way.

## Zoom, looking at a body, naming

The element carries the drag, the pinch, Ctrl and the wheel, and the keys itself ([zoom and pan](zoom-and-pan.md)), from a millionth (the camera far enough out to see the whole solar system) to 3.6x. The camera sits `4.1 / zoom` radii of the body it looks at from that body: zoom 1 shows the whole body with a margin, about 80% of the view's shorter side across, in any shape of view, and the ceiling, 3.6, is where the finest map tiles run out of detail; the camera is held 1.05 radii from the surface, so past about 3.9 nothing moves. At 3.6 the surface is as sharp as the finest map tiles go (the Earth, and Mars and the Moon in the `painted` look, have them: [close zoom](close-zoom.md)), and they are fetched only when the camera is that near, for the part in view. Put the family's `<kazoku-view-controls for="space">` beside it for buttons and it reads the same range; `zoom-min` and `zoom-max` on either one change it, and `controls="none"` takes the element's own hands off. `space.zoomFor("moon" | "sun" | "inner" | "solar-system" | "earth" | "jupiter-moons")` gives the zoom that shows each part of the sky at the current scale and moment (the name in any case; a name that is no preset gives 1, the zoom that shows the body looked at whole), and `space.controller.set({ zoom })` (or, with the bar, `controls.controller.set({ zoom }, true, "jump")`) goes there. `space.setView(controls detail)` turns the camera round the body (`roll` turns the picture clockwise about the line of sight, and `panX` and `panY` move everything in it by exactly that many CSS pixels, right and down positive, at any depth): it is fixed to the stars, so the Earth turns under it as time runs.

`space.body = "jupiter"` points the camera at a body: any body of the view in any case, in English or Japanese (`earth`, `sun`, `moon`, `mercury` to `neptune`, `pluto`, and the moons of the planets such as `titan`); a name that is no body changes nothing. The name beside each body is a button (Tab, Enter). A press on a body that is not a drag fires `wakusei-body-click` (`wakusei-body-focus` for the keyboard) with `{ id, name, kind, host, radiusKm, distanceKm }`; `space.bodyInfo(id)` gives the same. `space.bodyNames = { mars: "火星" }` and `lang="ja"` change the words.

A body behind another (its place on the screen inside a nearer body's disc, which `placeOf(id).behind` names) keeps its name over the disc unless `covered="arrow"` (and `space.covered`): then one small quiet arrow sits just outside the disc's edge on the side nearest the hidden body, pointing in behind it, with the name of the hidden body that ranks highest (the order of the names below) beside it and the others counted (`Uranus +4`); a press on it goes to that body, and the arrow goes as the body comes out. `coveredBy` and `coverArrows` from `/space` are the maths.

No two names overlap: when the boxes of two names would cross, the one that matters less is left out, and a name that is left out takes its ring with it. The order is the body looked at, the Sun, the planets, then the Moon; a tie goes to the body that is bigger on the screen. A moon gives way to its planet and a planet to the Sun, and zooming in brings the names back. `chooseLabels(boxes)` from `@johnmorrisdotca/wakusei-planets/space` is the same rule on plain boxes.

A planet's nearer moons appear round it once the planet is a few pixels across, at the places the package's moon models give (`zoomFor("jupiter-moons")`). The paths of the Earth and the planets round the Sun, and the Moon's path round the Earth, are drawn unless `orbits="off"`. Every line goes through the same mapping as the bodies, so each body lies on its own line in both scales; `stats.orbits` says which lines were drawn and how far each body is from its own, as a fraction of the line's radius (under 0.01 for a body on its line). The Moon's line is one sidereal month from the Moon's own place and is worked out again every few days of the clock; `moonOrbit(ms)` gives its points.

`body-label="painted"` writes each body's name on its own globe as well, turning with it, in the page's language: the looks, how many, where and the font are in [A name on the body](name-on-the-body.md). A body too small on the screen carries none. While a body carries its drawn name its floating name and dot fade out and leave their place to the others, and fade back when it is small again; `labels-always` keeps both.

## Every body

The view offers every body the package knows, 52 of them: the Sun, the eight planets, the nine dwarf planets (Pluto, Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna), the five minor bodies (the asteroids Vesta and Pallas, the centaurs Chiron and Pholus, Halley's comet) and the 29 moons. `SPACE_BODIES` from `/space/element` lists the twenty-four it places in the middle of its scene (the dwarf planets from their osculating elements, good for a few years either side of 2026; the minor bodies from tables fitted to Horizons, within an arc-second, which the view loads itself), and every moon is placed round its host, in its real orbit. Any of them can be at the middle of the view, gone to, hopped to and ridden (`space.ride("ceres")`, `space.ride("titan")`, `space.ride("vanth")`). A dwarf planet or minor body too small on the screen to see (under half a pixel across its radius: at true scale every asteroid and comet is) is not drawn, only named and ringed, and its picture is not made until it is looked at; a moon is drawn once its planet is a few pixels across. With `orbits` on the dwarf planets and the minor bodies have their lines too (Halley's is a long thin ellipse out to Neptune's distance, with its sharp turn round the Sun). `space.zoomFor("mars-moons")` (also `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`, `orcus`, `haumea`, `eris`) gives the zoom that shows a planet with its nearer moons.

The demo's picker is three clicks in a row: a kind (the Sun and planets, dwarf planets, small bodies, moons), for a moon the planet it goes round, then the body, with a search by name (English or Japanese) beside them and a "With its moons" button for a planet that has some. `space.bodyList()` is the data for any picker of your own.

## Going to a body, and the hopper

A first press on a body or its name selects it: `wakusei-body-select` fires with the same detail (for a page's card), `space.selected` reads it, and the view stays where it is. A second press on the selected body, or `space.goTo("saturn")`, makes it the middle of the view: the camera glides there in about a second (a jump for a reader who asked for reduced motion, or with `{ smooth: false }`), the zoom is brought to 1 so the body is whole in view (`{ zoom }` asks for another), and the view stays on it as time runs. A press never sends the view anywhere else, and a press on the body already at the middle does nothing. `goTo` returns whether the view can go there; with a `<kazoku-view-controls>` bound to the element the bar holds the zoom, so the page applies the one the event carries (`controls.controller.set({ zoom }, true, "jump")`).

The hopper goes through the bodies in one order: the Sun, Mercury, Venus, the Earth, the Moon, Mars, Phobos, Deimos, Jupiter and its moons, and on outwards, each planet followed by its moons nearest first (`HOP_ORDER` from `/space` is the whole order). `space.next()` and `space.previous()` go to the next and the previous body, round from the last to the Sun, and each return the body's `BodyInfo`. Every change of the middle fires `wakusei-hop` with `{ current, previous, next }` (each a `BodyInfo`, and `zoom` when `goTo` or a hop asked for one), so two arrows can show the names of where they lead; `space.hopper` reads the same at any time. `space.bodyList()` is the jump list: every body the view can go to, in order, with its `kind` (`star`, `planet`, `dwarf-planet`, `moon`) and, for a moon, its `host`. `findBody("Saturn")` and `findBody("土星")` from `/space` read a body from what a reader types.

## Leaving a body

Every trip to another body (`goTo`, the hopper's `next` and `previous`, a ride) starts with a slow launch, so the departure is seen: the camera takes about half a second to cover the first fifth of the way, speeds up, and settles on the destination. How it gets there is a named transition, chosen by the attribute and property `transition`, or for one trip by `space.goTo("jupiter", { transition: "look-back" })`:

| Name | What it does |
|---|---|
| `turn-travel` | The default. First the camera swings round the body it is leaving, at the distance it had and keeping that body in view, until the destination is in the frame beside it (a point, or a marked dot when it is too small to see); then it travels to the destination with it in the frame the whole way, slow to leave, fast in the middle and slow to arrive; then it settles. No frame of the trip is empty: one of the two bodies is always on the screen. A quarter swing takes `turn` milliseconds, a wider one longer in proportion; the travel takes the length `launch` sets. |
| `direct` | The slow launch, then straight at the destination, which stays in view and grows (the way it went before). |
| `look-back` | Pull away watching the body being left, then turn to the destination over the last part of the trip. |
| `auto` | `direct` when the destination is in view where the trip starts, `turn-travel` when it is not (it needs the names on: they say where the bodies are on the screen). |
| `cut` | No glide: the view is at the destination at once. A reader who prefers reduced motion always gets this. |

Two settings tune them, both in milliseconds: `launch` (the attribute, and `space.launchMs`: how long the slow launch lasts, 500 by default; 0 is a quick glide, a longer one is a longer trip) and `turn` (`space.turnMs`: how long the turn at the end of a `look-back` takes, 700 by default). `TRANSITIONS` lists the names and `glideProgress` and `turnProgress` are the curves, for a page that wants to draw them.

```ts
import { glideDuration, glideProgress, TRANSITIONS } from "@johnmorrisdotca/wakusei-planets/space";

console.log(TRANSITIONS.join(", "));
// by the end of the launch the camera has covered about a fifth of the way
console.log(Math.round(glideDuration(500)), "ms in all,", glideProgress(500, 500).toFixed(2), "of the way after the launch");
```

## Full screen

`immersive` (an attribute, and `space.immersive`) makes the element a full-screen view: it fills the box it is in, whatever the shape (it is `width: 100%; height: 100%`, and a page that gives it any width and height does the same without the attribute), and a plain wheel zooms and a drag anywhere on it turns it, a touch drag included, instead of scrolling the page. Without `immersive` kazoku-ui's rules stand: Ctrl, Command or Alt with the wheel zooms and the plain wheel scrolls the page. At zoom 1 the body looked at is framed, with a margin of about a fifth, by the shorter side of the view, in a tall window as in a wide one, so it is never cut off (Saturn is framed with its rings), and `zoom-min` takes the camera as far out as the whole solar system.

```html
<style>
  html, body { margin: 0; height: 100%; background: #04060c; }
  wakusei-space { position: fixed; inset: 0; }
</style>
<wakusei-space immersive time="now" speed="3600"></wakusei-space>
```

The page [space-full.html](https://johnmorrisdotca.github.io/wakusei-planets/space-full.html) is this, with the family's view controls over the bottom. `checkGestures` from `@johnmorrisdotca/kazoku-ui/testing` passes on it, with one named exception: the plain wheel's pan, because there the plain wheel zooms.

## Which way things go: arrows and help mode

With `orbits` on, two small arrowheads sit along each orbit line, pointing the way the body goes round (the Moon's line too): two are enough to show the way, and more is clutter. `arrows` (an attribute and a property, `space.arrows = 3`) sets how many: 2 by default, at most 4, 0 for none; anything else is made a whole number in that range (`arrowCount` reads it, `ARROWS_PER_ORBIT` and `MAX_ARROWS_PER_ORBIT` are the two numbers). The long orbits (Sedna's, Eris's, Gonggong's, Halley's) are cut at equal steps round the ellipse, not equal steps of time, so the sharp turn near the Sun is a smooth curve and not one straight stroke with corners. The arrowheads are drawn about nine CSS pixels long whatever the zoom, so they read from the whole solar system to the Moon and are never thick enough to hide a body, and they keep clear of the body itself. Close to a body (its disc a few dozen pixels across) the orbit lines are seen edge-on and would cross it as long straight scratches, so only the lines of its own system are drawn (the Moon's with the Earth's, and the Earth's with the Moon's) and, of those, the part within about twelve radii of it fades out: no line is ever drawn across the disc. `stats.orbits.hidden` lists the lines left out. The arrows show the way the body really travels, so they do not change when time runs backwards: then the body moves against its arrows. `arrowSites(line)` and `chevron(...)` from `/space` are the places and shapes, and `stats.orbits` and `stats.arrows` say where each arrow is and which way it points.

`help` (an attribute, and `space.help`; off by default) is the help mode: on the body looked at it draws a line along its axis and a curved arrow round it showing which way it spins. The lines have depth against their own body, so nothing is drawn through it: the axis runs into the near pole and comes out of the far pole only where that end is not behind the globe, and the part of the arrow that passes behind the globe is hidden. `help-through` (an attribute, and `space.helpThrough`; off by default) brings back the whole lines drawn over the globe. The arrow turns by the right-hand rule about the axis the body really spins about, which `spinAxis(id, ms)` works out from how its prime meridian moves: the north pole for the Earth, Mars, Jupiter and most bodies, and the opposite way about the pole for Venus and Uranus, which turn backwards. Uranus, lying on its side, shows its axis nearly along the ecliptic. A moon that keeps one face to its planet spins once an orbit, the way it goes round. The demo ties it to the family's Help switch in its header. `stats.help` says which body, its axis and what the arrow drawn turns about.

## Properties, events, stats

Attributes: `center` (`"lon,lat"`), `time`, `speed`, `scale` (`true`, the default, or `compressed`), `help` (the help mode; off by default), `look` (`realistic` or `painted`), `light`, `labels` and `orbits` (`off` hides them), `lang`, `texture-base`, `texture-far-base`, `max-texture`, `tiles` (where the finer map tiles are; `off` for none). Events: `wakusei-view` (the view changed: `yaw`, `tilt`, `zoom`), `wakusei-ready`, `wakusei-unavailable`, `wakusei-state`, `wakusei-timechange` (the date, four times a second at most while time runs, and once when it holds: `{ time, running }`), `wakusei-time` (every step the clock takes), `wakusei-body-click`, `wakusei-body-focus`. `stats` has `state`, `draws`, `contexts`, `canvas`, `distance`, `time`, `lookups`, `camera`, `bodies` and `tiles`.

## Riding along

`space.ride("moon")`, `space.ride("io")` or `space.ride({ at })` puts the camera on a moving point and looks at the body it goes round: see [Riding along](ride-along.md).

## The budget

The view keeps the same rules as every live 3D view in the package, and `pnpm test:freeze` proves them: one WebGL context through the shared renderer, a canvas inside 4096 pixels a side and 6 million pixels, nothing drawn at rest, at most 30 frames a second, real time redrawn once a minute, nothing drawn out of sight, everything freed when the element goes, and a lost context recovered.
