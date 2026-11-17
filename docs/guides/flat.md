---
title: Flat maps of the Moon and Mars
section: how-to
order: 35
description: The Moon or Mars on a flat map, with day and night for any time, the landing, rover and crash sites marked, and the spacecraft in orbit moving over it with their coverage circles and ground tracks. A canvas with no WebGL, the same attributes and events as chikyu-earth's flat map.
---

`<wakusei-flat>` is a flat map of a body you can also see in 3D: the Moon or Mars, drawn from the same painted picture the 3D views use, with the night side shaded from the Sun's direction for the time you give it. The orbiters are dots that move over the map as time runs, the landing, rover and crash sites are marks on it, and a press on either sends an event. It is two 2D canvases: no WebGL, no three.js, nothing to install beside the package.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Moon and Mars on flat maps, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/flat/define/+esm"></script>
  </head>
  <body>
    <wakusei-flat body="moon" track></wakusei-flat>
    <wakusei-flat body="mars" time="2026-11-17T12:00:00Z" speed="0" footprint></wakusei-flat>
  </body>
</html>
```

The first map is the Moon, live, with a ground track under every orbiter. The second is Mars held at one moment, with the area each orbiter can see drawn round it. In a bundled app, `import "@johnmorrisdotca/wakusei-planets/flat/define"` registers the tag; `@johnmorrisdotca/wakusei-planets/flat` is the pure side, with no DOM.

## What it shows

- **The map.** The body's own surface picture, flat (equirectangular: longitude across, latitude down, the whole body, wrapping round its sides). It is the 1024-pixel picture from the package, and the 2048-pixel one once you zoom in far enough to need it. `texture-base` (and `texture-far-base`) say where your own copies are; without them the files are fetched from this version's folder on jsDelivr. A picture that cannot be fetched leaves the plain ground colour, the marks and the dots, and the element says so.
- **Day and night.** For each point of the map the Sun's height is worked out from the body's own pole and spin (the same calculation as `subSolarPoint`, so the Sun's yellow mark is where the Sun is overhead). The Moon has no air, so its edge between day and night is sharp (full night one degree below the horizon). Mars's dust lights the sky a while after sunset, so its dusk is a gradient eight degrees wide. `shade="off"` turns the night off.
- **The orbiters.** A dot for each spacecraft in orbit that has a path, at the place on the ground under it. A ring instead of a solid dot means its position is only approximate (see below). With `footprint`, the circle on the ground from which it is at least ten degrees above the horizon; with `track`, the ground track for one trip round, dashed behind and solid ahead, cut where it crosses the map's left and right edge (longitude 180°) or a pole so no line crosses the map.
- **The places.** The landing, rover and crash sites and the planned landings of [the places data](places.md) as marks: a gold diamond for a crewed landing, white for a lander, green for a rover, a cross for a crash or an impact, a dashed ring for a planned landing. The named features (the seas, craters and mountains: 768 on the Moon, 914 on Mars) are off unless you ask, and are marked only where there is room to write their name.

## What is there and what is missing

Round the Moon the map draws **LRO, Chandrayaan-2, Danuri, ARTEMIS P1 and ARTEMIS P2**. **CAPSTONE** is in the package but has no ellipse to draw (its halo orbit is not one, and its mission ended in July 2026), so it is not drawn. Round Mars it draws **MRO, Mars Odyssey, MAVEN, Mars Express, ExoMars TGO and Hope**. **Tianwen-1** has no public orbit track, so it is not drawn either. The `orbiters` property lists only the craft that can be drawn; the page that holds the map can name the others from the package's data (the demo does, under its row of orbiters).

Not in the package, and so not on the map: any other orbiter, such as Queqiao-2 and the other Chinese lunar orbiters, Kaguya and the lunar orbiters that have ended, Mars's retired orbiters (Mars Global Surveyor, Mangalyaan and the rest), and any craft launched after the data were fetched (12 November 2026). The orbit data are mean elements fitted to JPL Horizons. Each carries the window it was fitted for and an error measured against Horizons, and a craft whose place may be more than 2 per cent of the body's radius out is drawn as a ring, not a solid dot, with "position approximate" on its card: on 17 November 2026 that is all five lunar orbiters (the week they were fitted over has passed, and the worst error measured after it is 200 to 240 km, against a limit of 35 km on the Moon) and TGO and MAVEN at Mars. MAVEN's mission ended in December 2025, so what is drawn is only the mean orbit it was last on. [The orbiters guide](orbiters.md) has the numbers.

The places are the package's own for each body: 22 landings, 6 crewed landings, 13 rovers, 49 crash and impact sites and 8 planned landings on the Moon, and 12 landings, 7 rovers, 6 crashes and a planned landing on Mars, with the English and Japanese names the package holds for each. Nothing here covers Mercury, Venus or any other body yet: `body` takes `moon` or `mars`, and a flat solar system is a separate piece of work.

## The attributes

| Attribute | What it does |
|---|---|
| `body` | `moon` (the default) or `mars` |
| `center` | the longitude in the middle, in degrees (0 by default); the map wraps round the body |
| `home-lon`, `home-lat` | the reader's place, which is a chosen site here: a marker, and the "My place" button, which appear only when both are given |
| `time` | `now`, an ISO date or milliseconds since 1970; live when left out |
| `speed` | 1 is real time, 0 holds, 86400 is a day a second, negative runs backwards |
| `paused` | holds the clock and keeps the speed; nothing is drawn while it is held |
| `footprint`, `track` | the coverage circle and the ground track; of the chosen orbiter, or of every orbiter when none is chosen |
| `footprint-elevation` | the degrees above the horizon the circle is drawn for (10) |
| `selected` | the chosen orbiter's id (`lro`) or a place's (`moon/apollo-11-lunar-module`) |
| `orbiters` | `all` (the default), `off`, or some ids with commas |
| `places` | the kinds of place marked: `landing` (crewed, landing and rover sites; the default), `crash`, `planned`, `feature`, several of them, `all` or `off` |
| `names` | `off` for no names beside the marks, or the most names to show |
| `shade`, `dot-size`, `controls`, `lang` | the night (`off`), the dots' size, the buttons shown (`none`, or any of `centre zoom footprint track chips`), and `en` or `ja` (the page's language by default) |
| `texture-base`, `texture-far-base` | where the body's pictures are |

The element also has `center`, `zoom`, `time`, `speed`, `paused`, `selected`, `language`, `orbiters`, `places` and `layers` properties, a `stats` property (draws, map draws, orbiters and marks drawn, how long a draw takes, the canvases' size), `placeOf(id)` (where an orbiter or a mark is on the screen) and `pick(id)`.

## The same as the Earth's flat map

[chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth) has `<chikyu-flat>`, the satellites round the Earth on a flat map. This element uses the same attribute names with the same meanings (`center`, `home-lon`, `home-lat`, `time`, `speed`, `paused`, `footprint`, `track`, `selected`, `shade`, `dot-size`, `controls`, `lang`), the same events with `wakusei-` where chikyu's have `chikyu-` (`wakusei-flat-pick`, `wakusei-flat-view`, `wakusei-flat-filter` and the space view's `wakusei-timechange`), the same buttons, chips and look for dots, rings and tips, and the same equirectangular geometry (`projectFlat`, `unprojectFlat`, `zoomAbout`, `clampView`). A page that offers the Earth, the Moon and Mars behind one control can set the same attributes on whichever element is showing, and listen for the same events:

```ts no-run
const maps = { earth: document.querySelector("chikyu-flat")!, moon: document.querySelector("wakusei-flat")! };
const pick = (event: Event) => console.log((event as CustomEvent<{ id: unknown; name: string | null; via: string }>).detail);
for (const map of Object.values(maps)) {
  map.addEventListener("chikyu-flat-pick", pick);
  map.addEventListener("wakusei-flat-pick", pick);
}
```

What differs is what there is to pick: a satellite's `id` is its catalogue number there and an orbiter's or place's name here, and `detail.kind` (`orbiter` or `place`) tells which of the two it is.

## The events

- `wakusei-flat-pick`: an orbiter or a place under the pointer, tapped, or reached by the keyboard. `detail` is `{ kind, id, name, body, lat, lon, altitudeKm, status, placeKind, via }`; `via` is `hover`, `tap` or `key`. A tap on nothing sends `id: null` and clears the choice. The element names what is under the pointer itself (a tip and a ring); the page decides what a tap does.
- `wakusei-flat-filter`: a chip changed what is shown: `{ orbiters, layers }`.
- `wakusei-flat-view`: the reader panned or zoomed: `{ center, zoom }`.
- `wakusei-timechange`: `{ time, running, paused }`, at most four times a second while time runs.

## Time

The map keeps the same clock as [the space view](space-view.md): it advances by the time that really passed between two looks, at the speed it runs at, never by a frame's step, so a day a second is a day a second on any machine. The orbiters are worked out for the exact moment of every draw, so a dot is never behind or off its orbit at any speed. At a fast clock a dot would jump a long way between two frames, so it is drawn with a short streak behind it. A running clock draws as often as an orbiter moves half a pixel (up to once a frame, and at least once a second); a held clock, a paused one, a map scrolled out of sight and a hidden tab draw nothing at all, and the element has no timer then.

## Touch, keyboard and words

A drag pans, two fingers pinch, the plus and minus buttons zoom (and so do the `+` and `-` keys), and Control or Command with the wheel zooms; a plain wheel scrolls the page. The map is one control for the keyboard: Tab to it, the arrow keys, Page Up and Page Down, Home and End go from one orbiter or mark to the next from left to right, Enter chooses, Escape lets go. Each step is spoken in a live region ("Lunar Reconnaissance Orbiter, orbiting the Moon, 113 km up"). The words are English and Japanese (`lang`): the body, the orbiters and the sites are named from the package's own tables in the language asked for.

## Without a browser

```js
import { flatOrbiter, flatSun, hasPath } from "@johnmorrisdotca/wakusei-planets/flat";

