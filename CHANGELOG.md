# Changelog

## 0.10.0 - 2026-11-03

Painted maps for five more moons.

- **Tethys, Dione, Iapetus, Triton and Charon are painted** (MODULES-220), from public-domain maps: Cassini's global colour maps of Tethys, Dione and Iapetus (Paul Schenk, PIA18439, PIA18434, PIA18436), Voyager 2's global colour mosaic of Triton (PIA18668) and New Horizons' global map of Charon. Every source file is public domain by its Wikimedia Commons file page, and `NOTICE.md` has each one's credit and what was done to it, including where the map was centred (turned to match known features: Tethys's crater Odysseus, Iapetus's dark Cassini Regio; Triton's centre is from the USGS label of the same mosaic) and the unmapped north of Triton and south of Charon, which are continued smoothly from the real rows.
- The pictures add 0.45 MB to the package (the 512 and 1024 pixel widths; the 2048 ones are fetched when a view is zoomed in), which makes the pictures 1.94 MB; the test that holds their size now allows 2 MB.

## 0.9.0 - 2026-11-03

The other dwarf planets.

- **Ceres, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris and Sedna** (MODULES-232), in the line, realistic and painted looks (`DWARF_IDS`, `DwarfId`, `BODIES.eris`...), and the moons whose orbits are published with a date: **Vanth** (Orcus), **Hiʻiaka and Namaka** (Haumea) and **Dysnomia** (Eris). Weywot, Xiangliu and S/2015 (136472) 1 are left out: no orbit with a published phase exists.
- **Where they are**: `heliocentric()` takes a dwarf planet too, from JPL's Small-Body Database osculating elements of June 2026, run as a plain ellipse. Against JPL Horizons on 2026-11-03 all five checked are within 0.0002 au (a test holds it). The moons' orbits are from Holler et al. 2021 (Dysnomia), Ragozzine & Brown 2009 (Hiʻiaka, Namaka) and Brown et al. 2010 (Vanth); `NOTICE.md` has the sources and says which numbers are estimates (poles that have not been measured are taken along the orbit's pole; the shaded surfaces other than Ceres's are drawn from colours alone).
- **Haumea and Quaoar are long shapes** (1161 x 852 x 513 km, turning every 3.9 hours; 1241 x 1093 x 1023 km): the line look now draws the outline of a body with `axesKm` as the ellipse it really shows, and its features on that shape (Phobos, Deimos, Proteus, Nix and Hydra too).
- **Ceres is painted** from Dawn's colourised global map (public domain; the incomplete colour at high latitudes is made the surface's own grey).
- **The picker has three groups** (MODULES-204): the Sun and the planets, the dwarf planets and the well-known moons (the Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Enceladus, Titan, Triton, Charon), each a click away; the group follows the body chosen and the address keeps the choice. The portrait builder and the code builder have a dwarf planets group too.
- **Tests that every body turns about its real axis the right way** (MODULES-203): the rotation rate matches the period, and the spin axis of each planet and dwarf planet makes the published axial tilt with its orbit's pole, backwards for Venus, Uranus and Pluto.
- New entry points `@johnmorrisdotca/wakusei-planets/dwarfs` and `/moons-dwarf`; `/all` has both. `DWARF_IDS`, `DwarfId` and `HostId` (a planet or dwarf planet a moon can go round) are exported; `BODIES` and `BODY_IDS` have 12 more bodies, and the Portrait builder's order puts the dwarf planets after Pluto.
- The painted pictures of Ceres add 0.13 MB to the package (512 and 1024 pixels wide).

## 0.8.0 - 2026-11-03

The portrait builder at true orbit distance.

- **True orbit distance** (MODULES-283): a fourth arrangement beside row, arc and grid. Each moon is as far from its planet, and each planet from the Sun, as it really is, with the orbits drawn as circles, and the view backed off to hold them all. With a date set, every body is where it is then, seen from above the ecliptic; with none, they are lined up from the Sun along one side. `arrange: "orbit"` in the scene, `?scene=arrange:orbit~...` in the address.
- **A link from the demo** ("At true orbit distance", under the buttons that show bodies together) opens the same bodies in the portrait builder at true orbit distance, in the look that is chosen.

## 0.7.0 - 2026-11-03

The portrait builder: any bodies, one picture.

