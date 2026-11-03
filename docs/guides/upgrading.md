---
title: Upgrading
section: upgrading
order: 11
description: What changed in each version that you must act on, and what is new that you may want.
---

The package is at 0.x, so a minor version can change behaviour. Read [CHANGELOG.md](../../CHANGELOG.md) for the full list; this page says what to act on.

## From 0.4 to 0.5

Nothing to change. 0.5 adds `@johnmorrisdotca/wakusei-planets/painter`: `painter.make(three, "Jupiter", { look, invalidate, ratio })` makes the Sun, a planet, Pluto or a moon as an object of radius 1 for a perspective-camera scene of your own, in the realistic or the painted look. `orientation(id, ms)` and `moonOffset(id, ms)` give a body's pole and prime meridian, and a moon's place from its planet, in the same axes. See [In your own three.js scene](in-your-own-scene.md).

## From 0.3 to 0.4

Nothing to change in what you wrote. 0.4 adds `embedCode(options, kind, settings)` and `embedCredit(options)`, which write the code that puts a body in a page (`EMBED_KINDS`: `html`, `module`, `react`, `vue`, `angular`, `svelte`, `iframe`), and moves to kazoku-ui 0.11. If you use the shared view controls, the Centre button appears once the body is dragged away, and a pan keeps a quarter of the body in sight.

```ts
import { EMBED_KINDS, embedCode } from "@johnmorrisdotca/wakusei-planets";

console.log(EMBED_KINDS.join(", "));
console.log(embedCode({ body: "mars", look: "line", size: 240 }, "html").split("\n")[0]);
```

## From 0.3.0 to 0.3.1

- **The Earth draws in every look.** In the realistic and painted looks it used to be handed to chikyu-earth's own live element and showed an empty view. It is now drawn by this package like every other body, from NASA's Blue Marble picture. If you had worked round an empty Earth, remove the workaround.
- **"To scale"** is a lineup: every body at one scale, a magnified picture joined by a line for each body too small to see. The new attribute `span-km` is the half-width of a picture in kilometres.
- **Every moon is a `body`**: `body="io"` works in every look.
- **A body cannot be dragged out of its view**: a quarter of it always stays in, and Fit centres it.

## From 0.2 to 0.3.0

- **A drag up now moves the surface up**, in every look. It moved it down. If you drove the view yourself and turned the tilt's sign to compensate, take that out.
- **The Moon is in `/all`**: it was left out, so the Moon was drawn as a plain ball.
- **Painted moons**: nine moons have painted maps, and Saturn's rings in the painted look are a Cassini picture.
- **The package's pictures grew** from 0.53 MB to 1.31 MB. If you serve the pictures yourself, copy the new ones.

## From 0.1 to 0.2.0

0.2 adds `look="painted"`: real surface maps of the planets and the Sun from public-domain imagery, small pictures first and a sharper one fetched when you zoom in (`texture-far-base` to serve it yourself). A picture that fails to load leaves the shaded look drawn.

## 0.1.0

The first release: line drawings, shaded drawings, the sky for a date and time, and one WebGL context per page. Each shaded body is its own optional entry point. Nothing to change.

## Before you move

1. Read the CHANGELOG between your version and the new one.
2. Run your pages in a browser: a shaded body needs `three` (an optional peer, `>=0.160.0`) and its own entry point, or `/all`.
3. If you store embed code, write it again: `embedCode` writes the version of the package it was made with.
