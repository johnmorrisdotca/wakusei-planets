---
title: Riding along
section: how-to
order: 17
description: Put the camera on a moving point, a moon, a planet or anything of your own, and look at the body it goes round, straight down or at the horizon, for any body by its radius.
---

`space.ride(target, options)` on `<wakusei-space>` puts the camera at a moving point at its real place for the moment shown, and looks at the body it goes round. The pure maths of where the camera looks is `ridePose`, in `@johnmorrisdotca/wakusei-planets/space`, so a page or a test can ask the same question.

```ts no-run
import "@johnmorrisdotca/wakusei-planets/space/element";

const space = document.querySelector("wakusei-space")!;
space.ride("moon", { look: "horizon" });
space.ride("io");
space.ride({ at: (ms) => ({ position: [6778, 0, 0], velocity: [0, 7.66, 0] }) }, { around: "earth" });
space.ride(null);
```

A ride goes on with the clock: at `speed="0"` the camera holds still at the moment shown, so the demo starts the clock (Play) when a ride is chosen, and its date box follows it through `wakusei-timechange` (see [Moons and time](moons-and-time.md)).

## What can be ridden

- **A body of the view** (`"moon"`, `"sun"`, `"mars"`, ...): it goes round the Earth. The camera is at its place in the view's scale and looks at the Earth.
- **A moon** (`"io"`, `"titan"`, `"phobos"`, ...): it goes round its planet. The camera is at the moon's real place from its planet, in the planet's radii, and looks at the planet.
- **A point of your own**: `{ at(ms) }` returns `{ position, velocity }` in kilometres and kilometres a second from the centre of the body it goes round, in J2000 equatorial axes (x to the vernal equinox, y north), or `null` when it cannot be placed then. `around` names that body (the Earth by default). The view knows nothing of what the point is: a satellite from your own SGP4, a probe from your own table.

`look` is `down` (straight at the centre of the body: the ground goes by under the camera) or `horizon` (tipped forward along the way it is going until the horizon is a little above the middle). The way of going is the point's velocity less the part that points at the body; for a moon it comes from its places a second apart. `view: "follow"` keeps the camera a distance from the target and looks at it instead (`distanceKm` for a point of your own; a body or a moon is kept at the distance the zoom says).

## From beside a moon

`space.ride("moon", { view: "beside" })` (or `space.ride("io", { view: "beside" })`, for any moon of a planet in the view) puts the camera beyond the moon, on the side away from its planet and a little off the line to it. The moon is large in the foreground, about 20 degrees across its radius, and the planet is in view behind it at the angular size it really has from there (the Earth is about two degrees across from the Moon in the true scale). It opens off the line, from 25 degrees, until the two discs no longer touch, so the moon never hides the planet; it sits on the Sun's side of that line where it can, so the moon shows a lit face; it turns the picture so the planet is to the side of the moon; and it widens the field of view until both fit the narrower side of the view, on a phone as on a desk. A drag swings the camera round the line from the planet through the moon (yaw) and opens the angle (tilt); the zoom goes closer and further (1 is 5.8 moon radii away). It glides there from where the camera was, and `ride(null)` glides back to the body it was looking at. The pure maths is `besideMoon` in `@johnmorrisdotca/wakusei-planets/space`:

```ts
import { besideMoon } from "@johnmorrisdotca/wakusei-planets/space";

const view = besideMoon({ moon: [60.3, 0, 0], moonRadius: 0.2724, host: [0, 0, 0], hostRadius: 1, sun: [-23_000, 5000, 9000], aspect: 1.6, zoom: 1, yaw: 0, tilt: 0 });
console.log(view.distance.toFixed(2), view.separation.toFixed(0));
```

The view is for a moon: a planet or a point of your own with `view: "beside"` is refused. The demo's Ride along row has it as "Beside the Moon", which also makes a good end for an opening pull-back from the Moon out to the Earth.

## The camera

```ts
import { ridePose } from "@johnmorrisdotca/wakusei-planets/space";

const pose = ridePose({ position: [5.9, 0, 0], velocity: [0, 1, 0], radius: 1, look: "down", yaw: 0, tilt: 0, zoom: 1 });
console.log(pose.forward.map((n) => n.toFixed(2)).join(","), pose.bodyRadiusDegrees.toFixed(1));
```

`position` and `velocity` are in any unit, from the centre of the body, and `radius` is the body's radius in the same unit: radii of Jupiter and `radius: 1`, or kilometres and `radius: 69911`, make the same camera. The pose is the camera's place, the unit directions it looks and has up, the field of view (60 degrees at zoom 1, narrower with `zoom`), and the body's angular radius from there.

A drag looks about from there, as a head on a pivot does: a drag right turns the camera to its left, a drag up tips it towards the bottom of its picture, so the ground follows the pointer, about one and a half pixels for each pixel of the drag, whatever the zoom.

## Changing and stopping

Another `ride` call glides from the old camera to the new one in about a second and a bit (`smooth: false`, or a reader who prefers reduced motion, jumps). `ride(null)` stops and gives the camera back to the body it was looking at. The body ridden, and the body it goes round, are not named on the view while you ride. A point that cannot be placed fires `wakusei-ride-lost` once and the ordinary camera is used. `space.riding` says what is ridden; `stats.ride` says `riding`, `lost` and `gliding`.

## When it draws

The view draws only when something changes and at most 30 times a second. A ride changes the picture all the time, so the clock draws as often as the picture moves a pixel (the speed of the ground under the camera over its height, times the focal length in pixels, times the clock's speed), from 1 to 30 times a second. Paused: nothing is drawn. Out of sight: nothing is drawn. Reduced motion: one update a second and no glide. `pnpm test:freeze` and `e2e/space.demo.ts` test each of these.