// The flat map needs no browser: where the Sun is overhead on the Moon at the Apollo 11 landing, and where two orbiters are over the ground now.
const landing = flatSun("moon", Date.UTC(1969, 6, 20, 20, 17, 40));
const time = Date.UTC(2026, 10, 12);
const lro = flatOrbiter("lro", time);
const mro = flatOrbiter("mro", time);

console.log(`Apollo 11: the Sun is overhead at ${landing.lon.toFixed(0)} degrees east, ${Math.abs(landing.lat).toFixed(0)} degrees from the equator`);
console.log(`LRO is ${lro.altitudeKm.toFixed(0)} km up, MRO ${mro.altitudeKm.toFixed(0)} km`);
console.log(`Tianwen-1 has a path to draw: ${hasPath("tianwen-1")}`);
```

It prints:

```text
Apollo 11: the Sun is overhead at 103 degrees east, 0 degrees from the equator
LRO is 113 km up, MRO 244 km
Tianwen-1 has a path to draw: false
```

The pure side also has `flatBody` (a body's radius and orbiters), `shadeNight` (the night's shading for a grid of pixels), `circleOutline` (a coverage circle as a line on a flat map), `flatTrack` and `trackPieces` (a ground track cut for a flat map), and the words (`FLAT_WORDS`, `say`, `coordinateText`).
