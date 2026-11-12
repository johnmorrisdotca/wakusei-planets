---
title: In your own three.js scene
section: how-to
order: 9
description: Put the real Sun, planets, Pluto and moons into a three.js scene you already have, lit from any direction, with chikyu-earth's space view as the example.
---

`@johnmorrisdotca/wakusei-planets/painter` makes each body as an object of radius 1 that you move, scale and light in a scene of your own. It draws nothing by itself: no renderer, no loop, no clock. It is a perspective-camera version of what `<wakusei-body>` draws, so the same shaded look and the same painted maps are there.

```ts
import * as THREE from "three";
import { painter } from "@johnmorrisdotca/wakusei-planets/painter";

const scene = new THREE.Scene();
const jupiter = painter.make(THREE, "Jupiter", { look: "realistic", invalidate: () => undefined });
scene.add(jupiter.object);
jupiter.object.position.set(40, 0, 0);
jupiter.object.scale.setScalar(2);
jupiter.update({ toSun: [-1, 0, 0], ms: Date.now(), radiusPx: 120 });
console.log(scene.children.length);
```

- `look` is `realistic` or `painted`. A painted body shows the shaded look until its map arrives, then `invalidate` is called so you draw again.
- Place and scale the object first, then call `update` at each draw. `toSun` is the unit direction to the Sun in your scene's axes, and the scene is taken to be equatorial J2000 with y up (x to the vernal equinox). The body is turned about its real pole to its real turn at `ms`.
- `radiusPx` is how many CSS pixels across its radius the body is. A sharper picture is fetched only when it would show, and the big one is let go a few seconds after the body shrinks.
- The Sun is a globe like the others: give `update` the `view` (the camera) and its glow turns to face it by itself, while the globe keeps the Sun's own pole and prime meridian (about 25 days a turn at the equator) and so turns with your camera and with time. Do not turn the object to the camera: `billboard` is no longer set (it used to be `true` for the Sun, which showed the same face whichever way the view turned).
- `painter.moons("Jupiter", ms)` gives each moon's place from its planet in planet radii and its size, nearest first. Make a moon the same way (`painter.make(THREE, "Io")`) and put it at the planet's place plus `offset` times the planet's drawn radius.
- The pictures come from jsDelivr by default; `createPainter({ textureBase, farBase })` points them at your own folder.
- For a close view, give `update` the camera: `jupiter.update({ toSun, ms, radiusPx, view: { camera, width, height } })` (the camera's matrices current, the size in CSS pixels). A body that is big in the view then gets finer map tiles for the part the camera sees, from the demo site's `tiles/` folder, or from `createPainter({ tiles: "/tiles/" })` (`"off"` for none; a painter given its own `textureBase` has none until it is told). `painting.tiles` says what the window is doing, and `context.onLevels` is told what tile levels the body has. Without `view` a body is drawn from its own pictures, as before. How it works: [Close zoom and map tiles](close-zoom.md).

The three.js you hand over needs the parts the bodies use, and `Group`. chikyu-earth's space view takes this painter with `setBodyPainter(painter)` and draws the Sun, the planets, Pluto and their moons with it (see its guide "The real planets").

`painter.credit` is `{ en, ja }`, the credit for the pictures that painter is drawing. Before `make`, it names every surface picture the painter can draw. After `make`, it names only the bodies made in a look that draws the map, so a shaded Jupiter with no map adds nothing, and the Moon and Mars add no CC BY 4.0 line. While finer map tiles are on a body it also names the tile source, and Mercury's tiles say that their colour is the CC BY 4.0 map. `picturesCredit(bodies, lang)` writes the same line for a list of bodies, from `PICTURE_CREDITS` (the table in `NOTICE.md`). Put `painter.credit` under the picture.
