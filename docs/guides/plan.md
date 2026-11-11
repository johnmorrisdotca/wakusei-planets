---
title: The top-down plan
section: how-to
order: 21
description: A small plan of the solar system from above, or of one planet's moons from above its pole, with one body marked, for any date. SVG with no WebGL, light enough for an inset, with distances squeezed by a logarithm or to scale.
---

`<wakusei-plan>` is a map you look down on: a drawing of where the planets are round the Sun, or where one planet's moons are round it, with the body you are looking at marked. It is the "where am I" inset that sits beside a 3D view. It is SVG, with no WebGL and no three.js, and it is made to be read at 200 to 280 pixels across. Its positions are the package's own (the same models as [the space view](space-view.md)) for the moment you give it.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The solar system and Jupiter's moons from above, from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/plan/element/+esm"></script>
  </head>
  <body>
    <wakusei-plan mark="mars" time="2026-11-11T12:00Z" size="240"></wakusei-plan>
    <wakusei-plan system="jupiter" mark="io" time="2026-11-11T12:00Z" size="240"></wakusei-plan>
  </body>
</html>
```

The first plan is the solar system seen from above the ecliptic's north pole, with Mars marked. The second is Jupiter's moons seen from above Jupiter's north pole, with Io marked.

## The two plans

**The solar system** (`system="sun"`, the default). The Sun is at the middle and the eight planets and Pluto go round it anticlockwise, as seen from above the ecliptic's north pole. Each planet is a dot at its place for the `time`, with its orbit as a line. The body in `mark` has a ring, its name in bold and its orbit in the accent colour. A body that is not one of these nine joins the plan when it is marked: a dwarf planet (Ceres, Eris, Sedna), a minor body (Halley's comet, Chiron) or a spacecraft from [`/spacecraft`](spacecraft.md) such as `voyager1`. A moon in `mark` marks its planet, so a page that follows the body in a 3D view can hand the same id to both.

**One planet's moons** (`system="jupiter"`, or any planet or dwarf planet that has moons: `earth`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`, `orcus`, `haumea`, `eris`). The planet is at the middle and each moon goes round it, seen from above the planet's north pole (the IAU pole), so a moon that goes the planet's way goes anticlockwise and a backward one, such as Triton, goes clockwise. `mark` is a moon, or the planet; a moon of another planet marks nothing.

## The attributes

| Attribute | What it does |
|---|---|
| `system` | `sun` (the default), or a planet or dwarf planet with moons |
| `mark` | the body the plan is about: `mars`, `ceres`, `halley`, `io`, `voyager1` |
| `time` | an ISO date or milliseconds since 1970. Left out or `now`, it is the moment the plan is first drawn, and it then stands still: set `time` again to move it |
| `spacing` | `squeezed` (the default) or `true` |
| `names` | `off` hides every name but the marked body's |
| `lang` | `en` or `ja`; the page's `lang` when left out |
| `size` | pixels across, 240 by default (`--wakusei-size` does the same) |
| `theme` | `light` or `dark`; the page's colour scheme when left out |

The element also has a `time` property (a number or `"now"`), a `plan` property (the plan last drawn: its dots, orbits and extent) and a `draws` count.

## Squeezed and to scale

The solar system is mostly empty: Neptune is 78 times as far from the Sun as Mercury. To scale at 240 pixels, Mercury, Venus, the Earth and Mars would all sit within 4 pixels of the Sun. So the plan has two spacings, and says which it is using on the line at its foot.

- **Squeezed (the default).** A body goes at the logarithm of its distance: `ln(1 + d / inner) / ln(1 + edge / inner)`, with `inner` 0.1 au in the solar system and one planet radius in a moon system. Every planet gets room, the inner ones a good deal and the outer ones a little, and the order is the order of distance. The orbit lines are squeezed the same way (each point of an orbit is moved along its line from the middle), so a squeezed orbit is a distorted ellipse, never a circle drawn in its place. Distances are not proportional: read the order and the directions, not the gaps.
- **To scale** (`spacing="true"`). A body goes at its distance divided by the distance at the edge. The gaps are true and the inner planets crowd the middle.

Where each planet falls on a plan with the edge at 50 au, as a share of the way from the middle to the edge:

| Body | Distance (au) | Squeezed | To scale |
|---|---|---|---|
| Mercury | 0.39 | 25 per cent | 0.8 per cent |
| Venus | 0.72 | 34 per cent | 1.4 per cent |
| Earth | 1.00 | 39 per cent | 2.0 per cent |
| Mars | 1.52 | 45 per cent | 3.0 per cent |
| Jupiter | 5.20 | 64 per cent | 10 per cent |
| Saturn | 9.54 | 73 per cent | 19 per cent |
| Uranus | 19.2 | 85 per cent | 38 per cent |
| Neptune | 30.1 | 92 per cent | 60 per cent |
| Pluto (mean) | 39.5 | 96 per cent | 79 per cent |