- **`portrait.html` and `<wakusei-portrait>`** (MODULES-231): put the Sun, the planets, Pluto and any of the 25 moons in one picture. Drag a body to move it (in a manual layout it snaps to the middle and edges of the others, with guide lines; hold Alt to switch the snap off), scroll or pinch over it to size it, turn it (the Turn tool, or Shift and a drag: the surface under the pointer follows the pointer, and the arrow keys agree; a body can also turn by itself, the way it really turns), order the bodies front to back, remove them, undo and redo, Centre and Fit all.
- **Auto-fit and Manual.** Auto-fit places and sizes the bodies and always fits them in: a row, an arc or a grid, at true scale (every size true to the others) or readable (sizes squeezed so the smallest can be seen), with a planet's moons going round it in orbit order, each with its orbit ring (Moons: round their planet, or on their own). Manual keeps every body where it was put and the size it was given, and moving to Manual keeps what Auto-fit had.
- **One light, a background, names, orbit rings, shadows, a date.** One Sun direction for the whole picture; a black, starry, gradient or clear background; names and orbit rings on or off; shadows (a body can shade another from the Sun, as in an eclipse: `uOcc` in the shader); the sky at a date, with each body's real pole. Line, realistic or painted for the whole scene. Presets: a family photo, the gas giants, Jupiter and the Galileans, the Earth and Moon to scale.
- **The scene is in the address** (`?scene=...`; `encodeScene`, `decodeScene`), so a link is the picture. **Share** writes the page code in every way a page is made (`portraitCode`, built on the same code as `embedCode`, so `embed.html?scene=...` is the iframe), saves a PNG, saves an SVG (all vector for the line look; the bodies as a picture inside the SVG for the shaded looks) and copies the link.
- **Performance.** All the bodies of a scene are in ONE three.js scene on the page's one WebGL context; it draws only on a change, thirty times a second at most while something moves, nothing out of sight; pictures are fetched at the size they need and given back. The freeze test plays twelve bodies in one scene (rest, turning, a drag, changes to the scene, the 5K canvas budget).
- `painter.make(...).update` takes an optional `pose` (a pole and a prime meridian to draw instead of the real ones) and `occluders` (spheres that shade the body from the Sun). `ThreeParts` now includes `Group`: a page that hands over its own three.js subset adds `Group`.
- New entry point `@johnmorrisdotca/wakusei-planets/portrait`; `addBody`, `layoutPortrait`, `encodeScene`, `decodeScene`, `PORTRAIT_PRESETS` and `portraitCode` in the main one. A guide, "The portrait builder", in English and Japanese.

## 0.6.0 - 2026-11-03

The demo's pickers, and a scale that is a scale.

- **A compact picker** (MODULES-285): the ten bodies in one row, and when the one chosen has moons, its moons on the row below, in the same place; no long list down the page. The moons' own section is gone. Every picture in it is a picture, in the line, the realistic and the painted look: a test looks at all 35 (10 bodies and 25 moons) for blank and single-colour pictures. (The broken thumbnails of 0.3.0 were the tiles being drawn to scale, which 0.3.1 stopped.) The same picker is in "Put it in your page" (MODULES-286), so the body for the code is chosen beside the code; Copy's word can be read (it was ink on ink).
- **The buttons under the view stay where they are** (MODULES-283): one push button for each body of the system (the planet and its moons), the chosen one pressed, and others pressed with it to see them side by side under the view, at equal sizes or at their true relative sizes (`span-km`), kept in the address (`?with=phobos,deimos&rel=1`). The orbit-distance layout is not made yet.
- **To scale says what it is against** (MODULES-284): "Its planet" (for a moon), "Earth" or "Sun", and draws it so: Deimos is 0.0018 times Mars's radius, a magnified picture beside it with a line, the caption says so. `?scale=1&ref=planet`.
- **Deimos is drawn whole** (MODULES-287): an irregular body reaches past its mean radius along its longest axis, and its picture was cut off at the sides.
- **Every body is fitted by its globe** (MODULES-293): at about half the view's height, the same for all, so Saturn's rings, the Sun's glow and a haze have room, and the Sun is no smaller than a planet. `fit="tight"` on an element gives the old fit (thumbnails).
- **The sky shows the real phase** (MODULES-294): in "As seen from Earth" the night side is dark (no wrapped terminator, no rim of air round it), so Venus a few days from new is a thin crescent, not a full disc.
- **A line under every choice** (MODULES-298) says what it does, in English and Japanese, always on the page and tied to its button with `aria-describedby`.

## 0.5.1 - 2026-11-03

- kazoku-ui 0.12.0: the demo's view controls have a zoom slider, on top of 0.11's Centre button and exact grab.
- Documentation: an architecture guide and a fuller upgrading guide, each with its Japanese twin; a code builder page (`builder.html`); eight new pictures; a longer README whose examples run (`pnpm test:readme`); and every release of this changelog dated. No behaviour changed.
- The README opens with the package's thumbnail, and the demo carries it as its link preview (og:image) and publishes the card, a dark card and an icon on Pages at `thumbnail.png`, `thumbnail-dark.png` and `icon.png`.

