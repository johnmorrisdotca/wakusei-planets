---
title: You are here, and places on the Earth
section: how-to
order: 21
description: "Mark the reader's own place and any places they keep on the Earth of the space view: a beam, a pin or a ring standing out of the ground, turning with the Earth, hidden on its far side, dimmer at night, with names that never cross another name, layers of places that switch on and off, a press event, and how many places it carries at 60 frames a second. The layout is chikyu-earth's, through an optional peer; the page asks for the reader's place and the package stores and sends nothing."
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
| `earth-places` | `earthPlaces` | A JSON array of places, each `{ id, lon, lat, label, kind, color }`, and optionally `layer`, `size`, `look` and `namePriority` (below). Setting the property writes the attribute; an empty list takes the attribute away. |
| `earth-place-layers` | `earthPlaceLayers` | A JSON object of a layer's name to true or false, such as `{"harbours":false}`: the layers shown and hidden, for the Earth's places and the other bodies' (see "Layers of places"). |
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
- **At most 32 markers.** The first 32 places in sight, `here` first, then in the order given, then those whose `namePriority` is `low`, stand up. The rest of those in sight are counted in `earthPlacesShown.omitted`, not drawn: put the places that matter most first. A list is cut to 5,000, and a place with a longitude outside -180 to 180 or a latitude outside -90 to 90 is left out.
- **Nothing at rest.** The markers are laid when the picture is drawn (the camera moved, the clock stepped, a setting changed) and not otherwise; they are a few SVG shapes and names kept from one draw to the next and only moved. There is no animation: the reader's place is the tallest and brightest, not the one that pulses. The markers are not buttons and take no pointer: a press goes through them to the view, and only a still tap that ends on a drawn name or a foot ring is the event `wakusei-body-place` (below).
- **What it reports.** `space.earthPlacesShown` says what was laid at the last draw: `{ marks: [{ id, kind, x, y, named }], omitted, hidden }`, with each marker's foot in CSS pixels from the view's top left, and `hidden` the places left out because their layer is off.

## How many places it carries

The list may hold up to 5,000 places (a longer one is cut), and the cost is in laying them: at each draw the view reads the list (kept from the last draw while the text is the same), leaves out the layers that are off, works out where every place in it is on the Earth and moves the 32 markers. `e2e/earth-places-load.demo.ts` times that step in Chromium on a desktop with the page's own clock, at 100, 1,000 and 5,000 places, each named, over the whole globe, with the Earth in the middle of the view:

| Places in the list | The step, median | Of a 60 frames a second frame (16.7 ms) | At a quarter of the CPU's speed (a phone) | With a quarter of them in a layer that is off |
|---|---|---|---|---|
| 100 | 0.2 ms | 1% | 1.2 ms (7%) | 0.2 ms |
| 1,000 | 0.7 ms | 4% | 3.7 ms (22%) | 0.5 ms |
| 5,000 | 2.7 ms | 16% | 16.4 ms (98%) | 2.0 ms |

- **The cap: 1,000 places at 60 frames a second.** That is what the guide stands behind, and what the test holds (under a third of a frame, at full speed and with the CPU slowed to a quarter). 5,000, the list's own limit, fits a frame on a desktop (a sixth of one) but takes the whole frame at a quarter of the speed: a page for slow devices should hand over fewer, for instance the places in view, or put the rest in a layer and switch it off, which costs about a quarter less.
- **What a frame is.** The view draws at most 30 frames a second (a frame there is 33 ms), and nothing at rest; the step runs inside a draw the view makes anyway, and with no places it adds none. The times are the step's own, not the 3D drawing's, which places do not touch: the markers are SVG shapes and names, not part of the picture.
- **The markers do not grow with the list.** At most 32 stand up whatever the list holds (`earthPlacesShown.omitted` counts the rest in sight), so the page's own cost is the same for 100 places as for 5,000; only the laying of the list grows with it. There are no groups of crowded places here, as chikyu-earth's picture has: a place beyond the 32 is counted, not drawn.
- **Put the places that matter first,** and give the rest a `layer`, so a reader's switch takes a whole set away at once.

## Layers of places

Give places a `layer` (a name of your own, up to 40 letters) and switch the layers with `earth-place-layers`, so the page hands the list over once instead of building one for every switch. It is chikyu-earth's `place-layers`, with the attribute named for this element (`place-layers` is not used: `places` here is the layers of marks on the body looked at):

```js no-check
space.earthPlaces = [...spaceports.map((p) => ({ ...p, layer: "spaceports" })), ...harbours.map((p) => ({ ...p, layer: "harbours", size: "small" }))];
space.earthPlaceLayers = { harbours: false };
space.setEarthPlaceLayer("harbours", true);
```

- **Shown unless switched off.** A place with no layer is always shown, and so is a layer that `earth-place-layers` does not name. Only `false` hides one. `earthPlaceLayers` reads the switches back; `setEarthPlaceLayer(name, shown)` changes one and keeps the others.
- **Left out whole.** A place of a layer that is off is not drawn, not named, not pressable, and takes none of the 32 markers. `earthPlacesShown.hidden` counts them, and `earthPlaces` is still what was handed over. The same switches apply to `bodyPlaces`. There are no groups here, so there is nothing to gather. `readEarthPlaceLayers` and `shownEarthPlaces` of `/earth-places` are the same rules for a page or a server.
- **No fetching.** The package loads nothing for a layer; a page that fetches a layer's places when its switch goes on hands them over as it likes.

## A size and a look for each place

