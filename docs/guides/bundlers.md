---
title: With Vite or webpack
section: how-to
order: 3
description: Import the element in a bundled app, pick only the bodies you need, and keep three.js out of a page of line drawings.
---

The package is plain ES modules with types, so a bundler needs no plugin. Both examples below were built and opened in a browser by the package's tests.

## Vite

Import the element once and write the tag; `lineSvg` and the other helpers come from the package's main entry:

```ts no-run
import "@johnmorrisdotca/wakusei-planets/element";
import { lineSvg } from "@johnmorrisdotca/wakusei-planets";

const planet = document.querySelector("wakusei-body")!;
planet.setAttribute("tilt", "20");
console.log(lineSvg("saturn", { size: 64 }).startsWith("<svg"));
```

The page:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets with Vite</title>
  </head>
  <body>
    <wakusei-body id="planet" body="saturn" look="line"></wakusei-body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

## webpack

```js no-run
import "@johnmorrisdotca/wakusei-planets/element";

const planet = document.createElement("wakusei-body");
planet.setAttribute("body", "saturn");
planet.setAttribute("look", "line");
document.body.append(planet);
```

With this configuration:

```mjs
import { fileURLToPath } from "node:url";

export default {
  mode: "production",
  entry: "./src/index.js",
  output: { path: fileURLToPath(new URL("./dist", import.meta.url)), filename: "main.js" },
};
```

## Only the bodies you need

Each body's shaded look is its own entry point, `@johnmorrisdotca/wakusei-planets/jupiter` and so on, and `/all` loads every one. A bundler keeps what you import. A page of line drawings imports none of them, and never loads three.js: the element asks for it only when a shaded body first needs to be drawn.

## A smaller three.js

The element loads the whole of `three` by default. A page can hand over a module that re-exports only what the bodies use, which is a few hundred kilobytes instead of the whole library (the demo's `demo/three-subset.ts` is the list):

```ts no-check
import { setThreeLoader } from "@johnmorrisdotca/wakusei-planets/element";

setThreeLoader(() => import("./three-subset"));
```
