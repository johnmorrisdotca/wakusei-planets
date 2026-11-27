---
title: Flat maps of any planet or moon
section: how-to
order: 35
description: "Any planet, dwarf planet or moon the package has a picture of, flat: as the photograph or as a line map, with day and night for any time, the sunrise line, the sites and named features, the spacecraft in orbit round the Moon and Mars, and marks of your own. A canvas with no WebGL, the same attributes, key and events as chikyu-earth's flat map."
---

`<wakusei-flat>` is a flat map of a body you can also see in 3D: any of the 28 planets, dwarf planets and moons the package has a picture of (Mercury to Charon, Earth's Moon and the moons of Mars, Jupiter, Saturn, Neptune and Pluto's Charon among them), drawn from the same painted picture the 3D views use, with the night side shaded from the Sun's direction for the time you give it and the line where the Sun is rising or setting drawn on it. It has two looks, **Photo** (the picture itself) and **Map** (a line map drawn from the same picture), and an optional Map / Photo control. Round the Moon and Mars the orbiters are dots that move over the map as time runs and the landing, rover and crash sites are marks on it; for any body a page can add marks of its own. A press on any of them sends an event. It is two 2D canvases: no WebGL, no three.js, nothing to install beside the package.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flat maps of the Moon, Mars and Jupiter, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/flat/define/+esm"></script>
  </head>
  <body>
    <wakusei-flat body="moon" track></wakusei-flat>
    <wakusei-flat body="mars" time="2026-11-17T12:00:00Z" speed="0" footprint></wakusei-flat>
    <wakusei-flat body="jupiter" look="map" controls="centre look zoom key"></wakusei-flat>
  </body>
