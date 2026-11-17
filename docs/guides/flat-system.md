---
title: The flat solar system
section: how-to
order: 36
description: The Sun, the planets, the belts, the comets and our spacecraft (the Tesla Roadster among them) on a flat top-down map for any time, with squeezed distances so the inner planets show. A canvas with no WebGL, the same attributes and events as the flat maps of the Moon and Mars.
---

`<wakusei-flat-system>` is the solar system seen from above the ecliptic's north pole, as a map you can pan, zoom and press. The Sun is in the middle, the planets are at their places for the time you give it with their orbits drawn, the dwarf planets and a few small bodies are there, the asteroid belts and the Kuiper belt are clouds of points, 34 comets carry a tail turned away from the Sun when they are near it, and the spacecraft are on it, the Tesla Roadster among them, each with its whole path to draw. It is two 2D canvases: no WebGL, no three.js, nothing to install beside the package.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The flat solar system, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/flat/system/define/+esm"></script>
  </head>
  <body>
    <wakusei-flat-system selected="roadster" track></wakusei-flat-system>
    <wakusei-flat-system time="2026-11-17T12:00:00Z" speed="0" layers="planets craft" spacing="true"></wakusei-flat-system>
  </body>
</html>
```

The first map is live, with the Tesla Roadster chosen and the whole path of the car drawn. The second is held at one moment, shows only the planets and the craft, and has true distances. In a bundled app, `import "@johnmorrisdotca/wakusei-planets/flat/system/define"` registers the tag; `@johnmorrisdotca/wakusei-planets/flat/system` is the pure side, with no DOM.

## A body value or an element of its own

`<wakusei-flat>` is a map of a body's surface: longitude across, latitude down, the body's own picture, wrapping round its sides, with the night shaded from the Sun's place. The solar system has none of that: it has no picture, no wrap and no latitude, and its place is a radius and a direction in the plane of the ecliptic. Putting it in `<wakusei-flat body="sun">` would have meant a second map inside the 1,600 lines of the first, so it is an element of its own, `<wakusei-flat-system>`, built the way `<wakusei-flat>` is built (the same clock, two canvases, the same controls, events and keyboard) and named so that the two sit together. The attributes and events that mean the same thing have the same names.

## The scale

The solar system is mostly empty: Neptune is 78 times as far from the Sun as Mercury. So distances are squeezed by a logarithm, the one [the top-down plan](plan.md) uses (`planRadius`): a body goes at `ln(1 + d / 0.1 au) / ln(1 + edge / 0.1 au)` of the way from the Sun to the edge. Every planet gets room, the inner ones a good deal and the outer ones a little, and the order is the order of distance. Directions are never changed. With the edge at 50 au Earth is 39 per cent of the way out, Jupiter 64, Neptune 92. Rings at 1, 5, 10, 30 and 100 au are labelled on the map, and the line at the foot says which scale it is: read the order and the directions, not the gaps. `spacing="true"` draws the real proportion instead, which crowds the inner planets into the middle; the "Squeezed scale" button toggles them.

**The edge** is the smallest of 50, 100, 200, 500, 1,000 and 2,000 au that holds the planets, the dwarf planets and the craft shown (`extent` sets it yourself). With every layer on it is 200 au, because Voyager 1 is about 140 au out in the plane of the map. Switch the craft off and it is 50. Comets and belt bodies further out than the edge are left off; the orbit lines are cut by it.

## What it shows

- **The planets** (eight and Pluto) at their places from the package's own positions (VSOP87B, a fitted table for Pluto), each with its orbit as a line (`orbits="off"` hides the lines).
- **Dwarf planets and small bodies**: Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna, and the asteroids Vesta and Pallas and the centaurs Chiron and Pholus. Their places come from their fitted tables where `/tables` is loaded, else from the elements of one epoch, good for years either side of it.
- **The belts** (`layers` has `belts`): the main belt, the Hildas, the Jupiter Trojans, the Centaurs and the Kuiper belt as classical, resonant and scattered objects, as clouds of points in the colours of [the belts guide](belts.md). It is the package's sample, 3,340 of the 1.5 million known, so the clouds show the shapes (the gap at Jupiter, the two Trojan swarms 60 degrees ahead of and behind it) and not the true density. A point can be pressed. The elements are fetched, about 70 kB gzipped, when the layer is first on.
- **Comets**: the 34 of [the comets guide](comets.md), on two-body motion from JPL's elements, with a short tail turned from the Sun that is longest at perihelion. With `track`, or when one is chosen, its orbit as far as the edge.
- **Spacecraft**: the 19 craft of [the spacecraft guide](spacecraft.md), the Tesla Roadster (named by its car, with Starman at the wheel in the facts) in red with a white outline. A craft is drawn only while its path covers the moment (Cassini and Galileo ended long ago; the others start at launch). With `track`, or when one is chosen, its whole path, dashed where it has been and solid ahead. A craft whose place is a prediction (the car, whose path is Horizons' prediction from 2018's observations, and any craft after its mission ended) is drawn as a ring, as the flat maps draw an approximate orbiter. The craft's paths are fetched when the layer is first on.

## The attributes

| Attribute | What it does |
|---|---|
| `time` | `now`, an ISO date or milliseconds since 1970; live when left out |
| `speed` | 1 is real time, 0 holds, 86400 is a day a second, negative runs backwards |
| `paused` | holds the clock and keeps the speed; nothing is drawn while it is held |
| `selected` | the chosen body's id: `earth`, `halley`, `roadster`, or a belt body's name |
| `center` | a body to centre the map on and follow, or `sun` (the default); a drag lets go of it |
| `layers` | `planets dwarfs belts comets craft`, all by default, or `off` |
| `craft`, `comets`, `belts` | which ones: `all`, `off`, or ids with commas |
| `orbits` | `off` hides the orbit lines of the planets and dwarf planets |
| `track` | the whole path of the chosen craft and the orbit of the chosen comet, or of every one shown when none is chosen |
| `spacing` | `squeezed` (the default) or `true` |
| `extent` | the distance at the edge, in au; automatic when left out |
| `names` | `off` for no names beside the bodies, or the most names to show |
| `dot-size`, `controls`, `lang` | the dots' size, the buttons shown (`none`, or any of `centre zoom orbits track scale chips`), and `en` or `ja` (the page's language by default) |

`footprint`, `shade`, `home-lon` and `home-lat` belong to a map of a surface and are not read here. The element also has `selected`, `center`, `zoom`, `time`, `speed`, `paused`, `language`, `layers` and `extent` properties, a `bodies` property (what was drawn, with each body's kind, layer and distance), a `stats` property (draws, map draws, bodies and belt points drawn, how long a draw takes, the canvases' size), `placeOf(id)` (where a body is on the screen and in au), `auAt(x, y)` (the distance under a point of the box) and `pick(id)`.

## The same as the flat maps

The names and meanings of `time`, `speed`, `paused`, `selected`, `dot-size`, `controls`, `lang`, `track` and `names` are `<wakusei-flat>`'s, and the events are the same: `wakusei-flat-pick` (`detail` is `{ kind, id, name, layer, belt, distanceAu, x, y, predicted, via }`: `kind` is `star`, `planet`, `dwarf-planet`, `asteroid`, `centaur`, `comet`, `spacecraft` or `belt`; `via` is `hover`, `tap` or `key`; a tap on nothing sends `id: null`), `wakusei-flat-filter` (`{ layers }`), `wakusei-flat-view` (`{ center, x, y, zoom }`) and `wakusei-timechange` (`{ time, running, paused }`). A page can set the same attributes on whichever of the elements is showing and use one listener. A drag pans, two fingers pinch, the plus and minus buttons and keys zoom (up to 8 times), and Control or Command with the wheel zooms. The map is one control for the keyboard: Tab to it, the arrow keys, Page Up and Page Down, Home and End go from one body to the next from left to right, Enter chooses, Escape lets go; each step is spoken in a live region. The belt bodies, thousands of them, are reached with the pointer only, and the belts' chips are buttons.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/flat/system/define";

const system = document.querySelector("wakusei-flat-system")!;
system.addEventListener("wakusei-flat-pick", (event) => {
  const { name, kind, distanceAu } = (event as CustomEvent).detail;
  if (name !== null) console.log(`${name}, a ${kind}, ${distanceAu.toFixed(2)} au from the Sun`);
});
system.center = "roadster";
```

