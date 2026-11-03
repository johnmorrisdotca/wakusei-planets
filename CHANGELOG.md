# Changelog

## [Unreleased]

- The README opens with the package's thumbnail, and the demo carries it as its link preview (og:image) and publishes the card, a dark card and an icon on Pages at `thumbnail.png`, `thumbnail-dark.png` and `icon.png`.

## 0.5.0

The bodies for someone else's three.js scene.

- **`@johnmorrisdotca/wakusei-planets/painter`**: `painter.make(three, "Jupiter", { look, invalidate, ratio })` makes the Sun, a planet, Pluto or a moon as an object of radius 1 for a perspective-camera scene of your own, in the realistic or the painted look, lit from any direction in the scene's own axes (equatorial J2000, y up), turned about its real pole at the moment given, with its rings and the Sun's glow. Nothing is drawn by it and it holds no renderer, loop or clock: the caller places, scales and calls `update({ toSun, ms, radiusPx })` at each draw. A painted body shows the shaded look until its map arrives, fetches a sharper map only when it is big on the screen, and lets the big one go a few seconds after it shrinks. `painter.moons("Jupiter", ms)` places a planet's moons in planet radii. Its shape is chikyu-earth's `BodyPainter`, so `setBodyPainter(painter)` is the whole wiring (chikyu-earth 0.11).
- New shaders for it (`VERTEX_WORLD` and friends): the lighting, the ring's shadow and the limb are worked out from the direction to the camera, not from an orthographic viewer's frame.
- `orientation(id, ms)` and `moonOffset(id, ms)`: a body's pole and prime meridian, and a moon's place from its planet, in the same axes.
- A guide, "In your own three.js scene", in English and Japanese.

## 0.4.0

"Put it in your page" is a configurator.

- **Set up a body, copy the code.** The demo's last section follows what is set up above it (body, look, sky and date, moons, turning) and a size (160, 240, 320 or 480), and writes working code for plain HTML from jsDelivr, an ES module, React, Vue, Angular, Svelte and an iframe of the embed page, on tabs that answer the arrow keys, beside a picture made from the same choices, with a Copy button and the credits that go with the picture. The choices are kept in the address (`?embed=react&size=240`).
- **`embedCode(options, kind, settings)` and `embedCredit(options)`** make the same text for a page of your own (`EMBED_KINDS`: `html`, `module`, `react`, `vue`, `angular`, `svelte`, `iframe`). Pattern: senshu-jerseys' `embedCode` and its tabbed "Put it in your page". Every snippet is tested (`test/embed.test.ts`): the React component is built and rendered, the Vue and Svelte components compiled, the Angular template parsed, the module checked as TypeScript, the iframe's address read the way the embed page reads it, and every body's entry point exists in the package.
- A guide, "Put it in your page", in English and Japanese.
- **kazoku-ui 0.11.0**: the view controls' Centre button (it appears once the body is dragged away), a pan that keeps a quarter of the body in sight (told the body's size with `object-size`), and a drag that keeps the touched point under the pointer (`grab-radius`). The 0.3.1 stopgap that made Fit re-centre is gone.

## 0.3.1

The Earth is a body like the others, and "To scale" is a comparison.

- **The Earth draws in every look.** In the realistic and painted looks the big view was empty and the row showed chikyu-earth's line globe, because the Earth was handed to chikyu-earth's own live element (0.7.0 here, a second WebGL context, no still). It is now drawn by this package like every other body, from NASA's Blue Marble picture (`earth-512`, `-1024` and `-2048`; the package grows by 0.08 MB), through the page's one WebGL context, with a still in the row. Both looks use the picture (an honest shaded Earth cannot be worked out from numbers), with a rim of air. Only the line look is chikyu-earth's globe. The Earth is in `/all`. chikyu-earth is now `^0.10.0` (it was `^0.7.0`).
- **"To scale" is a lineup** (section "To scale" in the demo): every body at the same scale in the same size of picture, a magnified picture joined by a line for each body too small to see, Saturn's rings whole, the Sun as the curved edge it is, the Earth at its true size. The tiles in the row are never scaled any more (the Sun was a flat square, Mercury a dot). New attribute `span-km`: the half-width of a picture in kilometres, the same in every picture of a lineup.
- **Every moon has a tile and a name** for `body` (`?body=io`), in the demo under its planet, with chips on each planet's and moon's view for its moons, its planet and its sister moons.
- **The body cannot be dragged out of the view** (a quarter of it stays in), and Fit centres it and returns it to its first angle.
- The README's pictures are absolute addresses pinned to the release's tag (npm's page showed a different picture from GitHub's), and a test holds it (`pnpm readme:images` pins them after a version bump).

## 0.3.0