**The edge.** In the solar system the edge is the smallest of 50, 100, 200, 500, 1,000 and 2,000 au that holds every dot: 50 au for the eight planets and Pluto, 100 for Sedna or Eris, 200 for Voyager 1. It moves in whole steps, so the planets keep their places while you mark one body after another. A body beyond 2,000 au is held on the edge. An orbit that goes beyond the edge is cut by it. In a moon system the edge is 8 per cent past the furthest point of the furthest moon, so Jupiter's plan reaches 28.7 Jupiter radii and Neptune's 421 (Nereid goes that far).

## It draws only when something changes

The element has no timer and no animation. It draws once when it first has a size and is in view, and again when `system`, `mark`, `time`, `spacing`, `names`, `lang`, `size` or `theme` changes, or the page's `lang` changes when it has none of its own. Writing the value an attribute already has changes nothing. Many changes in one go make one draw. While the element is out of sight (scrolled away, or in a closed tab) it does not draw: the latest change is drawn when it is seen again. A page that runs time sets `time` as often as it likes, at the rate it likes; each set costs one small SVG (about 15 kB of text) and the work of placing the bodies, about a millisecond. The orbit lines are cut once a year of plan time in the solar system and once a week for moons, a difference of less than a pixel, and are kept, so a day-by-day clock does not recompute them.

## Pressing a dot

A press on a dot sends `wakusei-plan-pick` from the element, with `detail: { id, kind }` (`kind` is `planet`, `moon`, `dwarf-planet`, `comet`, `star` for the Sun, and so on). The plan does not change its own mark: the page decides, and sets `mark`. Each dot is a button with the body's name for a screen reader and can be reached with Tab; Enter or Space presses it, and the focus stays on the dot when the plan draws again.

```ts no-run
import type { WakuseiPlan } from "@johnmorrisdotca/wakusei-planets/plan/element";

const plan = document.querySelector<WakuseiPlan>("wakusei-plan")!;
plan.addEventListener("wakusei-plan-pick", (event) => plan.setAttribute("mark", (event as CustomEvent<{ id: string }>).detail.id));
```

## Light, dark and language

The colours follow the page's `color-scheme`, which is how the family's theme switch works: a page with `data-theme="dark"` gets the dark plan with no code of your own, and `theme="light"` or `theme="dark"` on the element forces one. The plan has its own paper (`--wakusei-plan-bg`), so it reads the same on a light page, a dark page or a coloured panel. Set `--wakusei-plan-ink`, `-muted`, `-line`, `-sun`, `-dot` or `-mark` to use your own colours. Names are each body's own name in the package's facts, in English or Japanese, and the scale line and the label for a screen reader are in the same language.

Names are chosen so that none overlap: the marked body's first, then the Sun, planets, dwarf planets and the rest, and a name that would cover a surer one is left out. With `names="off"` only the marked body is named.

## What is exact and what is not

The dots are exact: each is the package's own position for the moment (VSOP87B for the planets, fitted tables for Pluto and the other small bodies, the moon theories for moons; see [accuracy](accuracy.md)), with no allowance for the time light takes to arrive. They are drawn at one size, not to scale, so a dot says nothing about how big a body is. The plan is a flat view from above: a body that is well above or below the plane of the ecliptic (Pluto, Sedna, a spacecraft) is drawn where it is above that plane, and its distance is its distance in that plane. A spacecraft is drawn only while the moment is inside the record of its path.

## Without a browser

The pure side is `@johnmorrisdotca/wakusei-planets/plan`: `planAt` works out the plan, `planSvg` draws it as SVG text (for a README, a server or a print), `planText` and `planName` give the words, and `planRadius` and `planSunExtent` are the spacing. It runs in Node and anywhere else.

```js
import { planAt, planSvg } from "@johnmorrisdotca/wakusei-planets/plan";

// The plan needs no browser: where Mars and Io are on the drawing for a date, and the drawing itself as SVG text.
const time = Date.UTC(2026, 10, 11);
const sky = planAt(time, { mark: "mars" });
const mars = sky.dots.find((dot) => dot.id === "mars");
const io = planAt(time, { system: "jupiter", mark: "io", spacing: "true" }).dots.find((dot) => dot.id === "io");

console.log(`Mars: ${mars.distance.toFixed(2)} au from the Sun, ${Math.round(Math.hypot(mars.x, mars.y) * 100)} per cent of the way to the edge (${sky.extent} au)`);
console.log(`Io: ${io.distance.toFixed(1)} Jupiter radii from Jupiter's centre`);
console.log(`The SVG is ${planSvg(sky, { size: 240 }).startsWith("<svg") ? "an <svg>" : "not an SVG"}`);
```

It prints:

```text
Mars: 1.60 au from the Sun, 46 per cent of the way to the edge (50 au)
Io: 5.9 Jupiter radii from Jupiter's centre
The SVG is an <svg>
```