</html>
```

The first map is the Moon, live, with a ground track under every orbiter. The second is Mars held at one moment, with the area each orbiter can see drawn round it. The third is Jupiter as a line map, with the Map / Photo buttons and the key. In a bundled app, `import "@johnmorrisdotca/wakusei-planets/flat/define"` registers the tag; `@johnmorrisdotca/wakusei-planets/flat` is the pure side, with no DOM.

## What it shows

- **The map, in two looks.** The body's own surface picture, flat (equirectangular: longitude across, latitude down, the whole body, wrapping round its sides). It is the 1024-pixel picture from the package, and the 2048-pixel one once you zoom in far enough to need it (Europa has only the 1024). `texture-base` (and `texture-far-base`) say where your own copies are; without them the files are fetched from this version's folder on jsDelivr. No picture is new: the same files the 3D views use, with the same credits. A picture that cannot be fetched leaves the plain ground colour, the grid, the marks and the dots, and the element says so.
  - `look="photo"` (the default) is the picture itself.
  - `look="map"` is a line map drawn from that picture on your machine: its brightness is smoothed and cut into five dark tones of equal area (the darkest fifth of the body is the darkest tone, whatever its colour), with a pale line where one tone meets the next, a grid every 30 degrees (every 15 and then 10 as you zoom in) with its degrees written along the edges, and the named features marked where the package has them (the sea and ground tones follow the picture's own light and dark: on the Moon the maria, on Mars the dark regions, on Jupiter the bands). There is no outline data for a planet, so the contours are the picture's own albedo.
  - The Map / Photo control is `controls="... look"` (it is not among the defaults, so a page that does not ask for it gets no new button) and `look` is a property too. `lookState` says how it stands: `loading`, `map`, `photo` or `failed`; `wakusei-flat-look` carries `{ look, state }`.
- **Day and night.** For each point of the map the Sun's height is worked out from the body's own pole and spin (the same calculation as `subSolarPoint`). The night side is clearly darker, and a pale dashed line, with a dark edge, runs along the sunrise and sunset line: the circle where the Sun is on the horizon. The Sun's yellow dot, with a pale ring, is where it is overhead. A body with no air has a sharp edge between day and night (full night one degree below the horizon: the Moon); thick air spreads the light, so Mars's dusk is a gradient eight degrees wide, Venus and Titan ten, the Earth twelve. `shade="off"` turns the night, the line and the Sun's dot off.
- **The orbiters.** Round the Moon and Mars, a dot for each spacecraft in orbit that has a path, at the place on the ground under it. A ring instead of a solid dot means its position is only approximate (see below). With `footprint`, the circle on the ground from which it is at least ten degrees above the horizon; with `track`, the ground track for one trip round, dashed behind and solid ahead, cut where it crosses the map's left and right edge (longitude 180°) or a pole so no line crosses the map.
- **The places.** The landing, rover and crash sites, the planned landings and the named features of [the places data](places.md) as marks: a gold diamond for a crewed landing, white for a lander, green for a rover, a cross for a crash or an impact, a dashed ring for a planned landing, and a small dot for a named feature (the seas, craters and mountains: 768 on the Moon, 914 on Mars, and the names the package holds for Mercury, Venus, Ceres, Vesta, Pluto and Charon, Io, Europa, Ganymede, Callisto, Titan and the other moons of Saturn and Neptune). The Earth, Uranus, Neptune, Phobos, Deimos and Phoebe have no places in the package, and so have the picture, the night and your marks. The sites are on in the photo look; the map look adds the named features (`places` says which, and so does a press on a chip), which are marked only where there is room to write their name.
- **The moons.** `moons` marks each moon of the body over the place on its ground that it is straight above, as a dot with its name beside it, named when pointed at, pressable (`wakusei-flat-pick` with `kind: "mark"`, `mark.group` `moons` and `mark.data` `{ moon, distanceKm }`), reached by the arrow keys and in the key. The Earth has one (the Moon), Mars two, Jupiter six, Saturn nineteen, Uranus five, Neptune four and Pluto three; a body with none (Mercury, Venus, any moon) has no chip. They are off until `moons` or the **Moons** chip asks; `moons` alone or `moons="all"` is every moon, `moons="io,europa"` some, `moons="off"` none. With `track` (or by choosing a moon) the path each moon draws over the ground is drawn: dashed behind it and solid ahead, half a turn of the planet either way (the planet turns under a moon, so Io draws a long line round Jupiter's equator, while Charon stays over one place on Pluto). A place's name is painted after those moving dots, so a dot cannot cover it.
- **Marks of your own.** Anything a page wants on the ground (favourites, the places of moons or orbiters, landers) is a mark: see "Marks of your own" below.
- **The key.** Under the map, never over it, a row names every mark drawn now, each beside a small picture of it, in English or Japanese: the Sun overhead, the sunrise and sunset line, the night side, My place, an orbiter (and a faint one), the one you chose, the footprint and the ground track while they are on, each kind of place on the map, each group of your marks, and the picture's whole credit. What is not drawn is not in it. It is open on a map 600 px wide or more and shut on a narrower one (a phone) until the **Key** button is pressed; `keyOpen` sets it from code. `controls` without `key` leaves it out.
- **The credit.** One small line at the map's bottom edge, in both looks, since the line map is drawn from the picture: `Mars: NASA / USGS (public domain)` on a wide map, `Mars: NASA / USGS` on a narrow one, and a tap or a press opens the whole credit (author, licence and, for a CC BY 4.0 picture, what was changed). The key carries the whole credit too.

## What is there and what is missing

Round the Moon the map draws **LRO, Chandrayaan-2, Danuri, ARTEMIS P1 and ARTEMIS P2**. **CAPSTONE** is in the package but has no ellipse to draw (its halo orbit is not one, and its mission ended in July 2026), so it is not drawn. Round Mars it draws **MRO, Mars Odyssey, MAVEN, Mars Express, ExoMars TGO and Hope**. **Tianwen-1** has no public orbit track, so it is not drawn either. The `orbiters` property lists only the craft that can be drawn; the page that holds the map can name the others from the package's data (the demo does, under its row of orbiters).

Only the Moon and Mars have orbiters in the package, so on any other body the footprint and ground-track buttons and the orbiter chip are left out. Not in the package, and so not on the map: any other orbiter, such as Queqiao-2 and the other Chinese lunar orbiters, Kaguya and the lunar orbiters that have ended, Mars's retired orbiters (Mars Global Surveyor, Mangalyaan and the rest), and any craft launched after the data were fetched (12 November 2026). The orbit data are mean elements fitted to JPL Horizons. Each carries the window it was fitted for and an error measured against Horizons, and a craft whose place may be more than 2 per cent of the body's radius out is drawn as a ring, not a solid dot, with "position approximate" on its card: on 17 November 2026 that is all five lunar orbiters (the week they were fitted over has passed, and the worst error measured after it is 200 to 240 km, against a limit of 35 km on the Moon) and TGO and MAVEN at Mars. MAVEN's mission ended in December 2025, so what is drawn is only the mean orbit it was last on. [The orbiters guide](orbiters.md) has the numbers.

The places are the package's own for each body: 22 landings, 6 crewed landings, 15 rovers, 49 crash and impact sites and 8 planned landings on the Moon, and 12 landings, 7 rovers, 6 crashes and a planned landing on Mars, with the English and Japanese names the package holds for each. The other bodies have no sites of their own to mark yet; [the flat solar system](flat-system.md) is the map of the planets themselves.

## The bodies

`body` takes any of these (`moon` is the default), and the same names the `FLAT_BODIES` list of the pure side gives:

| | |
|---|---|
| Planets and dwarf planets | `mercury`, `venus`, `earth`, `mars`, `ceres`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto` |
| Moons | `moon`; `phobos`, `deimos`; `io`, `europa`, `ganymede`, `callisto`; `mimas`, `enceladus`, `tethys`, `dione`, `rhea`, `titan`, `iapetus`, `phoebe`; `triton`; `charon` |
| Minor body | `vesta` |