A place can be drawn differently from the rest, so a harbour is a short mark beside a city, and "You are here" stays the tall beam:

```js no-check
space.earthPlaces = [
  { id: "me", lon: -79.4, lat: 43.7, label: "You are here", kind: "here" },
  { id: "cavan", lon: -123.1, lat: 49.29, label: "Vancouver harbour", size: "small", look: "ring" },
  { id: "cape-canaveral", lon: -80.58, lat: 28.39, label: "Cape Canaveral", layer: "spaceports", namePriority: "low" },
];
```

- **`size: "small"`** is a stick about half as long and a ring about 30 per cent smaller than the kind's own. The default is the kind's size.
- **`look`** is `beam`, `pin` or `ring`, and wins over `earth-places-look` for this place. Left out, the place takes `earth-places-look`.
- **`namePriority: "low"`** lays the place's name, and its marker when more than 32 are in sight, after every other place's: its name gives way where the others crowd. chikyu-earth's `low` also gives way to the cities' names; this view has no cities' names, so the others are the places and the bodies' names.
- **No newer chikyu-earth needed.** These four fields are read and drawn here (`layer`, `size`, `look`, `namePriority`), whichever chikyu-earth version 0.36.0 or later is installed.

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

## Places on the Moon, Mars and any other body

`bodyPlaces` (the attribute `body-places`) is the same layer for every other body the view draws: a list of `{ body, id, lon, lat, label, kind, color }`, with `body` the id of the body (`moon`, `mars`, `ceres`, `io`) and the rest as `earthPlaces`. It needs the same import (`@johnmorrisdotca/wakusei-planets/earth-places`, chikyu-earth's layout: no new peer) and has the same look (`earth-places-look`), colours, names, limits and reading (`readBodyPlaces` of `/earth-places` groups the list by body and gives each group to `readEarthPlaces`). Each place stands on the ground of the body the camera looks at, or of any planet, the Moon or catalogue moon in sight at 40 CSS pixels of radius or more; it is hidden on the far side and under another body's disc, never over a body's name, and at most 32 stand up in all, the reader's `here` first. An entry for `earth` is not drawn: the Earth's places are `earthPlaces`. The standing view's sky has no beams yet.

`space.bodyPlacesShown` says what was laid, `{ marks: [{ body, id, kind, x, y, named }], omitted, hidden }`.

The rows of `/places/search` are the places. `loadPlaceHits(ids)` turns the ids a favourites page saved (this release's, or 0.66.0's: an old id is made current) into rows, fetching only the lists it needs, and `hitToBodyPlace(hit, { lang, kind, color })` makes a place of a row:

```ts no-run
import "@johnmorrisdotca/wakusei-planets/space/element";
import "@johnmorrisdotca/wakusei-planets/earth-places";
import { hitToBodyPlace, loadPlaceHits } from "@johnmorrisdotca/wakusei-planets/places/search";

const saved = ["moon/tycho", "mars/olympus-mons", "moon/apollo-11-lunar-module"];
const space = document.querySelector("wakusei-space")!;
space.bodyPlaces = (await loadPlaceHits(saved)).map((hit) => hitToBodyPlace(hit, { lang: "en" }));
```

## Pressing a beam

A still tap (it moved less than 6 pixels) that ends on a drawn name or a foot ring sends `wakusei-place-click` (bubbling, composed), the same event as chikyu-earth's `chikyu-place-click`, with its detail and one more field:

```js no-check
space.addEventListener("wakusei-place-click", (event) => {
  const { body, id, kind, layer, label, lon, lat, x, y } = event.detail;
  console.log(body, id, kind, layer, label, lon, lat, x, y);
});
```

- **What it carries.** `body` (`earth` for the Earth's places, else the body's id), `id` and `kind` (`here` or `favourite`) always; `layer`, `label`, `lon` and `lat` of the place, and `x`, `y`, where the press was in CSS pixels inside the element's box. A place whose layer is off cannot be pressed.
- **The older event stays.** The same tap also sends `wakusei-body-place`, below, with the mark's foot in `x` and `y`; a page already listening for it changes nothing.

`wakusei-body-place`, as before: a still tap (it moved less than 6 pixels) that ends on a drawn name or a foot ring sends `wakusei-body-place` (bubbling, composed) with `detail: { body, id, kind, x, y }`: the body (`earth` for the Earth's places), the place's `id` as you gave it, its `kind` (`here` or `favourite`) and its foot in CSS pixels from the view's top left. Nothing else happens: what a press does is the page's to decide (select first, go on a second press, open the place). The layer itself takes no pointer, so a drag that starts on a name still turns the view, and a tap that is a beam's is not also a press on the body under it. The nearest of several marks under the tap wins; a mark fading out cannot be pressed. There is no keyboard press on a beam (they are drawn for the eye, hidden from assistive technology): offer the same places as a list of buttons. chikyu-earth's own `chikyu-place-click` is the same press.

## The parts without a browser

`/earth-places` exports `readEarthPlaces` (the text of the attribute made into a safe list), `readEarthPlaceLayers` and `shownEarthPlaces` (the layers), and `layEarthPlaces(places, view, look, options)`, chikyu-earth's `layoutPlaces` on a body as a view draws it (with each place's own `size` and `look`), for a page or a server that draws places itself. `/places` has the maths it stands on: `spotView` turns a `SurfaceView` (a body's centre, axes, the camera and the projection to the screen) into a picture places can be laid on, flat or in perspective, and `pointUnder` gives the longitude and latitude of the point under a direction, such as the Sun's.