## Time and drawing

The map keeps the same clock as [the space view](space-view.md): it advances by the time that really passed between two looks, never by a frame's step. Every place is worked out for the exact moment of each draw. A running clock draws as often as Mercury, the fastest planet on the map, moves half a pixel (up to once a frame, and at least once in 30 seconds); at ten days a second or more a short streak is drawn behind each body, since a planet would otherwise jump. A held clock, a paused one, a map scrolled out of sight and a hidden tab draw nothing at all, and the element has no timer then. The canvases stay inside 6 million pixels and 4,096 a side. The disc, the rings and the orbit lines are drawn again only when the view, the scale or a layer changes (the lines once a year of map time), and what moves is on a second canvas.

## Words

The words are English and Japanese (`lang`), in `SYSTEM_WORDS` and `saySystem`; the planets, dwarf planets, comets and craft are named from the package's own tables in the language asked for. The rings' labels are "1 au" in both: au is the IAU's symbol, and Japanese astronomy writes it the same way.

## Without a browser

```js
import { loadSpacecraft } from "@johnmorrisdotca/wakusei-planets/spacecraft";
import { squeezeAu, systemMarks } from "@johnmorrisdotca/wakusei-planets/flat/system";

// The flat solar system needs no browser: where the Tesla Roadster and the Earth are on the map for a date, and how far out the map squeezes each.
await loadSpacecraft("roadster");
const marks = systemMarks(Date.UTC(2026, 10, 17), { layers: ["planets", "craft"], craft: ["roadster"] });
const car = marks.find((mark) => mark.id === "roadster");
const earth = marks.find((mark) => mark.id === "earth");

console.log(`The Tesla Roadster is ${car.distanceAu.toFixed(2)} au from the Sun, the Earth ${earth.distanceAu.toFixed(2)} au`);
console.log(`With the edge at 50 au, the Earth is ${Math.round(squeezeAu(1, 0, 50, "squeezed").r * 100)} per cent of the way out, squeezed, and ${Math.round(squeezeAu(1, 0, 50, "true").r * 100)} per cent to scale`);
```

It prints:

```text
The Tesla Roadster is 1.39 au from the Sun, the Earth 0.99 au
With the edge at 50 au, the Earth is 39 per cent of the way out, squeezed, and 2 per cent to scale
```

`systemMarks` places everything for a moment (the craft need `loadSpacecraft` first), `systemBelts` places the belts' bodies, `systemOrbit`, `systemCometOrbit` and `craftPath` give the lines, and `projectSystem`, `unprojectSystem`, `zoomSystemAbout` and `clampSystemView` are the view.

## What is exact and what is not

The planets are exact for the moment (no allowance for the time light takes to arrive). The map is a view from above: a body well above or below the ecliptic (Pluto, Sedna, a comet, a craft out of the plane) is drawn where it is over the plane, and its distance for the scale is the distance in the plane; the card of the demo gives the distance in three dimensions. A comet is on two-body motion from one epoch's elements and is good within a year of it ([the comets guide](comets.md) says how far). The belts are a sample and two-body motion. The Tesla Roadster's place is a prediction that drifts from the real car as the years pass after 2018's observations.