Every one has its picture in the package (so a photo look), its credit, a pole and a spin to place the Sun by, and its own twilight. The gas and ice giants are drawn from their cloud tops, which turn with the planet's own spin (the one `subSolarPoint` uses), so the line and the night are where the Sun is over the clouds. Six of the pictures are CC BY 4.0 (Mercury, Venus, Jupiter, Saturn, Uranus and Neptune) and the rest are public domain; the credit is on the map either way, and the line map carries it as well. The Sun itself is not drawn: it has no ground to be night on.

## The attributes

| Attribute | What it does |
|---|---|
| `body` | the body (see above); `moon` by default |
| `look` | `photo` (the default: the picture) or `map` (the line map). Not the default of chikyu-earth's `<chikyu-flat>`, which starts on its drawn map because its picture is new; here the picture is what the element has always drawn |
| `center` | the longitude in the middle, in degrees (0 by default); the map wraps round the body |
| `home-lon`, `home-lat` | the reader's place, which is a chosen site here: a marker, and the "My place" button, which appear only when both are given |
| `time` | `now`, an ISO date or milliseconds since 1970; live when left out |
| `speed` | 1 is real time, 0 holds, 86400 is a day a second, negative runs backwards |
| `paused` | holds the clock and keeps the speed; nothing is drawn while it is held |
| `moons` | the moons of the body over their places: `all` (or no value), some ids with commas, or `off` (the default) |
| `footprint`, `track` | the coverage circle and the ground track; of the chosen orbiter, or of every orbiter when none is chosen. `track` also draws the moons' tracks |
| `footprint-elevation` | the degrees above the horizon the circle is drawn for (10) |
| `selected` | the chosen orbiter's id (`lro`) or a place's (`moon/apollo-11-lunar-module`) |
| `orbiters` | `all` (the default), `off`, or some ids with commas |
| `places` | the kinds of place marked: `landing` (crewed, landing and rover sites; the default in the photo look), `crash`, `planned`, `feature`, several of them, `all` or `off`. With none given the map look marks the sites and the named features |
| `names` | `off` for no names beside the marks, or the most names to show |
| `site-flags` | the landing sites carry their country's flag, beside the name and in the tip (see below) |
| `shade`, `dot-size`, `controls`, `lang` | the night, the sunrise line and the Sun's dot (`off`), the dots' size, the buttons shown (`none`, or any of `centre zoom footprint track chips key look`; all but `look` by default), and `en` or `ja` (the page's language by default) |
| `texture-base`, `texture-far-base` | where the body's pictures are |

The element also has `look`, `lookState`, `keyOpen`, `center`, `zoom`, `time`, `speed`, `paused`, `selected`, `language`, `orbiters`, `places`, `layers`, `marks` and `groups` properties, a `stats` property (draws, map draws, orbiters and marks drawn, which look, how long a draw takes, the canvases' size), `setMarks(group, marks, label)` and `clearMarks(group)`, `placeOf(id)` (where an orbiter or a mark is on the screen) and `pick(id)`.

### Style

`--wakusei-flat-sea` and `--wakusei-flat-land` (the darkest and lightest tone of the map look, `#rrggbb`) and `--wakusei-flat-line` (the line between tones) are read when the line map is made; `--wakusei-flat-key-inset` (0) keeps that much room at the left of the key, for a card that lies over the map's left side; `--wakusei-flat-aspect` (2 / 1), `--wakusei-flat-aspect-narrow` (4 / 3, under 600 px wide) and `--wakusei-flat-radius` set the shape of the map and its corners. Give the element a height and the map fills it.

## The same as the Earth's flat map

[chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth) has `<chikyu-flat>`, the satellites round the Earth on a flat map. This element uses the same attribute names with the same meanings (`look`, `center`, `home-lon`, `home-lat`, `time`, `speed`, `paused`, `footprint`, `track`, `selected`, `shade`, `dot-size`, `controls` with its `key` and `look` words, `lang`), the same events with `wakusei-` where chikyu's have `chikyu-` (`wakusei-flat-pick`, `wakusei-flat-view`, `wakusei-flat-filter`, `wakusei-flat-look` and the space view's `wakusei-timechange`), the same buttons, chips, Map / Photo pair, key and one-line credit, the same look for dots, rings and tips, and the same equirectangular geometry (`projectFlat`, `unprojectFlat`, `zoomAbout`, `clampView`). A page that offers the Earth, the Moon and Mars behind one control can set the same attributes on whichever element is showing, and listen for the same events:

```ts no-run
const maps = { earth: document.querySelector("chikyu-flat")!, moon: document.querySelector("wakusei-flat")! };
const pick = (event: Event) => console.log((event as CustomEvent<{ id: unknown; name: string | null; via: string }>).detail);
for (const map of Object.values(maps)) {
  map.addEventListener("chikyu-flat-pick", pick);
  map.addEventListener("wakusei-flat-pick", pick);
}
```

What differs is what there is to pick: a satellite's `id` is its catalogue number there and an orbiter's, place's or mark's name here, and `detail.kind` (`orbiter`, `place` or `mark`) tells which it is; and the default look, which is `map` there and `photo` here.

## The events

- `wakusei-flat-pick`: one event for everything that can be pressed: an orbiter, a place of the tables (a landing, a rover, a crash, a crater, a mountain), a landing site or a mark of your own. `detail` is `{ kind, id, name, body, lat, lon, altitudeKm, status, placeKind, place, site, mark, via }`: `kind` is `orbiter`, `place` or `mark` (for a mark, `mark` is its record with your `data`); for a place, `place` is its record from the places data (names in both languages, kind, mission, operator, country, date, a feature's type and size) and `site` is its landing site from [`/landing-sites`](landing-sites.md) (the names, the day, the agency, the country with its flag code, the source of the coordinates) when it is one (the lander, and the rover or descent stage on the same spot); both are left out otherwise. `via` is `hover`, `tap` or `key`. A tap on nothing sends `id: null` and clears the choice. The element names what is under the pointer itself (a tip and a ring); the card is the page's: build it from the event, as the demo does.
- `wakusei-flat-filter`: a chip changed what is shown: `{ orbiters, layers }`.
- `wakusei-flat-look`: the look or how it stands changed: `{ look, state }`.
- `wakusei-flat-view`: the reader panned or zoomed: `{ center, zoom }`.
- `wakusei-timechange`: `{ time, running, paused }`, at most four times a second while time runs.

## Marks of your own

A mark is a point on the ground with a name. Give the element a group of them and it draws them over the picture, names each when it is pointed at, pressed or reached by the keyboard (Tab to the map, then the arrow keys), reads it aloud, lists the group in the key under its label, and sends `wakusei-flat-pick` with `kind: "mark"`. It is the way in for anything a page wants on the map: the sub-points of moons, favourite places, orbiters, landers. A page that moves a mark calls `setMarks` again; the map draws at the next frame, and nothing is drawn while nothing changes.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/flat/define";

const map = document.querySelector("wakusei-flat")!;
map.setAttribute("body", "mars");
map.setMarks("favourites", [
  { id: "olympus", lat: 18.65, lon: -133.8, name: { en: "Olympus Mons", ja: "オリンポス山" }, shape: "diamond", colour: "#ffd23f", labelled: true },
  { id: "valles", lat: -13.9, lon: -59.2, name: { en: "Valles Marineris", ja: "マリネリス峡谷" }, shape: "star", data: { note: "the great canyon" } },
], { en: "My favourites", ja: "お気に入り" });
map.addEventListener("wakusei-flat-pick", (event) => {
  const { kind, mark } = (event as CustomEvent).detail;
  if (kind === "mark") console.log(mark.name, mark.data);
});
```

A mark is `{ id, lat, lon, name, group?, shape?, colour?, size?, labelled?, data? }`: `id` is unique across the element (a later mark with the same id replaces the earlier), `name` is a text or `{ en, ja }`, `shape` is `dot` (the default), `ring`, `diamond`, `square`, `cross` or `star`, `colour` is any CSS colour and `size` the radius in pixels (2 to 12, 4 by default). `labelled` writes the name beside the mark where there is room. A bad mark (no id, no name, a place that is not a number) is dropped; a longitude is wrapped and a latitude held to the poles. `map.marks` lists them, `map.groups` the groups, `clearMarks("favourites")` takes one group away and `clearMarks()` all of them. `readMarks` and `markName` of the pure side do the checking.

## Landing sites and their flags

The landing sites of `/landing-sites` (28 on the Moon, 11 on Mars) are named by their own names (Apollo 11, not "Apollo 11 lunar module"), once, on the lander. With `site-flags` each carries its country's flag: a `<hata-flag>` element beside the name on the map and in front of the tip, the same way the 3D views do it with their `site-flags`. The flag comes from `@johnmorrisdotca/hata`, which your page imports (`import "@johnmorrisdotca/hata/element/define"`); this package does not depend on it, and where the element is not defined nothing is drawn and the name stands alone. A rover or a descent stage on a landing's spot is that landing: pressing it sends the same `site`.

```ts no-run
import "@johnmorrisdotca/hata/element/define";
import "@johnmorrisdotca/wakusei-planets/flat/define";

const map = document.querySelector("wakusei-flat")!;
map.toggleAttribute("site-flags", true);
map.addEventListener("wakusei-flat-pick", (event) => {
  const { kind, place, site } = (event as CustomEvent).detail;
  if (kind === "place") console.log(place.name.en, site?.agency.en, site?.country, site?.date);
});
```

## Time

The map keeps the same clock as [the space view](space-view.md): it advances by the time that really passed between two looks, at the speed it runs at, never by a frame's step, so a day a second is a day a second on any machine. The orbiters are worked out for the exact moment of every draw, so a dot is never behind or off its orbit at any speed. At a fast clock a dot would jump a long way between two frames, so it is drawn with a short streak behind it. A running clock draws as often as an orbiter moves half a pixel (up to once a frame, and at least once a second); a held clock, a paused one, a map scrolled out of sight and a hidden tab draw nothing at all, and the element has no timer then.

## Touch, keyboard and words

A drag pans, two fingers pinch, the plus and minus buttons zoom (and so do the `+` and `-` keys), and Control or Command with the wheel zooms; a plain wheel scrolls the page. The map is one control for the keyboard: Tab to it, the arrow keys, Page Up and Page Down, Home and End go from one orbiter or mark to the next from left to right, Enter chooses, Escape lets go. Each step is spoken in a live region ("Lunar Reconnaissance Orbiter, orbiting the Moon, 113 km up"). The words are English and Japanese (`lang`): the body, the orbiters and the sites are named from the package's own tables in the language asked for.

## Any body, in a projection

`<wakusei-flat>` draws its maps in the equirectangular projection. The pure `/flat` API also projects the painted map of a body five ways. The demo's flat page uses it for every mapped planet, dwarf planet, moon and asteroid, including all five of Uranus's large moons. Choose the body, the projection, the centre and the grid. The Sun's ring shows where it is overhead at the selected time. The selected map keeps its [surface picture credit](surface-maps.md), and the map stays still if you prefer reduced motion.

| Projection | What it keeps | The shape |
|---|---|---|
| `equirectangular` | the picture as drawn | a rectangle twice as wide as tall |
| `mercator` | angles (a small shape keeps its shape); stops at 85.05 degrees north and south, where the poles would be at infinity | a square |
| `sinusoidal` | areas; every parallel its true length | a leaf |
| `mollweide` | areas | an ellipse twice as wide as tall |
| `azimuthal` | distances from the middle (an azimuthal equidistant map; the middle can be any point, a pole among them) | a disc; the point opposite the middle is its rim |

`projectMap(projection, lon, lat, centre)` and `unprojectMap(projection, x, y, centre)` go each way, in radii from the middle of the map (x east, y north); `unprojectMap` answers `null` outside the leaf, the ellipse or the disc. `graticule(projection, step, centre)` gives the lines of longitude and latitude as pieces of line to draw, cut where they would cross the map (the rim of the disc), and never at a pole on Mercator; `mapOutline` is the edge; `fitMap` and `mapPixels` put the map in a box; `mapSun` is the sub-solar point on the map; and `resampleMap(picture, projection, width, height, { centre, zoom })` turns a body's painted map (its pixels, from `ImageData` or any array of RGBA bytes) into the same body in the projection, smooth between pixels, wrapping at the seam and holding at the poles, with transparent pixels outside the map's shape. None of it needs a page, a canvas or a dependency.

```js
import { PROJECTIONS, graticule, projectMap, resampleMap, unprojectMap } from "@johnmorrisdotca/wakusei-planets/flat";

// Where Olympus Mons on Mars (18.65 degrees north, 133.8 degrees west) falls on each map, in radii from the middle, and the way back.
for (const projection of PROJECTIONS) {
  const { x, y } = projectMap(projection, -133.8, 18.65);
  const back = unprojectMap(projection, x, y);
  console.log(`${projection}: ${x.toFixed(2)}, ${y.toFixed(2)}; back at ${back.lat.toFixed(2)}, ${back.lon.toFixed(2)}`);
}

// The lines of a 30 degree grid on a Mollweide map, and a painted map of two pixels redrawn on it.
console.log(`${graticule("mollweide", 30).length} lines`);
const picture = { width: 2, height: 1, data: [255, 0, 0, 255, 0, 0, 255, 255] };
const answer = resampleMap(picture, "mollweide", 40, 20);
console.log(`${answer.length / 4} pixels, the corner is ${answer[3] === 0 ? "empty" : "drawn"}`);
```

It prints:

```text
equirectangular: -2.34, 0.33; back at 18.65, -133.80
mercator: -2.34, 0.33; back at 18.65, -133.80
sinusoidal: -2.21, 0.33; back at 18.65, -133.80
mollweide: -2.03, 0.36; back at 18.65, -133.80
azimuthal: -2.07, 0.97; back at 18.65, -133.80
18 lines
800 pixels, the corner is empty
```

`<wakusei-flat>` itself still draws the plain map only: its pans, picks and ground tracks all read the plain map, so giving the element a `projection` attribute is a larger change and is not part of this.

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

The Sun and the line between day and night work for every body of the map, and so does the line map's drawing, which is plain arithmetic on a picture's pixels:

```js
import { MAP_LAND, MAP_SEA, flatSun, flatSunRate, sunriseLine, toneMap, toneRamp } from "@johnmorrisdotca/wakusei-planets/flat";

// Where the Sun is overhead on Venus, Mars and Titan, how fast it crosses the ground, and the sunrise line round it.
const when = Date.UTC(2026, 10, 12, 12);
for (const body of ["venus", "mars", "titan"]) {
  const sun = flatSun(body, when);
  const line = sunriseLine(sun, 72);
  console.log(`${body}: the Sun is over ${sun.lat.toFixed(1)}, ${sun.lon.toFixed(1)}, crossing ${(flatSunRate(body, when) * 3600).toFixed(2)} degrees an hour; the line has ${line.length} points`);
}

// The line map of a picture four pixels wide, from black to white: the same four pixels in the dark tones of the ramp, every one opaque.
const pixels = new Uint8ClampedArray([10, 10, 10, 255, 90, 90, 90, 255, 160, 160, 160, 255, 250, 250, 250, 255]);
const map = toneMap(pixels, 4, 1);
console.log(`${map.length / 4} pixels, opaque: ${map.every((value, i) => i % 4 !== 3 || value === 255)}; the ramp has ${toneRamp(MAP_SEA, MAP_LAND).length} tones`);
```

It prints:

```text
venus: the Sun is over -0.2, -146.2, crossing 0.13 degrees an hour; the line has 73 points
mars: the Sun is over 8.7, 156.2, crossing 14.60 degrees an hour; the line has 73 points
titan: the Sun is over -8.3, 112.9, crossing 0.94 degrees an hour; the line has 73 points
4 pixels, opaque: true; the ramp has 5 tones
```

The pure side also has `flatBody` (a body's radius, twilight and orbiters), `shadeNight` (the night's shading for a grid of pixels), `circleOutline` (a coverage circle as a line on a flat map), `flatTrack` and `trackPieces` (a ground track cut for a flat map), the looks (`readLook`, `toneMap`, `toneRamp`, `bandEdges`, `pictureWidth`, `creditWho`, `creditLicence`), the marks (`readMarks`, `markName`), and the words (`FLAT_WORDS`, `say`, `coordinateText`, `gridText`).
