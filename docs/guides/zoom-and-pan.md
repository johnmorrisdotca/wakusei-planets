---
title: Zoom and pan
section: how-to
order: 19
description: Every view in the package zooms and moves with a drag, a pinch, the wheel and the keys, with no controls on the page. The zoom range of each element, why each ends where it does, and how to turn the hands off or add the family's bar.
---

`<wakusei-body>`, `<wakusei-portrait>` and `<wakusei-space>` carry the shared [kazoku-ui](https://github.com/johnmorrisdotca/kazoku-ui) view controls themselves. A reader who finds the tag on a page can use it: no `<kazoku-view-controls>`, no wiring.

```html
<wakusei-body body="jupiter" look="realistic" size="420"></wakusei-body>
```

## What the reader can do

- **Drag.** At Fit a drag turns the body (or, for the portrait, moves the picture); zoomed in, a drag moves the view. The surface under the pointer follows the pointer.
- **Pinch.** Two fingers zoom, move and twist.
- **The wheel.** At Fit the plain wheel scrolls the page, so the picture is never a trap. Ctrl, Command or Alt with the wheel zooms about the pointer; once zoomed in, the plain wheel moves the view.
- **Keys.** Focus the element (it gets `tabindex="0"`): the arrows turn, `+` and `-` zoom, `0` or Home goes back to Fit. A double tap goes to 2x and back.
- **On a phone.** `touch-action` is `pan-y` at Fit, so a finger can still scroll the page, and `none` once zoomed.

## The zoom range

Zoom draws no more pixels: the canvas is a fixed size, inside the renderer's cap of 4096 pixels a side and 6 million pixels, and zooming only scales what is drawn. So the floor is arbitrary and the ceiling is the point where the picture's detail runs out.

| Element | Range | Why |
|---|---|---|
| `<wakusei-body>`, line look | 0.1x to 50x | The floor leaves room to see the whole body small. The line drawing is vector (an SVG), so it has detail at any scale; 50x shows a single band or crater rim large. |
| `<wakusei-body>`, `realistic` and `painted` | 0.1x up to where the body's detail runs out: 8x at least, 1000x at most | The 2048 pixel map is sharp to about twice the size at Fit; finer map tiles (for Mars, the Moon, the Earth and ten moons) and the shader's generic detail carry a body further, and every body has its own limit, the table in [Close zoom and map tiles](close-zoom.md). In a moons picture the planet is a small disc in a wide picture, so the same detail is a much larger zoom: Saturn goes to 1000x. |
| `<wakusei-portrait>` | 0.1x up to where its farthest-reaching body's detail runs out: 8x at least, 1000x at most | The same table, body by body, with the finer map tiles laid over each body that is big in the view ([Close zoom and map tiles](close-zoom.md)): a body's limit is measured in the radii its picture reaches from the middle of the short side of the view at Fit, so a big body in a plain scene goes as far as a body alone, a small one further, and a scene of bodies with no finer maps stays at 8x until they have some. Before the tiles are found the range is 8x. A line portrait stays at 8x, so a scene can change look without the range changing under it. |
| `<wakusei-space>` | a millionth to 3x | The floor takes the camera out past Neptune in the true scale (a millionth of the Earth's size shows the planets as specks). The ceiling is where the camera reaches the body: it is held 1.05 radii from the surface (`3.4 / zoom` radii away), so past a zoom of about 3.2 nothing moves. At 3x, 0.13 radii above the ground, the finest tiles of the Earth, Mars and the Moon are about two pixels a texel, which is where the table says their detail runs out, so 3x is both as near as the camera goes and as near as the detail does; the tiles make that picture sharp where the 2048 pixel map was enlarged eight times. |

Set your own with `zoom-min` and `zoom-max` on the tag (`zoom-min` is held to 1 or less and `zoom-max` to `zoom-min` or more, so Fit is always inside):

```html
<wakusei-body body="mars" look="realistic" zoom-max="4"></wakusei-body>
```

## Turning it off, or adding the bar

`controls="none"` takes the hands off. A body with `live="off"` (a thumbnail, a still) starts without them; `controls` with no value brings them back.

A page that wants buttons adds the bar, and the bar takes over while it is there. Apply its events as before with `setView`, and it reads the element's range, so you set it once, on the tag:

```html
<wakusei-body id="planet" body="saturn" look="line" tabindex="0"></wakusei-body>
<kazoku-view-controls for="planet" address controls="advanced" speed="0"></kazoku-view-controls>
```

Point `for` at the element itself, not at a box around it, or the element's own hands and the bar's both handle a drag. The bar needs the element to have a `tabindex` for the keys.

## Telling the page

Every change of the view, from the hands or from `setView`, sends `wakusei-view` on the element, with its `yaw`, `tilt`, `roll`, `zoom`, `panX` and `panY` (the portrait sends `zoom`, `panX` and `panY`; the space view `yaw`, `tilt` and `zoom`). The space view's `controller` is the shared controller behind it: `space.controller.set({ zoom: space.zoomFor("moon") })` goes to a distance.

## The embed page and the builder

`embed.html` zooms with a drag, a pinch, Ctrl and the wheel, the keys and a pair of + and - buttons (a frame under 240 pixels across has no room for the buttons, and no address; the hands stay), and writes the view into its own address: `?body=saturn&look=realistic&zoom=2` opens at 2x. The tilt of the view is `vtilt`, because `tilt` is the pose's. The [code builder](https://johnmorrisdotca.github.io/wakusei-planets/builder.html) follows the zoom of its picture, and the iframe code it writes carries `zoom=` once you have zoomed; the element's code does not, for a tag always starts at Fit.
