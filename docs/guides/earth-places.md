---
title: You are here, and places on the Earth
section: how-to
order: 21
description: "Mark the reader's own place and any places they keep on the Earth of the space view: a beam, a pin or a ring standing out of the ground, turning with the Earth, hidden on its far side, dimmer at night, with names that never cross another name. The layout is chikyu-earth's, through an optional peer; the page asks for the reader's place and the package stores and sends nothing."
---

[日本語](ja/earth-places.md)

`<wakusei-space>` can mark places on its Earth: where the reader is, and places they keep. Each place stands out of the ground as a small marker that turns with the Earth, is hidden when it goes round to the far side, and keeps its size in pixels at any zoom. It is the same list, the same looks and the same layout as chikyu-earth's `places`: the layout is chikyu-earth's own (`/markers`), reached through an optional peer and not copied.

```js no-check
import "@johnmorrisdotca/wakusei-planets/space/element";
import "@johnmorrisdotca/wakusei-planets/earth-places";

const space = document.querySelector("wakusei-space");
space.earthPlaces = [
  { id: "me", lon: -79.4, lat: 43.7, label: "You are here", kind: "here" },
  { id: "tokyo", lon: 139.69, lat: 35.69, label: "Tokyo" },
];
```

```html
<wakusei-space
  earth-places='[{"id":"me","lon":-79.4,"lat":43.7,"label":"You are here","kind":"here"},{"id":"tokyo","lon":139.69,"lat":35.69,"label":"Tokyo"}]'
  earth-places-look="beam"
  style="width: 420px; height: 420px"
></wakusei-space>
```

| Attribute | Property | Means |
|---|---|---|
| `earth-places` | `earthPlaces` | A JSON array of places, each `{ id, lon, lat, label, kind, color }`. Setting the property writes the attribute; an empty list takes the attribute away. |
| `earth-places-look` | `earthPlacesLook` | `beam` (the default): a light rising out of the ground with a ring at its foot. `pin`: a thin stick with a round head. `ring`: only the ring on the ground. Anything else is `beam`. |

The attribute is `earth-places`, not `places`, because `places` on this element already chooses the layers of marks on the body looked at (`landing crash planned feature`, [Places on the Moon, Mars and 31 more bodies](places.md)). The two work together: `places` marks the Moon, `earth-places` marks the Earth.

## Install

```sh
npm install @johnmorrisdotca/wakusei-planets @johnmorrisdotca/chikyu-earth
```

`import "@johnmorrisdotca/wakusei-planets/earth-places"` brings chikyu-earth's reading and layout of places (version 0.36.0 or later) to every `<wakusei-space>` on the page. It is its own entry point so that a page that never marks a place carries none of it, and nothing else in this package imports chikyu-earth, so a project without it still builds. Without that import the attribute draws nothing and `earthPlaces` reads as empty.

## What is drawn

- **Kinds.** `kind: "here"` is the reader's own place: taller, brighter and with a larger ring. Any other place is a `favourite`: shorter, thinner and quieter. Colours come from `--wakusei-place-here` and `--wakusei-place-favourite` on the element or the page; `color` gives one place a colour of its own (a hex colour, `rgb()` or `hsl()` with numbers, or a colour's name; anything else is left out).
- **On the Earth, wherever the camera looks.** The markers follow the Earth's own ground, so with the camera over longitude 10, latitude 20 a place there is in the middle of the picture. They are drawn while the Earth is at least 40 CSS pixels in radius on the screen, whichever body the camera looks at; in the whole-solar-system view the Earth is a speck and nothing is laid on it.
- **Names.** A place's `label` is shown at the top of its marker when there is room, `here` first and then in the order given. A name never overlaps another place's name or the name of a body (the Moon's, the Earth's own); one with no free room is left out and its marker is still drawn. Names are measured in the page's own font (`--wakusei-place-font`).
- **Dimmer at night.** A place on the Earth's night side is drawn at half strength and its name a little dimmer, so it can still be read. With `light="lit"` nothing is dimmed.
- **At most 32 markers.** The first 32 places in sight, `here` first and then in the order given, stand up. The rest of those in sight are counted in `earthPlacesShown.omitted`, not drawn: put the places that matter most first. A list is cut to 5,000, and a place with a longitude outside -180 to 180 or a latitude outside -90 to 90 is left out.
- **Nothing at rest.** The markers are laid when the picture is drawn (the camera moved, the clock stepped, a setting changed) and not otherwise; they are a few SVG shapes and names kept from one draw to the next and only moved. There is no animation: the reader's place is the tallest and brightest, not the one that pulses. The markers are not buttons and take no pointer: a press goes through them to the view.
- **What it reports.** `space.earthPlacesShown` says what was laid at the last draw: `{ marks: [{ id, kind, x, y, named }], omitted }`, with each marker's foot in CSS pixels from the view's top left.

## The reader's own place

The package never asks the browser where the reader is. The page does, and only when the reader asks for it:

```js no-check
import { nearby } from "@johnmorrisdotca/chikyu-earth/markers";

document.querySelector("#here").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition((position) => {
    const at = nearby({ lon: position.coords.longitude, lat: position.coords.latitude });
    space.earthPlaces = [{ id: "here", lon: at.lon, lat: at.lat, label: "You are here", kind: "here" }];
  });
});
```

- **Ask on a press.** Call `getCurrentPosition` from the reader's own click, so the browser's question comes after they asked for it. Offer a way to take it away again (`space.earthPlaces = []`).
- **Round it.** `nearby(point, km)` puts a place on a grid about `km` kilometres across (10 by default), so the marker never shows a street. Round before you draw it or keep it.
- **Keep it on the device.** The element stores nothing and sends nothing. Do not put the reader's place in the page's address or send it to a server unless they choose to share it.
- **Favourites** are any places without `kind: "here"`. The package has no list of its own and no picker: the page builds the reader's list and hands the whole list over each time it changes.

## The parts without a browser

`/earth-places` exports `readEarthPlaces` (the text of the attribute made into a safe list) and `layEarthPlaces(places, view, look, options)`, chikyu-earth's `layoutPlaces` on a body as a view draws it, for a page or a server that draws places itself. `/places` has the maths it stands on: `spotView` turns a `SurfaceView` (a body's centre, axes, the camera and the projection to the screen) into a picture places can be laid on, flat or in perspective, and `pointUnder` gives the longitude and latitude of the point under a direction, such as the Sun's.
