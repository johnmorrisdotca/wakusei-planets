---
title: The size line-up
section: how-to
order: 7
description: The Sun and the largest stars known side by side at true relative size, each drawn from its numbers and labelled with its radius, its error and its paper; zoom, turn, save and print, and every way to put it in a page.
---

`<wakusei-lineup>` shows stars at **true relative size**, side by side or one above the next, each drawn with the package's star look, each labelled with its radius in Suns and in kilometres, the error on it and the paper it comes from. A slider zooms smoothly from the smallest body up to the largest star; each star turns slowly, and a drag turns the one it takes hold of. An option adds the Earth and Jupiter from the package's own facts. The stars are drawn through the page's one shared WebGL context, with the same freeze rules as every other element: nothing is drawn at rest or out of sight.

## What is in it

The Sun, Sirius A, Vega, Arcturus, Aldebaran, Rigel, Antares, Betelgeuse and the largest stars known: VY Canis Majoris, WOH G64, UY Scuti and Stephenson 2-18. `stars="bright"` keeps the first eight, `stars="largest"` the Sun and the largest; `stars="sun,rigel,antares"` is a list of your own (the ids are in `LINEUP_STARS`). `planets` adds the Earth (equatorial radius 6,378 km, 0.00917 Suns) and Jupiter (71,492 km, 0.103 Suns).

## How the zoom works

The bodies stand in a row (or a column, `layout="stack"`), smallest first, a quarter of the bigger neighbour's radius apart. The zoom is one number from 0 to 1 on a **logarithmic scale of radius**: at 0 the camera frames the smallest body, at 1 the largest, and in between its centre glides from one body to the next and rests on each as the size it frames reaches that body's radius. From the Earth to Stephenson 2-18 is a factor of two hundred thousand, so most of the slider is spent among the stars you cannot see at the Sun's size, and the Earth is a speck beside the Sun: a ring marks any body too small to see.

`zoom="0.4"` or `at="betelgeuse"` sets where the camera starts; the Sun when neither is given. In a narrow picture the camera is further back so the framed body still fits across.

## The radii

Every radius comes from a **refereed paper that measured the star's angular diameter** (interferometry where it exists) and used a distance. Nothing is read from an infographic, from an encyclopedia, or from the Gaia, Hipparcos and Tycho catalogues: where a paper's distance is a catalogue parallax, the paper's radius is typed here and the parallax is not. The table is typed in `src/lineup/data.ts` as `LINEUP_STARS`; each row has the radius, the error below and above, the method, the paper's ADS bibcode and the date it was read (2026-11-09), and `NOTICE.md` lists the sources.

| Star | Radius | The size is | Paper | ADS bibcode |
|---|---|---|---|---|
| Sun | 1 Sun | defined | Prša et al. 2016 | `2016AJ....152...41P` |
| Sirius A | 1.714 Suns (±0.009) | measured angle and distance | Bond et al. 2017; Davis et al. 2011 | `2017ApJ...840...70B`, `2011PASA...28...58D` |
| Vega | 2.726 Suns (±0.006) | measured angle and distance | Monnier et al. 2012 | `2012ApJ...761L...3M` |
| Arcturus | 25.4 Suns (±0.2) | measured angle and distance | Ramírez and Allende Prieto 2011 | `2011ApJ...743..135R` |
| Aldebaran | 44.2 Suns (±0.9) | measured angle and distance | Richichi and Roccatagliata 2005 | `2005A&A...433..305R` |
| Rigel | 78.9 Suns (±7.4) | measured angle and distance | Moravveji et al. 2012 | `2012ApJ...747..108M` |
| Antares | 680 Suns (+139 −99) | measured angle and distance | Ohnaka et al. 2013 | `2013A&A...555A..24O` |
| Betelgeuse | 1,057 Suns (+228 −162) | measured angle and distance | Haubois et al. 2009; Harper et al. 2017 | `2009A&A...508..923H`, `2017AJ....154...11H`, `2005ApJ...628..973L` |
| VY Canis Majoris | 1,420 Suns (±120) | measured angle and distance | Wittkowski et al. 2012 | `2012A&A...540L..12W`, `2012ApJ...744...23Z` |
| WOH G64 | 1,540 Suns (±77) | from brightness and temperature | Levesque et al. 2009 | `2009AJ....137.4744L`, `2008A&A...484..371O`, `2024A&A...691L..15O` |
| UY Scuti | 1,708 Suns (±192) | measured angle, distance not a parallax | Arroyo-Torres et al. 2013 | `2013A&A...554A..76A` |
| Stephenson 2-18 | 2,150 Suns (+710 −290) | from brightness and temperature | Fok et al. 2012 | `2012ApJ...760...65F`, `2007ApJ...671..781D`, `2010PASJ...62..391D` |

