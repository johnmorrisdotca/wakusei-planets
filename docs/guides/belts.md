---
title: The asteroid belts and the Kuiper belt
section: how-to
order: 17
description: Seven belts of real small bodies (the main belt, the Hildas, the Jupiter Trojans, the Centaurs and the Kuiper belt) drawn in the space view, one draw for each, with a flight into the main belt, and the same data for a server.
---

[日本語](ja/belts.md)

`<wakusei-space>` draws the belts by default: a few thousand numbered small bodies from NASA/JPL's Small-Body Database, each on its real orbit for the date shown, in seven belts and seven colours. Zoom out to the whole solar system and the main belt shows as a band between Mars and Jupiter, the Trojans as two swarms on Jupiter's orbit, and the Kuiper belt beyond Neptune. `@johnmorrisdotca/wakusei-planets/belts` is the same data without the view.

| Belt | What it is | Known | Drawn |
|---|---|---|---|
| `main` | between Mars and Jupiter, 2.1 to 3.3 au from the Sun | 1,429,419 | 1,300 |
| `hilda` | locked to Jupiter, 3.9 to 4.1 au out | 7,929 | 220 |
| `trojan` | two swarms on Jupiter's orbit, 60 degrees ahead of it and 60 behind | 16,472 | 520 |
| `centaur` | icy bodies on orbits that cross the giant planets | 1,087 | 200 |
| `classical` | the Kuiper belt on nearly round orbits, 39 to 48 au | 3,000 | 300 |
| `resonant` | in step with Neptune (Pluto and the plutinos are 3:2) | 2,306 | 500 |
| `scattered` | long, tilted orbits thrown outwards by Neptune | 2,266 | 300 |

*Known* is what the database held on 2026-11-10 (1,580,096 asteroids in all, 895,910 of them numbered); *drawn* are the brightest numbered bodies of each belt, which is what a few thousand dots can honestly be. The Hildas and the three kinds of the Kuiper belt are cut by their orbits' elements (a true resonance is a matter of libration, which a number cannot say), and Ceres, Vesta, Pallas, Chiron, Pholus, Pluto and the other dwarf planets are bodies of their own, so they are not in a belt as well. The Oort cloud has no orbits to draw: in the squeezed scale the view draws its inner edge, about 2,000 au out, as a shell of three circles with a label.

## In the view

```html
<wakusei-space scale="true"></wakusei-space>
<script type="module">
  import "@johnmorrisdotca/wakusei-planets/space/element";
  const space = document.querySelector("wakusei-space");
  space.belts = ["main", "trojan"]; // only these two; `[]` (or belts="off") for none
</script>
```

Each belt is one instanced draw: the graphics card works out where every body is from its elements and the date, so running time costs no work on the processor, and a view at rest draws nothing. The elements come in a chunk of their own (about 70 kB gzipped) that the view fetches when it first draws them; the page and the element do not carry it. The belts are the package's own source in the data door (`wakusei-belts`), credited with the pictures and the positions ("NASA/JPL Small-Body Database", public domain), kept by `data="own"`, and not among `space.sources`. The attribute `belts` says the same as the property: `belts="off"`, or names separated by spaces.

## Through the belt

`enterBelt()` flies the camera into a belt. It goes to a point in the middle of the belt on a circle round the Sun, tilted six degrees to the ecliptic so that it passes through the belt's thickness, looking the way it goes with the ecliptic's north at the top, and a drag looks about. The scale is true: the squeezed scale does not map a camera that moves among the bodies. It flies at 0.3 au a day of game time, about thirty times faster than the bodies themselves, so they drift past; at the demo's hour a second a lap of the main belt takes about twenty minutes.

```js no-run
const space = document.querySelector("wakusei-space");
space.enterBelt("main"); // or "hilda", "trojan", "centaur", "classical", "resonant", "scattered"
space.addEventListener("wakusei-ride", () => console.log(space.flyingThrough)); // "main", then null after leaveBelt()
space.leaveBelt();
```

A line on the view says what it is, in the element's `lang`: how many bodies are known, that neighbours are typically a few million kilometres apart (about ten Moon distances in the main belt: the Moon is 384,400 km from the Earth), that space here is almost all empty, and that the dots drawn are only the brightest few, made large enough to see. Honest spacing is the point: the belt is not a field of rocks.

## For a server or a script

The belts entry is pure: no page, no three.js.

```ts
import { beltDensity, beltNote, beltPositions, beltSpacing, loadBeltBodies } from "@johnmorrisdotca/wakusei-planets/belts";

const bodies = await loadBeltBodies(); // every belt, the brightest first in each
const jd = 2461350.5; // a Julian date, TT
const main = bodies.filter((body) => body.belt === "main");
const place = beltPositions(main, jd); // x, y, z in au for each: heliocentric, ecliptic of J2000
console.log(main.length, place.length / 3);

const density = beltDensity(bodies, jd, { from: 1, to: 6, bins: 5 }); // how many in each slice of distance, and to the cubic au
console.log(density.count.join(", "));

const spacing = beltSpacing("main", bodies, jd); // kilometres between neighbours
console.log(Math.round(spacing.known / 1e6), "million km apart if only the known bodies were there");
console.log(beltNote("main", spacing, "en"));
```

`BELTS` has each belt's names, colour and counts, `BELT_TOTALS` what the database held, `parseBeltRows` reads the data's text, `beltsSource()` is the belts as a source of the data door for another view, and `beltFlight(belt)` is the flight's point (the `RidePoint` that `space.ride(point, { around: "sun", look: "ahead" })` takes). The orbits are two-body ellipses from each body's elements at JD 2461200.5 (2026-06-09), so a planet's pull is not in them: good to a degree or so for years either side, worse far from the epoch (the Trojans and the Hildas, in resonance with Jupiter, drift first). The data is made by `scripts/make-belts-data.py` from a few queries of the Small-Body Database; NOTICE.md says what was asked.
