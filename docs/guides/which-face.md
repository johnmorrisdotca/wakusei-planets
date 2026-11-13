---
title: Which face of a body the view looks at
section: how-to
order: 21
description: "Read which longitude and latitude of the body in the middle lies under the camera, and turn the view to bring a point there, on the space view and on a picture of a body: for a card picture that follows the main view, and the reverse."
---

`<wakusei-space>` and `<wakusei-body>` turn round the body in the middle with a yaw and a tilt. Those two numbers do not say which part of the surface you are looking at: a camera held in the stars sees the
body turn under it. `subCameraPoint()` says it, as a longitude (east) and a latitude (north) in the body's own fixed frame, and `faceTo({ lon, lat })` is the other way round.

```ts no-run
import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";

const space = document.querySelector<WakuseiSpace>("wakusei-space")!;
space.goTo("moon", { smooth: false });
space.faceTo({ lon: 30.8, lat: 20.2 }, { smooth: false });
console.log(space.subCameraPoint(), space.stats.camera.sub);
```

| Call | On | Means |
|---|---|---|
| `subCameraPoint()` | `<wakusei-space>` | The point of the centred body under the camera, `{ lon, lat }`, at the moment shown. Beside a moon (the way a moon is visited) it is the point under the line from the moon's centre to the camera. `null` while the camera is riding along with anything else. |
| `faceTo(point, { smooth })` | `<wakusei-space>` | Turn the view round the body so the point is under the camera: a glide (at once with `smooth: false` or for reduced motion), the zoom kept. Beside a moon the camera keeps beyond the moon, off the line to its planet, so it is stood as near the side of the point as the view allows: in a ride beside a moon the face is "as near as the view allows" (the opening off the line to the planet grows in steps of a degree, so a point can be missed by a degree or so, and the planet's own side by a good deal more). `false` while riding along with anything else. |
| `stats.camera.sub` | `<wakusei-space>` | The same point as of the last draw, for tests and readouts. |
| `subCameraPoint()` | `<wakusei-body>` | The point in the middle of the picture, with the date's pose (or the portrait's), the view's turn, tilt and roll counted in. `undefined` for a star. |
| `faceTo(point, { smooth })` | `<wakusei-body>` | Turn the body so the point is in the middle: what `goToPlace` does for a named place. |

The pure functions are `subCameraPoint(body, view, centre, anchor, time)` and `faceView(body, face, centre, anchor, time, from)` from `/space`, for a page or a server that works with the numbers.

## How it is worked out

The view aims the camera along the Earth's ground direction of the `center` less the yaw and tilt, as the stars saw it at the moment the camera was last pointed (the anchor). That direction is then put into
the body's own frame: its pole and its prime meridian at the moment shown, which carry its spin and, for the Moon, how its prime meridian is set from the line to the Earth. The Moon seen from the Earth's side
therefore has its sub-Earth point at longitude 0; Mars goes by 14.6 degrees an hour under a camera that is held in the stars.

## For a card picture that follows the view

Read the view with `subCameraPoint()`, give it to the picture with `faceTo`, and when the reader drags the picture read its `subCameraPoint()` and give it to the view the same way. Keep a flag for who
started the change so the two never answer each other, and change the other one only when the point has moved by half a degree or so: nothing is drawn at rest.

## The budget

Both calls are arithmetic on a few vectors; `faceTo` makes the same glide `goToPlace` makes and nothing else is drawn for it. Nothing runs on a timer.