Painted moons, Saturn's rings from Cassini, and a drag that goes the right way up.

- **Painted maps of nine moons**, from public-domain imagery on Wikimedia Commons, each file's licence read from Commons and credited in `NOTICE.md`: the Moon (LRO WAC, NASA's SVS Moon Kit), Io (Galileo and Voyager), Europa (USGS), Ganymede and Callisto (USGS), Titan (Cassini's 938 nm map, coloured and low in contrast, said plainly in `NOTICE.md`), Rhea, Enceladus (Cassini colour maps, the false colour turned most of the way to grey) and Mimas (Cassini). 512 and 1024 pixel widths in the package, 2048 from the repository as for the planets (Europa's source is 1024 wide, so it has no 2048). Where a source does not state its longitudes, `NOTICE.md` says what the map was turned by and why. Tethys, Dione, Iapetus, Triton and Charon keep their drawn look: Cassini maps of the first three are not made yet, Triton's source gives no longitudes, and the only clean public-domain map of Charon is under a grid of labels.
- **Saturn's rings in the painted look are a Cassini picture** (PIA07874, natural colour): one strip of 2048 colours and opacities from 74,794 to 137,035 km, 2.4 KB, with the real ringlets, the Cassini Division and the Encke gap. The realistic look keeps the strip made from the ring table. `PaintedMap.rings` names the strip; a strip that cannot load leaves the table's.
- **The package's pictures grow from 0.53 MB to 1.31 MB** (the 512 and 1024 widths of 18 maps and the ring strip); the budget in `pnpm test:package` is 1.5 MB.
- **The Moon is in `/all`.** `@johnmorrisdotca/wakusei-planets/all` left out `moons-earth`, so the demo's Moon was drawn as a plain ball.
- **Io's Pele is at 105 degrees east** in the shaded look (it was at 90 degrees west; Pele is at 255 degrees west).
- **A drag up moves the surface up** (it moved it down), in every look: the controls' tilt tipped the pole toward you as it grew, and now tips the top of the body away, so the near surface goes up, as in chikyu-earth 0.9.1. Drag right, the right arrow and the up arrow agree. Test (`e2e/drag.demo.ts`): a real pointer and real key presses on Mars (line, shaded, painted), Venus and the Moon (painted); the vertical checks fail on 0.2.0.
- `scripts/make-textures.py` makes the moons and the ring strip too (`python3 scripts/make-textures.py io saturn-ring`) and writes each source's file page, licence and credit into `textures/SOURCES.json`.

## 0.2.0

The painted looks.

- `look="painted"`: real surface maps of Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto and the Sun, from public-domain NASA, USGS and JPL imagery, each file's licence checked and credited in `NOTICE.md`. Saturn, Uranus, Neptune and the Sun have no global map, so theirs are made from one photograph each (said plainly in `NOTICE.md`).
- Small pictures by default: the 512 and 1024 pixel widths are in the package (0.53 MB in all); a view that is zoomed in fetches the 2048 pixel width from the repository by jsDelivr's GitHub address (`texture-far-base` to serve it yourself). A picture that fails to load leaves the shaded look drawn, and no picture is asked for twice.
- A texture is freed when a sharper one replaces it and when the element leaves.

## 0.1.0

The first release. The package, to the family's standard from the start: a demo and an embed page on GitHub Pages, a documentation site in English and Japanese, a README with every way to use it (each one tested), the shared release workflow with its freeze test.

- Line drawings, as SVG strings and as `<wakusei-body look="line">`, of the Sun, Mercury, Venus, Mars, Jupiter, Saturn (with its rings), Uranus (with its rings), Neptune and Pluto, and of the Moon, Phobos and Deimos, the Galilean moons, Saturn's seven larger moons, Uranus's five, Neptune's Proteus, Triton and Nereid, and Pluto's Charon, Nix and Hydra: real relative sizes, axial tilt and rotation as data.
- The Earth, through a thin adapter over chikyu-earth's own globe (`/earth`, chikyu-earth an optional peer): its line globe, and its Earth from space when the body is live. No second copy.
- Shaded realistic drawings with three.js through kazoku-ui's shared renderer, each body its own optional entry point: bands, spots, craters, caps and the Pluto heart worked out in a shader, rings that cast shadows, the Sun's glow.
- The sky for a date and time: a body's pole, rotation, phase and ring opening as the Earth sees it, and a planet's moons on their orbits where they are then (JPL elements, Meeus for the Moon), worked out about once a second and carried forward between.
- One WebGL context per page, nothing drawn at rest, thirty frames a second at most, canvas within 4096 pixels a side and 6 MP, everything freed, no drawing out of sight, reduced motion respected, a lost context recovers; tested by `pnpm test:freeze` and a soak.
