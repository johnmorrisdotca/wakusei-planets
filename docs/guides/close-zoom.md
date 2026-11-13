---
title: Close zoom and map tiles
section: how-to
order: 19
description: How far each body zooms and why it stops there, the finer map tiles that keep a close zoom sharp (made from public-domain NASA and USGS maps, served beside the demo, never in the package), the generic detail that stops a body going smooth, and what a close zoom costs.
---

A painted body's map is 2048 pixels round the equator. On a picture of the usual size that is sharp to about twice the size at Fit, and it blurs after that, so `<wakusei-body>` used to stop at 8 times (`<wakusei-portrait>` did too, until the tiles reached it: see below). In a moons picture, where the planet is a small disc in the middle of a wide view, 8 times was a planet a third of the frame wide: a reader asked why Saturn would not come any closer.

Now each body zooms to where **its own detail** runs out, and says so: the limit is different for each body, and there are two things behind it.

1. **Finer map tiles.** For the bodies that have a better public-domain map than the 2048 picture, the part in view is laid over the body from a pyramid of map tiles, up to 16384 pixels round. They are fetched only when the zoom needs them and let go when it does not.
2. **Generic detail.** Where a map, however fine, is enlarged more than a quarter, the shader adds octaves of noise so a body never goes smooth. It is not a measured feature of the body, and the page says so (below).

## How far each body goes

The zoom is measured against the picture: at zoom 1 the picture reaches `extent` body radii from the middle to its edge (2.2 for a body alone, the reach of its farthest moon or ring for a moons picture, which is 7 to 70). The disc is `zoom / extent` times as wide as the picture. A map `W` texels round the equator, on a disc `D` CSS pixels across, shows each texel `π D / W` pixels wide.

