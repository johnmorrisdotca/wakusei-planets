---
title: A star from its numbers
section: how-to
order: 6
description: Draw any star from a few numbers (temperature, radius, class, how it turns) in 3D or as a line drawing, and say honestly what is measured and what is drawn for looks.
---

`<wakusei-body star="...">` draws a star the way it draws a planet: turnable in 3D (`realistic`) or as an outline (`line`), through the page's one shared WebGL context. The package holds no catalogue of stars. You give it the numbers and it draws from them; it never copies a picture.

| Number | What it sets |
|---|---|
| `temperatureK` | the colour (a black body at that temperature: red for 3,600 K, white-yellow for the Sun, blue-white for Vega), and how much the edge darkens |
| `radiusSun` | the size beside the Sun, and the rings drawn round the star in the line look (the Sun, the Earth's orbit, Jupiter's orbit). Betelgeuse is about 1,057 times the Sun's **radius** (the [size line-up](size-lineup.md)'s measured angle at a distance of 222 pc; Joyce et al. 2020's 764 comes from stellar models and is not used); its mass, 11 to 20 Suns, is another number |
| `luminosityClass` | the grain of the surface: `Ia`, `Iab`, `Ib` a few giant cells, `III` coarse, `V` fine, `D` (a white dwarf) smooth |
| `rotationDays` | how it turns on the page: faster stars turn faster, sped up and labelled (the Sun is shown 73,000 times faster than real). Left out, a slow turn is drawn and the picture says so |
| `activity` | spots, and prominences and flares on the edge. Left out it follows the temperature and the class: none on hot stars, many on cool dwarfs and red dwarfs |
| `oblateness` | the squashed shape, and the hotter poles with a darker equator (gravity darkening): Vega is about 0.11 and Altair 0.2 |
| `corona` | the strength of the soft glow, 0 to 1 |
| `estimated` | the numbers above that are estimates, so the picture can say so |

## In a plain page

The numbers go in attributes, with `star` naming the star. The star's own look is inside the element, so there is one script and no entry point per body.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star from its numbers, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
  </head>
  <body>
    <wakusei-body star="Betelgeuse" temperature-k="3650" radius-sun="1057" luminosity-class="Iab" look="realistic" size="320"></wakusei-body>
  </body>
</html>
```

`star` can also hold the numbers as JSON, `star='{"temperatureK":3650,"radiusSun":1057}'`, or the name of a star you registered with `registerStarLook` (below). Attributes laid beside it win. The `star` property takes an object. A star with numbers that do not fit says what is wrong in `data-error` and draws nothing.

## As an ES module

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star with Vite</title>
  </head>
  <body>
    <wakusei-body look="line"></wakusei-body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts no-run
import "@johnmorrisdotca/wakusei-planets/element";
import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
import { starLook, type StarNumbers } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse: StarNumbers = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab", estimated: ["radiusSun"] };

const star = document.querySelector<WakuseiBody>("wakusei-body")!;
star.star = betelgeuse;
console.log(starLook(betelgeuse).parts.map((part) => `${part.part}: ${part.status}`).join(", "));
```

## React

```tsx
import { useEffect } from "react";

const BETELGEUSE = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab" };

export function StarView({ star = BETELGEUSE, look = "line" }: { star?: typeof BETELGEUSE; look?: "line" | "realistic" }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/element");
  }, []);
  return <wakusei-body star={JSON.stringify(star)} look={look} />;
}
```

The element needs a type for React, once:

```ts no-check
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-body": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { star?: string; look?: string; size?: number | string };
    }
  }
}
```

## Vue

```vue
<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ star?: object; look?: "line" | "realistic" }>(), {
  star: () => ({ name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab" }),
  look: "line",
});

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/element");
});
</script>

<template>
  <wakusei-body :star="JSON.stringify(star)" :look="look"></wakusei-body>
</template>
```

Vue must be told the tag is an element, once:

```ts no-check
import { createApp } from "vue";
import StarView from "./StarView.vue";

const app = createApp(StarView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-body";
app.mount("#app");
```

## Angular

```ts no-check
import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-star-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-body [attr.star]="json" [attr.look]="look"></wakusei-body>`,
})
export class StarViewComponent implements OnInit {
  @Input() star = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab" };
  @Input() look: "line" | "realistic" = "line";

  get json(): string {
    return JSON.stringify(this.star);
  }

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/element");
  }
}
```

## Svelte

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  let { star = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab" }, look = "line" }: { star?: object; look?: "line" | "realistic" } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/element");
  });
</script>

<wakusei-body star={JSON.stringify(star)} {look}></wakusei-body>
```

## In an iframe

The embed page takes the same names in its address: `star`, `temperature-k`, `radius-sun`, `luminosity-class`, `rotation-days`, `activity`, `oblateness`, `corona`, `estimated` and `look`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A star in an iframe</title>
  </head>
  <body>
    <iframe
      src="https://johnmorrisdotca.github.io/wakusei-planets/embed.html?star=Betelgeuse&temperature-k=3650&radius-sun=1057&luminosity-class=Iab&look=line"
      title="Betelgeuse, drawn from its numbers"
      width="420"
      height="420"
      loading="lazy"
      style="border: 0"
    ></iframe>
  </body>
</html>
```

The demo's [star page](https://johnmorrisdotca.github.io/wakusei-planets/star.html) writes this code, and the other ways above, for the star you set up.

## Without a page

`starLook` works the numbers out, `starLineSvg` draws the outline, and neither needs a browser:

```js
import { starLineSvg, starLook } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse = starLook({ name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab", estimated: ["radiusSun"] });
const drawn = betelgeuse.parts.filter((part) => part.status === "illustrative").map((part) => part.part);

console.log(betelgeuse.colour, starLineSvg(betelgeuse).startsWith("<svg"), drawn.join(","));
```

A page that draws a few stars by name registers them once and writes only the name:

```ts
import { registerStarLook, starLookOf } from "@johnmorrisdotca/wakusei-planets/look";

registerStarLook("Proxima Centauri", { temperatureK: 3042, radiusSun: 0.154, luminosityClass: "V", rotationDays: 83.5 });
console.log(starLookOf("proxima centauri")?.parts.length);
```

## What is measured and what is drawn

Every star carries `parts`, and the element's `starLook` property and its label say it too: *drawn from its numbers, not a photo.* Each part is one of four:

- **measured**: a number you gave;
- **estimated**: a number you gave and marked in `estimated`;
- **derived**: worked out from those numbers by a stated rule (the colour from the temperature, the darkening toward the edge, the hot poles of a flattened star);
- **illustrative**: invented to look right: the pattern of the cells, where the spots are, the prominences and flares, the glow. They follow the numbers (how many, how coarse) but they are not observations.

## Quality and speed

The star goes through the same shared renderer as every body: one WebGL context, at most 30 frames a second, nothing drawn at rest or out of sight, still turning under reduced motion (a quarter as fast), a lost context recovered. In `full` quality the granulation boils and an active star has prominences and flares on its edge, but only while frames are being drawn. `quality="low"` (or `starLook(numbers, { quality: "low" })`) gives a still surface and a soft glow for weak devices; the element chooses it by itself on a device with 2 GB of memory or fewer, or two cores or fewer, unless `quality="full"` says otherwise.

## The Sun

The Sun keeps its own look, painted map and line drawing (`body="sun"`), unchanged. `STAR_SUN` holds its numbers if you want it drawn as a star beside the others.