The third column is the row's `basis`: **defined** (the Sun's nominal radius, 695,700 km); **measured angle and distance**; **measured angle, distance not a parallax** (UY Scuti: the radius could be well off); and **from brightness and temperature** (WOH G64 and Stephenson 2-18: no angular diameter has been measured, so the size is estimated, and the picture and the label say *estimated*). A radius that is half an angle times a distance is checked in the tests against the distance its paper adopted. Two radii are worked out here from the paper's numbers (`how: "worked-out"`): Betelgeuse's, as half of the measured angle times the paper's distance, and Stephenson 2-18's, by the Stefan-Boltzmann law from the paper's luminosity and temperature. Vega is flattened by 0.113 (equatorial radius 2.726 Suns, polar 2.418), seen from its pole in the sky but drawn with its pole upright. The Sun is the IAU's nominal one.

## Where the papers disagree

The label says so, and each row's `note` and `others` hold it in both languages. The value used is always the measured one, with the reason.

- **Betelgeuse** is only as big as its distance says, and a distance is hard to measure for a star this large. The measured angle (44.28 mas, Haubois et al. 2009) at the distance of Harper et al. 2017 (222 pc) gives **1,057 Suns** (+228, -162). The same angle at their other solution (190 pc) gives about 905, and Joyce et al. 2020 get 764 from stellar models and a distance of 168 pc: a size from models is not a measurement, so it is named and not used. The star page's preset of 764 is that model value.
- **UY Scuti** has a measured angle (5.48 mas, Arroyo-Torres et al. 2013) but no measured distance: the paper's 2.9 kpc is an old estimate. That gives **1,708 Suns** (±192) and the row says the size is uncertain. At about 1.8 kpc from Gaia-era work the same angle gives about 1,060, and Healy et al. 2024 give a revised 909 from photometry and a Gaia distance, not from a measured size. This line-up keeps the measured angle at the distance the measuring paper used. Take 900 to 1,700 Suns as the range.
- **VY Canis Majoris** was drawn larger in older papers, which assumed 1.5 kpc. The radio parallaxes of Choi et al. 2008 and Zhang et al. 2012 brought the distance to about 1.2 kpc, and Wittkowski et al. 2012 measured its Rosseland diameter (11.3 mas) for **1,420 Suns** (±120).
- **WOH G64** has no measured angular diameter of its own: the 2 mas image of 2024 (Ohnaka et al.) is the dust round it. Levesque et al. 2009 fit its spectrum for 3,400 K and take its brightness at the 50 kpc of the Large Magellanic Cloud for **1,540 Suns** (±5 percent, estimated). Ohnaka et al. 2008 got 1,730 from a dust model, and the star changed between 2009 and 2016, so no single radius is final.
- **Stephenson 2-18** has no measured angle and a kinematic distance, uncertain by about a third, and a temperature from a dust model (Fok et al. 2012). Its **2,150 Suns** (+710, -290; the error is from the distance alone) is the least certain size here, and whether it or another star is the largest depends on those numbers.

## In a plain page

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The size line-up, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/lineup/+esm"></script>
  </head>
  <body>
    <wakusei-lineup stars="bright" planets at="betelgeuse" size="720"></wakusei-lineup>
  </body>
</html>
```

The element is `<wakusei-lineup>`; its entry point, `/lineup`, holds the stars' look, the Earth's and Jupiter's looks and the element, and loads three.js only when a 3D view is wanted.

| Attribute | What it does |
|---|---|
| `stars` | `all` (default), `bright`, `largest`, or ids separated by commas |
| `planets` | adds the Earth and Jupiter (`planets="off"` takes them away) |
| `layout` | `row` (default) or `stack` |
| `zoom` / `at` | where the camera starts: 0 to 1, or the id of a body (the Sun by default) |
| `turn` | `off` stops the bodies turning by themselves; under reduced motion they do not turn unless it is `on` |
| `look` | the planets': `realistic` (default) or `painted` (public-domain maps) |
| `labels` | `off` hides the labels |
| `controls` | `none` hides the zoom slider |
| `size`, `lang` | pixels across (720), and `en` or `ja` |
| `quality` | `full` or `low` (a still surface for a weak device; chosen by itself on 2 GB or two cores) |
| `live` | `always` (default), `hover` or `off`: when it takes the page's one WebGL context |

A drag on a star turns it (a horizontal swipe on a touch screen); Ctrl, Command or Alt with the wheel zooms; with the element focused, the arrow keys go to the next body, `+` and `-` zoom a little, Home and End go to the ends, and a double click puts every star back. `zoomTo("betelgeuse")` glides there (at once under reduced motion) and resolves on arrival; `zoom` is the number, `focused` the id in frame, and `wakusei-lineup-zoom` is sent whenever it changes.

## As an ES module

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The size line-up with Vite</title>
  </head>
  <body>
    <wakusei-lineup stars="bright" planets></wakusei-lineup>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-run
import "@johnmorrisdotca/wakusei-planets/lineup";
import type { WakuseiLineup } from "@johnmorrisdotca/wakusei-planets/lineup";

const lineup = document.querySelector<WakuseiLineup>("wakusei-lineup")!;
// glide from the Sun up to Betelgeuse; the zoom slider, a drag on a star and the keys work by themselves
void lineup.zoomTo("betelgeuse");
lineup.addEventListener("wakusei-lineup-zoom", (event) => console.log((event as CustomEvent<{ focus: string }>).detail.focus));
```