- The **real detail** runs out when a texel is wider than **1.6 CSS pixels**, on a picture 480 pixels across. That is the limit for a body with a map and no generic detail.
- The **generic detail** carries a rocky or icy body **1.15 times** further, and a soft one (a gas giant's bands, Venus' cloud, Titan's haze) **2 times**. A ring system's strip is a line of samples, so only **1.25 times**: Saturn goes as far as its rings' detail.
- No body zooms less than **8** (what the shaded looks always had), and none more than **1000**.

The result is `zoom = extent × reach`, where `reach` is how many picture widths wide the disc may grow. The table says it for a body alone (`extent` 2.2) and for a moons picture of each planet, in the demo's own address (`?body=saturn&moons=1`).

<!-- zoom-table -->
| Body | Widest map (texels round) | It is | Alone | Moons picture reaches | Moons picture |
|---|---|---|---|---|---|
| Sun | 2048 | unchanged | 8x |  |  |
| Mercury | 8192 | tiles | 22x |  |  |
| Venus | 2048 | map | 9.6x |  |  |
| Earth | 16384 | tiles | 44x | 69.9 radii | 1000x |
| Mars | 16384 | tiles | 44x | 7.6 radii | 151.9x |
| Jupiter | 2048 | map | 9.6x | 29.2 radii | 126.9x |
| Saturn | 2048 | map | 36.4x | 66.9 radii | 1000x |
| Uranus | 2048 | map | 9.6x | 25.2 radii | 109.3x |
| Neptune | 2048 | map | 9.6x | 15.8 radii | 68.5x |
| Pluto | 4096 | tiles | 11x | 60.8 radii | 304.1x |
| Ceres | 2048 | map | 8x |  |  |
| Orcus | 4096 | shader | 11x | 21.7 radii | 108.5x |
| Haumea | 4096 | shader | 11x | 72.3 radii | 361.3x |
| Quaoar | 4096 | shader | 11x |  |  |
| Makemake | 4096 | shader | 11x |  |  |
| Gonggong | 4096 | shader | 11x |  |  |
| Eris | 4096 | shader | 11x | 35.5 radii | 177.3x |
| Sedna | 4096 | shader | 11x |  |  |
| Vesta | 2048 | map | 8x |  |  |
| Pallas | 4096 | shader | 11x |  |  |
| Chiron | 4096 | shader | 11x |  |  |
| Pholus | 4096 | shader | 11x |  |  |
| Halley | 4096 | shader | 11x |  |  |
| Moon | 16384 | tiles | 44x |  |  |
| Phobos | 4096 | shader | 11x |  |  |
| Deimos | 4096 | shader | 11x |  |  |
| Io | 8192 | tiles | 22x |  |  |
| Europa | 1024 | map | 8x |  |  |
| Ganymede | 2048 | map | 8x |  |  |
| Callisto | 8192 | tiles | 22x |  |  |
| Mimas | 4096 | tiles | 11x |  |  |
| Enceladus | 8192 | tiles | 22x |  |  |
| Tethys | 8192 | tiles | 22x |  |  |
| Dione | 8192 | tiles | 22x |  |  |
| Rhea | 8192 | tiles | 22x |  |  |
| Titan | 2048 | map | 9.6x |  |  |
| Iapetus | 8192 | tiles | 22x |  |  |
| Miranda | 4096 | shader | 11x |  |  |
| Ariel | 4096 | shader | 11x |  |  |
| Umbriel | 4096 | shader | 11x |  |  |
| Titania | 4096 | shader | 11x |  |  |
| Oberon | 4096 | shader | 11x |  |  |
| Proteus | 4096 | shader | 11x |  |  |
| Triton | 8192 | tiles | 22x |  |  |
| Nereid | 4096 | shader | 11x |  |  |
| Charon | 4096 | tiles | 11x |  |  |
| Nix | 4096 | shader | 11x |  |  |
| Hydra | 4096 | shader | 11x |  |  |
| Vanth | 4096 | shader | 11x |  |  |
| Hiʻiaka | 4096 | shader | 11x |  |  |
| Namaka | 4096 | shader | 11x |  |  |
| Dysnomia | 4096 | shader | 11x |  |  |
<!-- /zoom-table -->

`zoom-min` and `zoom-max` on the tag win over all of this. A body whose tile set is found has its range raised to what the tiles allow (and the bar for it follows); one whose tile set is not found keeps the range its 2048 picture allows.

## The tiles

A tile set is the body's map cut into 512 pixel WebP squares at several sizes. Level `L` is `2048 × 2^L` pixels across, in `2^(L+2)` columns and `2^(L+1)` rows; column 0 is at longitude -180, row 0 at latitude 90, and a tile is `<body>/<level>/<column>/<row>.webp`. Level 0 is the package's own 2048 picture and is not cut. `manifest.json` lists what each body has.

| Body | Top level | Source |
|---|---|---|
| Mars | 3 (16384) | Viking Mars Digital Image Mosaic 2.1, colour, 1 km a pixel. The same mosaic at 232 m a pixel is cut to level 4 (32768 across) by `pnpm tiles:mars` only when `WAKUSEI_SHARP_TILES=1` |
| The Moon | 3 (16384) | LRO Camera colour map (NASA SVS, CGI Moon Kit). The LROC WAC morphology mosaic at 100 m a pixel is cut to level 4 by `pnpm tiles:moon`, under the same switch |
| Earth | 3 (16384) | Blue Marble Next Generation with topography and bathymetry |
| Mercury | 2 (8192) | MESSENGER MDIS global basemap |
| Io, Callisto | 2 | Galileo and Voyager mosaics (NASA, USGS) |
| Rhea, Enceladus, Tethys, Dione, Iapetus | 2 | Cassini global colour maps (NASA, JPL, SSI, LPI) |
| Triton | 2 | Voyager 2 mosaic (Paul Schenk, LPI) |
| Pluto, Charon, Mimas | 1 (4096) | New Horizons and Cassini mosaics |

A tile is **the package's own 2048 picture, enlarged, with the source's fine detail added**. The source is put on the sphere the way the 2048 picture was (the same turn, strip projection and desaturation), and what it has beyond the 2048 picture is added where it really holds data, not in the black of a pole nobody imaged. So a tile's colour, grade and filled poles are the 2048 picture's own at every level, and only the sharpness is new. The sources' licences and credits are in `NOTICE.md`.

Gas giants, Venus, Titan, Ceres, Ganymede, Europa and the Sun have no finer map that the package can use (a public-domain one, or one whose licence it may pass on), so they have no tiles: the 2048 picture and the generic detail carry them. The Sun draws as it always did.

### What the element does

- **Reads the tile set once**, when a zoom first wants more than the 2048 picture (`manifest.json`, shared by every element of the page), and nothing else is fetched until the zoom needs a tile.
- **Works out the part in view** from the camera's box and the body's pole and meridian (a pole in the box means every longitude), and the **level** from the zoom and the pixel ratio: the lowest level whose texels are no wider than a quarter more than a device pixel, or the finest there is.
- **Puts a window of picture together**, whole tiles of one level, at most 16 (a 2048 pixel square, or a strip such as 4096 by 1024 round a pole), and lays it over the map in the shader. The window's edges fade into the map, a window may cross longitude 180, and the window of a pole has no edge there. A view that would need more than 16 tiles (at a low zoom on a wide picture, or with a pole in it) keeps the 2048 picture until the zoom is higher.
- **Waits for the view to settle** (140 ms) before it fetches, so a drag or a pinch does not fetch what it passes, fetches at most 6 tiles at a time, and keeps the window while the view stays inside it.
- **Draws on demand.** A window that is ready asks for one draw, held to 30 a second with the rest; nothing is drawn at rest, out of sight or in a hidden tab, and a reader who asked for reduced motion gets no motion from it.
- **Frees what it holds.** A window no longer needed is kept for 4 seconds (the view may come straight back), then its picture and every decoded tile are let go; at most 48 decoded tiles are kept while it is in use, those of the window first.
- **Falls back silently.** With no `tiles` address, a manifest it cannot read, or a tile it cannot fetch, the body is drawn from its own picture, and a failed tile is not asked for again for half a minute. `element.stats.tiles` says what it is doing (`ready`, `level`, `shown`, `held`, `loading`, `failed`, `requested`, `pixels`), and `element.stats.zoomMax` the range.

### What it costs

| | |
|---|---|
| Graphics memory | One window: at most a 2048 pixel square of 8 bits a channel with its mipmaps, **about 22 MB**, and a second one for the moment a new window is made. The package's 2048 map stays under it (about 22 MB, as before). |
| Decoded tiles | At most 48 of about 1 MB each: **48 MB** of the page's memory, let go with the window. |
| Network | The tiles in view: a window is 16 tiles at most, about 20 to 50 KB each. A page that never zooms in fetches only `manifest.json` (a few kB). |
| Canvas | Unchanged: the canvas is the size of the picture, within the renderer's cap of 4096 pixels a side and 6 million pixels. Zoom draws no more pixels. |
| Devices | A device that says it has 2 GB of memory or less (`navigator.deviceMemory`) uses no tiles. |

## Where the tiles are

The tiles are **not in the npm package and not in the repository**: 15 bodies at up to 16384 pixels are about 77 MB, and a repository keeps every version of every file for ever. They are made from the sources by `scripts/make-body-tiles.py`, built by the Pages workflow and served beside the demo at https://johnmorrisdotca.github.io/wakusei-planets/tiles/ (GitHub Pages sends `access-control-allow-origin: *`; on a public repository it costs nothing). A level 4 for the Moon or Mars (32768 pixels across, 2048 tiles) is not built unless the repository variable `WAKUSEI_SHARP_TILES` is `1`. With it off, the Pages build does not download those two mosaics. Measured on 2026-11-13, once each file was on disk: the Moon is 72.79 MB, cut in 96 seconds from the 5.5 GB mosaic, and Mars is 66.02 MB, cut in 107 seconds from the 12 GB mosaic. The two add about 139 MB to the tile folder. The ordinary tiles of all 15 bodies are about 77 MB, so the folder stays under the 1 GB Pages limit. `WAKUSEI_SHARP_TILES=1 pnpm tiles:moon` and `pnpm tiles:mars` cut them.

An element looks there by default. A page that serves its own pictures (it sets `texture-base`) has no tiles unless it says where they are, so nothing reaches out from a page that did not ask:

```html
<wakusei-body body="mars" look="realistic" texture-base="/pictures/" tiles="/tiles/"></wakusei-body>
<wakusei-body body="mars" look="realistic" tiles="off"></wakusei-body>
```

To serve your own, make them and copy the folder:

```sh
python3 -m venv .cache/venv && .cache/venv/bin/pip install pillow numpy
.cache/venv/bin/python -I scripts/make-body-tiles.py build
```

`pnpm tiles` runs the second line. The script downloads each source once into `.cache/body-tiles/` (git-ignored), refuses a file whose SHA-256 is not the one written in the script, checks that the source lies on the 2048 picture (a correlation of its brightness, for a turn of a quarter, half and three quarters), and writes `.cache/body-tiles-out/` (a few minutes). Each level is made from the whole source in one go, never tile by tile, so neighbouring tiles agree along their shared edge, and longitude 180 has no seam. `pnpm test:tiles` cuts a made-up map and checks the pyramid's shape, that a level has the base's colour and the source's detail and none from where the source has none, and that the tiles join.

## Generic detail

A texel of a map is enlarged. Past about a quarter more than a pixel, the shader adds octaves of value noise to the colour, each half the size of the one before, each only while its cells are still two pixels wide or more (so nothing is finer than the screen shows and nothing shimmers). A rocky or icy body gets grain; a gas giant, Venus and Titan get a faint noise stretched along the lines of latitude (a streak, not a spot). It is **noise, not a measured feature**: it is the same for every body of its kind, it is not a crater or a storm, and it is put on only where the picture it is on has run out. A body with a finer map shows less of it, a glowing body (the Sun, a star) none, and a body whose map is sharp at the zoom shows none.

Where a body is drawn by its shader alone (the `illustrated` look, and the moons that have no map), its craters and bands are drawn from numbers at any size, but only so finely, so it is counted as a 4096 pixel map.

## Saturn's rings

The rings are a strip of 2048 samples from the inner edge of the C ring to the outer edge of the A ring (30 km each), from a Cassini mosaic. It is sharp until a sample is wider than a pixel and a quarter; past that, noise along the radius, octave by octave, finer than the strip, makes ringlets. The strip's gaps (the Cassini Division, the Encke gap), its colour and the shadow of the planet on it, and the rings' shadow on the planet, are the strip's and the geometry's, as they were. The ring's shader does not change the picture where a texel is smaller than a pixel.

## In the portrait and the space view

`<wakusei-portrait>` and `<wakusei-space>` draw their bodies through the painter, which now takes the same tiles, the same window and the same table. What is new is that a body has to work out which part of itself the camera sees: the painter is handed the camera (`PaintInfo.view`) and meets a grid of rays through the view, and a ring of points round the edge of the near side, with the body, in the body's own frame. That is one piece of maths for an orthographic camera (the portrait's) and a perspective one (the space view's), a body in the middle of the view or off to one side. A caller that gives no camera, such as chikyu-earth's space view, gets what it always got: the body's own pictures.

- **A far view fetches nothing.** A body whose disc is under 150 device pixels across its radius is not looked at, and the tile set (`manifest.json`) is read only when the 2048 pixel map is not sharp enough for what the camera sees. A portrait or a space view that is never brought near reads no tile set and no tile.
- **The portrait zooms as far as its farthest-reaching body goes.** Each body is measured the way a body alone is, in the radii its picture reaches from the middle of the short side of the view to its edge at zoom 1 (`extent`), on its widest map (the finest tile level once the tiles are found) and on whether its surface is soft; the range is the largest of them, and at least 8. So a scene of the Earth alone goes to the Earth's limit, a scene that holds a moon beside its planet goes as far as the moon's does, and a scene of bodies with no finer maps stays at 8. A line portrait stays at 8, so a scene can change look without the range changing under it. Before the tiles are found the range is 8, as it was.
- **The space view's ceiling stays at 3, and what changes is what 3 shows.** The camera is held 1.05 radii from the surface, and at a zoom of 3 it is 1.13 radii from the middle of the body: 0.13 radii above the ground, where a 35 degree view shows a patch about 8 percent of a radius across (about 530 km of the Earth). A texel of the finest level (16384 round) is then about two pixels wide in a view 420 pixels high, which is where the table above says the Earth's, Mars's and the Moon's detail runs out; so the table gives the space view no further to go, and the camera cannot go nearer. What used to be a 2048 pixel map enlarged eight times is now the level 3 tiles at their own size, four to nine of them on a view as wide as the demo's, fewer on a square one. The tiles are used where a body is drawn from its map: the Earth in both looks, Mars, the Moon and the rest in the `painted` look (the space view's `realistic` look draws them from the shader, which has no tiles). Mercury, Pluto and the moons that have tiles get what they have (a coarser level, a softer picture); Jupiter, Venus, Titan and the other bodies with no finer map are as soft at 3 as they were.
- **Only the body the camera is at gets a window.** A window is at most 16 tiles and about 22 MB of graphics memory (above); a space view's other bodies are specks or discs far smaller than 150 pixels, and a body that leaves the view lets its window go after 4 seconds.
- **The window follows the turn.** A body turning in time (a space view at a day a second) moves under its window, which holds while the part in view is inside it and is replaced, after the view has settled for 140 ms, when it is not. Each tile is fetched once; a tile that cannot be had is not asked for again for half a minute.

`element.stats.tiles` of the portrait and of the space view adds up what their bodies' windows are doing (`requested`, `loading`, `failed`, and `shown`, the finest level on a body now or `null`), and `element.stats.zoomMax` of the portrait is its range now. A page that uses the painter in its own scene gives it the camera with `info.view` and says where the tiles are with `createPainter({ tiles })`; see [In your own three.js scene](in-your-own-scene.md).

## What did not change

- The pan keeps the body in the picture (the middle of the picture may be at most half a radius past the body's edge), so at a deep zoom the part of the rings out beyond the disc cannot be centred by panning; the part that crosses the disc can.
- The renderer's caps (4096 pixels a side, 6 million pixels), drawing on demand at 30 frames a second at most, and nothing drawn out of sight: `pnpm test:freeze` runs the same, with the same limits.
- `<wakusei-space>`'s range is still a millionth to 3 times, and the camera is still held 1.05 radii from the surface.