## 0.5.0 - 2026-11-03

The bodies for someone else's three.js scene.

- **`@johnmorrisdotca/wakusei-planets/painter`**: `painter.make(three, "Jupiter", { look, invalidate, ratio })` makes the Sun, a planet, Pluto or a moon as an object of radius 1 for a perspective-camera scene of your own, in the realistic or the painted look, lit from any direction in the scene's own axes (equatorial J2000, y up), turned about its real pole at the moment given, with its rings and the Sun's glow. Nothing is drawn by it and it holds no renderer, loop or clock: the caller places, scales and calls `update({ toSun, ms, radiusPx })` at each draw. A painted body shows the shaded look until its map arrives, fetches a sharper map only when it is big on the screen, and lets the big one go a few seconds after it shrinks. `painter.moons("Jupiter", ms)` places a planet's moons in planet radii. Its shape is chikyu-earth's `BodyPainter`, so `setBodyPainter(painter)` is the whole wiring (chikyu-earth 0.11).
- New shaders for it (`VERTEX_WORLD` and friends): the lighting, the ring's shadow and the limb are worked out from the direction to the camera, not from an orthographic viewer's frame.
- `orientation(id, ms)` and `moonOffset(id, ms)`: a body's pole and prime meridian, and a moon's place from its planet, in the same axes.
- A guide, "In your own three.js scene", in English and Japanese.

## 0.4.0 - 2026-11-03

"Put it in your page" is a configurator.

- **Set up a body, copy the code.** The demo's last section follows what is set up above it (body, look, sky and date, moons, turning) and a size (160, 240, 320 or 480), and writes working code for plain HTML from jsDelivr, an ES module, React, Vue, Angular, Svelte and an iframe of the embed page, on tabs that answer the arrow keys, beside a picture made from the same choices, with a Copy button and the credits that go with the picture. The choices are kept in the address (`?embed=react&size=240`).
- **`embedCode(options, kind, settings)` and `embedCredit(options)`** make the same text for a page of your own (`EMBED_KINDS`: `html`, `module`, `react`, `vue`, `angular`, `svelte`, `iframe`). Pattern: senshu-jerseys' `embedCode` and its tabbed "Put it in your page". Every snippet is tested (`test/embed.test.ts`): the React component is built and rendered, the Vue and Svelte components compiled, the Angular template parsed, the module checked as TypeScript, the iframe's address read the way the embed page reads it, and every body's entry point exists in the package.
- A guide, "Put it in your page", in English and Japanese.
- **kazoku-ui 0.11.0**: the view controls' Centre button (it appears once the body is dragged away), a pan that keeps a quarter of the body in sight (told the body's size with `object-size`), and a drag that keeps the touched point under the pointer (`grab-radius`). The 0.3.1 stopgap that made Fit re-centre is gone.

## 0.3.1 - 2026-11-03

The Earth is a body like the others, and "To scale" is a comparison.

- **The Earth draws in every look.** In the realistic and painted looks the big view was empty and the row showed chikyu-earth's line globe, because the Earth was handed to chikyu-earth's own live element (0.7.0 here, a second WebGL context, no still). It is now drawn by this package like every other body, from NASA's Blue Marble picture (`earth-512`, `-1024` and `-2048`; the package grows by 0.08 MB), through the page's one WebGL context, with a still in the row. Both looks use the picture (an honest shaded Earth cannot be worked out from numbers), with a rim of air. Only the line look is chikyu-earth's globe. The Earth is in `/all`. chikyu-earth is now `^0.10.0` (it was `^0.7.0`).
- **"To scale" is a lineup** (section "To scale" in the demo): every body at the same scale in the same size of picture, a magnified picture joined by a line for each body too small to see, Saturn's rings whole, the Sun as the curved edge it is, the Earth at its true size. The tiles in the row are never scaled any more (the Sun was a flat square, Mercury a dot). New attribute `span-km`: the half-width of a picture in kilometres, the same in every picture of a lineup.
- **Every moon has a tile and a name** for `body` (`?body=io`), in the demo under its planet, with chips on each planet's and moon's view for its moons, its planet and its sister moons.
- **The body cannot be dragged out of the view** (a quarter of it stays in), and Fit centres it and returns it to its first angle.
- The README's pictures are absolute addresses pinned to the release's tag (npm's page showed a different picture from GitHub's), and a test holds it (`pnpm readme:images` pins them after a version bump).

## 0.3.0 - 2026-11-03

Painted moons, Saturn's rings from Cassini, and a drag that goes the right way up.

