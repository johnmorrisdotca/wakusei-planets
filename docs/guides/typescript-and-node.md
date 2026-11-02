---
title: TypeScript and Node
section: how-to
order: 6
description: Draw a body as an SVG string on a server, ask where a moon is, and use the types.
---

The main entry has no DOM and no browser globals, so a server, a build step or a test can draw the same line drawing and ask the same questions.

## On a server

```mjs
import { apparent, lineSvg } from "@johnmorrisdotca/wakusei-planets";

// A server draws the same SVG a browser does: pure, no DOM, no browser globals.
const svg = lineSvg("saturn", { size: 240, time: Date.UTC(2026, 10, 2, 12) });
const page = `<!doctype html><title>Saturn</title>${svg}`;
console.log(page.length > 1000, apparent("saturn", Date.UTC(2026, 10, 2, 12)).subObserverLat.toFixed(0));
```

## Types

Every function and option is typed; a name that is not a body is a compile error:

```ts no-run
import { BODIES, lineSvg, system, type BodyId, type LineOptions } from "@johnmorrisdotca/wakusei-planets";
import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";

const options: LineOptions = { size: 240, time: Date.UTC(2026, 10, 2, 12), moons: true };
const id: BodyId = "jupiter";
const svg: string = lineSvg(id, options);
const io = system("jupiter", options.time ?? 0).moons[0];
console.log(svg.length > 1000, BODIES[id].name.en, io?.id);

export function tilt(element: WakuseiBody): void {
  element.setView({ tilt: 20 });
}

export function misspelt(): string {
  // @ts-expect-error "pluton" is not a body
  return lineSvg("pluton");
}
```

## What is in the main entry

`BODIES` holds each body's radius, flattening, axial tilt, pole, rotation, colour, rings and drawn features. `apparent(id, time)` gives the pose, phase and size of a body as the Earth sees it; `system(planet, time)` gives the planet with its moons, in planet radii, in the viewer's frame; `orbitPath` gives one moon's orbit; `lineSvg` draws. The pure parts take milliseconds since 1970, as `Date.now()` gives.