## React

```tsx
import { useEffect } from "react";

export function LineupView({ stars = "bright", planets = true, at = "betelgeuse" }: { stars?: string; planets?: boolean; at?: string }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/lineup");
  }, []);
  return <wakusei-lineup stars={stars} planets={planets ? "" : undefined} at={at} />;
}
```

The element needs a type for React, once:

```ts no-check
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-lineup": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { stars?: string; planets?: string; layout?: string; at?: string; zoom?: number | string; turn?: string; size?: number | string };
    }
  }
}
```

## Vue

```vue
<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ stars?: string; planets?: boolean; at?: string }>(), { stars: "bright", planets: true, at: "betelgeuse" });

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/lineup");
});
</script>

<template>
  <wakusei-lineup :stars="stars" :planets="planets ? '' : undefined" :at="at"></wakusei-lineup>
</template>
```

Vue must be told the tag is an element, once:

```ts no-check
import { createApp } from "vue";
import LineupView from "./LineupView.vue";

const app = createApp(LineupView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-lineup";
app.mount("#app");
```

## Angular

```ts no-check
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-lineup-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-lineup [attr.stars]="stars" [attr.planets]="planets ? '' : null" [attr.at]="at"></wakusei-lineup>`,
})
export class LineupViewComponent implements OnInit {
  @Input() stars = "bright";
  @Input() planets = true;
  @Input() at = "betelgeuse";

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/lineup");
  }
}
```

## Svelte

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  let { stars = "bright", planets = true, at = "betelgeuse" }: { stars?: string; planets?: boolean; at?: string } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/lineup");
  });
</script>

<wakusei-lineup {stars} planets={planets ? "" : undefined} {at}></wakusei-lineup>
```

## In an iframe

The embed page takes the same names in its address, with `lineup=1`: `stars`, `planets=1`, `layout`, `zoom`, `at`, `turn=off`, `look`, `labels` and `lang`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The size line-up in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/wakusei-planets/embed.html?lineup=1&stars=bright&planets=1&at=betelgeuse"
      title="Wakusei Planets size line-up"
      width="720"
      height="405"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

The demo's [size line-up page](https://johnmorrisdotca.github.io/wakusei-planets/lineup.html) writes this code, and the other ways above, for what you have set up.

## Save as an image, print as a poster

The page's buttons use two parts of kazoku-ui. `picture()` gives the picture as it is now as an SVG: the stars as an image, the labels as vector text. `toSvg()` and `toPng(scale)` are the same picture as text and as a PNG. The page hands the SVG to kazoku-ui's `saveImage`, and to `buildSheet` and `printSheet` for a poster on A4 or US Letter, with the name of the star in frame, its radius and its source in the info boxes and a QR code back to the page.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/lineup";
import type { WakuseiLineup } from "@johnmorrisdotca/wakusei-planets/lineup";
import { buildSheet, printSheet } from "@johnmorrisdotca/kazoku-ui/print";

const lineup = document.querySelector<WakuseiLineup>("wakusei-lineup")!;
const svg = await lineup.picture();
svg.setAttribute("style", "display:block;width:100%;height:100%");
const holder = document.createElement("div");
holder.style.cssText = "position:absolute;inset:0";
holder.append(svg);
printSheet(buildSheet({ page: "letter", orientation: "landscape", title: "Size line-up", pages: [holder] }));
```

## Without a page

The table and the arithmetic need no browser: `lineupBodies`, `lineupText`, `placeLineup`, `lineupView`, `lineupProject` and `lineupLabels` are pure.

```js
import { lineupBodies, lineupText } from "@johnmorrisdotca/wakusei-planets";

// The table of radii needs no browser: the largest known stars, smallest first, with the error and the source of each.
const largest = lineupBodies({ set: "largest" }).at(-1);
const text = lineupText(largest, "en");

console.log(`${text.name}: ${text.radius}, ${text.km}, ${text.source}`);
```

## Speed and memory

All the bodies are in one three.js scene, drawn through the shared renderer: one WebGL context, a canvas within 6 million pixels and 4096 on a side, nothing drawn at rest or while the element is out of sight or the tab is hidden, a lost context recovered, and every geometry, material and texture given back. A star too small to see (under a fifth of a pixel) and one outside the picture are not drawn at all. The bodies turn while the page is in sight; `turn="off"` stops that, and the picture then draws only when you move it. The element adds no frame cap of its own; it asks the shared renderer for the next frame only while something is moving.

## What is measured and what is drawn

Each star is drawn from its temperature (the colour), its radius (the size) and its luminosity class (the grain of the surface). The cells, the spots and the glow are illustrative, as on [the star page](star-look.md#what-is-measured-and-what-is-drawn); the sizes are the ones in the table, and the table says how well each is known.