- **Painted maps of nine moons**, from public-domain imagery on Wikimedia Commons, each file's licence read from Commons and credited in `NOTICE.md`: the Moon (LRO WAC, NASA's SVS Moon Kit), Io (Galileo and Voyager), Europa (USGS), Ganymede and Callisto (USGS), Titan (Cassini's 938 nm map, coloured and low in contrast, said plainly in `NOTICE.md`), Rhea, Enceladus (Cassini colour maps, the false colour turned most of the way to grey) and Mimas (Cassini). 512 and 1024 pixel widths in the package, 2048 from the repository as for the planets (Europa's source is 1024 wide, so it has no 2048). Where a source does not state its longitudes, `NOTICE.md` says what the map was turned by and why. Tethys, Dione, Iapetus, Triton and Charon keep their drawn look: Cassini maps of the first three are not made yet, Triton's source gives no longitudes, and the only clean public-domain map of Charon is under a grid of labels.
- **Saturn's rings in the painted look are a Cassini picture** (PIA07874, natural colour): one strip of 2048 colours and opacities from 74,794 to 137,035 km, 2.4 KB, with the real ringlets, the Cassini Division and the Encke gap. The realistic look keeps the strip made from the ring table. `PaintedMap.rings` names the strip; a strip that cannot load leaves the table's.
- **The package's pictures grow from 0.53 MB to 1.31 MB** (the 512 and 1024 widths of 18 maps and the ring strip); the budget in `pnpm test:package` is 1.5 MB.
- **The Moon is in `/all`.** `@johnmorrisdotca/wakusei-planets/all` left out `moons-earth`, so the demo's Moon was drawn as a plain ball.
- **Io's Pele is at 105 degrees east** in the shaded look (it was at 90 degrees west; Pele is at 255 degrees west).
- **A drag up moves the surface up** (it moved it down), in every look: the controls' tilt tipped the pole toward you as it grew, and now tips the top of the body away, so the near surface goes up, as in chikyu-earth 0.9.1. Drag right, the right arrow and the up arrow agree. Test (`e2e/drag.demo.ts`): a real pointer and real key presses on Mars (line, shaded, painted), Venus and the Moon (painted); the vertical checks fail on 0.2.0.
- `scripts/make-textures.py` makes the moons and the ring strip too (`python3 scripts/make-textures.py io saturn-ring`) and writes each source's file page, licence and credit into `textures/SOURCES.json`.

## 0.2.0 - 2026-11-02

The painted looks.

- `look="painted"`: real surface maps of Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto and the Sun, from public-domain NASA, USGS and JPL imagery, each file's licence checked and credited in `NOTICE.md`. Saturn, Uranus, Neptune and the Sun have no global map, so theirs are made from one photograph each (said plainly in `NOTICE.md`).
- Small pictures by default: the 512 and 1024 pixel widths are in the package (0.53 MB in all); a view that is zoomed in fetches the 2048 pixel width from the repository by jsDelivr's GitHub address (`texture-far-base` to serve it yourself). A picture that fails to load leaves the shaded look drawn, and no picture is asked for twice.
- A texture is freed when a sharper one replaces it and when the element leaves.

## 0.1.0 - 2026-11-03

The first release. The package, to the family's standard from the start: a demo and an embed page on GitHub Pages, a documentation site in English and Japanese, a README with every way to use it (each one tested), the shared release workflow with its freeze test.

- Line drawings, as SVG strings and as `<wakusei-body look="line">`, of the Sun, Mercury, Venus, Mars, Jupiter, Saturn (with its rings), Uranus (with its rings), Neptune and Pluto, and of the Moon, Phobos and Deimos, the Galilean moons, Saturn's seven larger moons, Uranus's five, Neptune's Proteus, Triton and Nereid, and Pluto's Charon, Nix and Hydra: real relative sizes, axial tilt and rotation as data.
- The Earth, through a thin adapter over chikyu-earth's own globe (`/earth`, chikyu-earth an optional peer): its line globe, and its Earth from space when the body is live. No second copy.
- Shaded realistic drawings with three.js through kazoku-ui's shared renderer, each body its own optional entry point: bands, spots, craters, caps and the Pluto heart worked out in a shader, rings that cast shadows, the Sun's glow.
- The sky for a date and time: a body's pole, rotation, phase and ring opening as the Earth sees it, and a planet's moons on their orbits where they are then (JPL elements, Meeus for the Moon), worked out about once a second and carried forward between.
- One WebGL context per page, nothing drawn at rest, thirty frames a second at most, canvas within 4096 pixels a side and 6 MP, everything freed, no drawing out of sight, reduced motion respected, a lost context recovers; tested by `pnpm test:freeze` and a soak.
