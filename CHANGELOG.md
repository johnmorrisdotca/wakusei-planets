# Changelog

## [Unreleased]

The moons are where they are, and every body is checked against JPL Horizons (MODULES-525, MODULES-522).

- **The moons of Saturn, Uranus, Neptune and Pluto were in the wrong place.** Mimas, Tethys, Dione, Rhea, Titan, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton and Nix were tens of degrees off (Titan 157, Dione 151) at every date, including the epoch the elements are for, and Phobos, Enceladus, Proteus and Hydra up to 21. The angles in JPL's Planetary Satellite Mean Elements do not reproduce Horizons' positions for these moons: for Dione the table gives a mean longitude of 328 degrees where Horizons' own elements give 177. Their orbits are fitted to Horizons' positions and velocities for 1950 to 2050 now (`scripts/make-moon-data.py`), each in its mean orbit plane. 21 of the 24 moons are within a degree of Horizons on every date from 1900 to 2100, and the worst is Nereid, an orbit with an eccentricity of 0.75, at 6 degrees. The Uranian moons also go round Uranus the other way from what the pole in the facts says, and Triton's orbit was reversed twice (its inclination and its rate); both are fixed by describing each orbit as going round anticlockwise about its own pole.
- **Phobos has an acceleration and Mimas and Tethys a swing.** `OrbitElements` has two optional terms for the mean longitude: `acc`, for Phobos, whose orbit is shrinking, and `wave`, for the Mimas–Tethys resonance, a swing of 43 degrees over 70 years that the fit found by itself.
- **`test/accuracy.test.ts` holds every planet, the Moon and every moon to a limit against Horizons** (`test/data/horizons.json`, from `scripts/fetch-horizons-reference.py`), on five dates from 1800 to 2050 for the planets and seven from 1900 to 2100 for the moons. It fails on the old orbit table. The numbers are in a new [Accuracy](docs/guides/accuracy.md) guide, in English and Japanese. The planets are within 1 arc-minute except Jupiter (5) and Saturn (9).
- **A synchronous moon's spin takes its direction from the facts and its speed from the orbit** (`turnRate`), because the sign of an orbit's rate no longer says which way a moon goes round. The rotation test checks the rate.
- **The docs said moon positions were accurate to a few degrees.** That was true for Jupiter's moons and the Moon, not for the rest; the README, the guides and NOTICE.md say what was measured.

## 0.18.0 - 2026-11-07

The view gestures are the family's, on kazoku-ui 0.19 (MODULES-527).

- **kazoku-ui 0.15 to 0.19.** The wheel over a view moves it, and Shift with the wheel moves it sideways; Ctrl, Command or Alt with the wheel zooms about the pointer; the middle button or Space with a drag moves it; Shift with a drag rolls it. Before, a plain wheel zoomed, Alt did nothing and Shift turned the body.
- **A pan moves the picture by as many pixels as the controls say.** `setView` read `panX` and `panY` as half-widths of the picture, but the controls send CSS pixels, so any pan jumped the picture to its limit. They are pixels now. A page that calls `setView` with fractions of the width must send pixels.
- **`setView` takes `roll`**: the picture, with its rings, moons and orbits, turns clockwise about the line of sight, in both the line and the shaded looks.
- **The portrait builder's wheel is the family's too** (Manual layout): the wheel moves the view, Shift moves it sideways, Ctrl, Command or Alt zoom. Shift with the wheel no longer sizes a body; `[` and `]` do.
- `e2e/gestures.demo.ts` sends each gesture with real events and compares the pictures with what the controls report. It fails on the old element (a pan lands 80 to 260 pixels from where it should, a roll changes nothing).

## 0.17.2 - 2026-11-07

Rings are drawn all the way round.

- Every ring is drawn all the way round again. Both halves of a ring covered the side toward the camera, so the far half, which passes behind the planet, was never drawn on Saturn, Uranus, Jupiter and Neptune.
- Jupiter keeps a thin main ring. The halo and the gossamer stay a hint, and Neptune's sheet stays fainter than the thin rings (MODULES-509).

## 0.17.1 - 2026-11-06

Saturn, Uranus and Neptune show their turn.

- A plain band is the same at every longitude, so those three turned and the picture stayed still. Saturn now draws its north hexagon and a wave in the bands; Uranus and Neptune draw a storm and a wave. They move with the surface (MODULES-509).
- `e2e/turn-all.demo.ts` waits three seconds and fails unless one percent of the middle of the disc has changed, for every body, with no date and with a date.

## 0.17.0 - 2026-11-06

Photo maps on the realistic look, and every body turns.

- The documentation site's browser test is the family's current copy, so the skip-link check reaches the link with Tab on Mac WebKit (MODULES-411).
- Painted maps of Venus, Saturn, Neptune and the Sun are Solar System Scope's equirectangular maps, CC BY 4.0 (MODULES-509). Mercury is the natural grey 8K map (Shady Tex and Solar System Scope, CC BY 4.0), resized to 512, 1024 and 2048; the enhanced-colour map and its smeared poles are gone, and the normal map is not used. Mars stays on the Viking mosaic, graded toward a butterscotch ochre (MODULES-509): the craters and the ice caps are the mosaic's, and the seasonal frost in Hellas is toned to the basin and feathered so the patch has no hard edge. Both polar caps stay white. Solar System Scope's map and Shady Tex's 4K were compared; the 4K is the warmer colour and the mosaic is the detail, so the mosaic was graded rather than replaced. The painter's relief comes from the colour, so a separate normal map is not used. Jupiter and Uranus use Nestaeric's band maps, CC BY 4.0, which have east-west detail. Saturn's poles, including the north hexagon, are reprojected from Nestaeric's caps, also CC BY 4.0. The Earth stays on Blue Marble and the Moon on the LRO map until each has been compared. Sizes in the repository are 512, 1024 and 2048. The 8K originals stay out of the repository.
- `realistic` draws the photo maps, and `painted` is the same maps, kept as an attribute for an older page (MODULES-509). The demo shows one button for it, Realistic. `illustrated` is the shaded drawing that `realistic` used to be, and it is not a default. Its Japanese name on the picture is イラスト, which means "illustration".
- A portrait with no `turn` turns at 12 degrees a second, backwards for a body that turns backwards (Venus, Uranus). A picture with a date keeps that orientation and adds the same turn, and that turn keeps going instead of jumping back each second. `turn="0"` is the only stop. Reduced motion keeps a quarter of the turn (MODULES-509). `e2e/turn-all.demo.ts` photographs every body twice, two seconds apart, with no date and with a date, and the pictures differ.
- The Earth is drawn from the side opposite the Moon, so the Earth and the Moon show the same phase (MODULES-509).
- A portrait's true sizes keep the real ratio. A small body beside the Sun is no longer lifted to a minimum, which had made the Earth too big next to Jupiter.
- A surface picture that arrives after its body has gone is dropped, so switching bodies does not keep the old pictures. A thumbnail with `live="off"` stays still unless it is given a turn.
- Neptune's colour stays Solar System Scope after a comparison with Nestaeric's band map (MODULES-509): both have the dark spot, and Solar System Scope has more of the bands. The black hole is not part of this.
- Jupiter and Neptune have rings, drawn by the same code as Saturn and Uranus (MODULES-509). Jupiter's are the halo, the main ring from 122,800 to 129,200 km and the gossamer rings out to 226,000 km. Neptune's are Galle, Le Verrier, the Lassell sheet and Adams. Adams's arcs are that radius; a strip has no longitude.
- Saturn's rings are drawn as two halves. The half toward the camera is painted over the disc, and the far half is hidden behind it, so the near arc crosses in front and the far arc goes behind. The shadow on the rings stays.

## 0.16.0 - 2026-11-05

Every body as a journey stop (MODULES-401), for journey planners such as uchusen-rockets' journey mode.

- **`JOURNEY_STOPS`**: every body as one row, with its radius, its mean distance from the Sun, its gravitational parameter, its mass and its escape speed, and `stopPlaceAu` for where it is on a date. A body whose pages print no mass has those fields empty.

## 0.15.0 - 2026-11-04

The family's embed panel on the code builder and the portrait builder (MODULES-380).

- **`builder.html`'s code section is kazoku-ui's `<kazoku-embed-panel>`**, with the builder's own choices inside it: which planet's system and the body in the `picker` slot; the look, the sky and the turning in the `options` slot; the size is the panel's own (160, 240, 320, 480). Nothing it had is gone, and a test counts it: the twelve groups and ten bodies, the look, sky and turning rows, the seven tabs (HTML, ES module, React, Vue, Angular, Svelte, iframe), the four sizes, the picture made from the same choices (the picture now fits its box at every size), Copy (now "Copy code", in a button that can be read), Open the embed page and the credit line (which names NASA, USGS and JPL for the painted look and NASA for the Earth). Added by the panel: Read the docs, Home and End on the tabs.
- **`portrait.html`'s Share tab is the panel too**, with Save PNG, Save SVG and Copy link and their status line in the `actions` slot, and the credit line as before. It has `no-preview` and `no-size`: the portrait is the picture on the page, so the panel adds no second WebGL context and no frame loop. The tab and the code stay in the address as `?embed=`. A test counts the seven tabs, the code, Copy, the three actions, the embed page link, the docs link and the credit.
- `scripts/check-standard.mjs` is kazoku-ui 0.15's (it has the `embed-panel` item; this package passes).
- Guides (English and Japanese) say so. Tests: `e2e/builder.demo.ts` and `e2e/portrait.demo.ts` (desk and phone, Chromium and WebKit).

## 0.14.0 - 2026-11-04

The family's one "Put it in your page" panel, wakusei-planets first (KAZOKU-UI-40).

- **The demo's "Put it in your page" is kazoku-ui's `<kazoku-embed-panel>`** (kazoku-ui 0.15), filled with wakusei's own choices and code. Nothing it had is gone, and a test counts it: the body picker (tiles by group, planet and moon, in the panel's `picker` slot), the four sizes, the seven tabs (HTML, ES module, React, Vue, Angular, Svelte, iframe; the arrow keys, `?embed=`, `?size=`), the picture made from the same choices, Copy, Open the embed page, Read the docs and the credit line. What changed: the picture always fits its box (Venus was cut off on the right), Copy says "Copy code" in a button that can be read (MODULES-286), Home and End work on the tabs, and the panel is the same one every package of the family now gets.
- `embedCode` writes its seven tabs through kazoku-ui's `embedSnippet`; the text is unchanged (the package's tests build and parse every tab as before).
- `kazoku-ui` is `^0.15.1` (the panel asks for one animation frame at a time; the freeze test holds it). Tests: `e2e/embed-builder.demo.ts` (the code for each tab, the picture, Copy, the picker, "nothing is gone", the picture fits at every size; desk and phone, Chromium and WebKit).
- Left for a follow-up: the code panels of `builder.html` and `portrait.html` still use the earlier markup.

## 0.13.0 - 2026-11-04

The wheel zooms (KAZOKU-UI-45).

- **The portrait builder's wheel zooms the view.** In Manual, the wheel over the picture now zooms it about the pointer, whether the pointer is over a body or over empty space; before, the wheel over a body sized it and only Ctrl or Command with the wheel zoomed. **Shift and the wheel over a body sizes it** (pinching a body on a touch screen still sizes it). A sideways swipe is left to the page, and so is a wheel that starts with the view already at its closest or widest. The hint under the builder (English and Japanese) and the Portrait builder guide say so.
- The solar-system view's own controls are the family's `<kazoku-view-controls>`, where the plain wheel has zoomed since kazoku-ui 0.13; nothing changed there.

## 0.12.0 - 2026-11-03

The family's speed buttons, in the demo's two places that run time (KAZOKU-UI-46).

- **The date row's Speed is `<kazoku-speed-buttons>`**: `1 3600 86400`, read as multiples of real time (3600× is an hour a second, 86400× a day a second), in the same look as every other speed in the family. It replaces the page's own three buttons ("Real time", "1 hour a second", "1 day a second"); `?speed=` still keeps the choice.
- **Turn has its own speed buttons**: 0.5×, 1× and 2× of 14 degrees a second (the body's spin; a body that spins the other way, Venus and Uranus, turns the other way at the same speeds), shown while Turn is on and kept in the address as `?spinspeed=`. The controls' Auto-turn comes from kazoku-ui 0.14: under More, 0.5×, 1× and 2× instead of Slow, Medium and Fast.
- `kazoku-ui` is `^0.14.0` for the demo. Test: `e2e/speed.demo.ts` (desk and phone, Chromium and WebKit, with the config's reduced motion).

## 0.11.1 - 2026-11-03

The dwarf planets' realistic look is smooth when it is small (MODULES-332).

- **No more pixel-sized specks on a small body.** At about 80 px (the portrait builder) Ceres, Orcus, Quaoar, Makemake, Gonggong and Sedna showed square dark specks: the craters and the fine noise were finer than a pixel and were sampled anyway. The shader now knows how big a pixel is: an octave of noise finer than the pixel is replaced by its average, a crater smaller than about two pixels fades out, a crater's rim no longer starts with a step (which a pixel could not draw), and the bump-mapped relief, which is worked out from neighbouring pixels and cannot show a bump a few pixels wide, fades out on a small disc so the colour alone carries the craters. Compared at 64, 128 and 512 px, light and dark: soft craters at every size, the same look as before at 512. All the realistic bodies share the shader, so Mercury, the Moon and the rest are smoother when small too. Test: a realistic dwarf planet at 64, 80 and 128 px has under 0.4 in a thousand speck pixels (the old shader had 17 in a thousand at 64 px).
- **Ceres looks like Ceres in the realistic look** (it uses Dawn's map as the painted look does, with Occator's bright spots), not a generic cratered ball.
- **Triton's filled north is soft**: the unseen north of the map (a fill made by `scripts/make-textures.py`) took the dark ground at its edge and smeared it into blobs with a hard line at the seam; it now fades gradually from the real picture's colour to the map's mean, over a long smooth band.
## 0.11.0 - 2026-11-03

The drag rule, checked with the family's own check.

- **The surface follows the pointer, exactly** (MODULES-224): the demo tells the shared view controls the radius of the body's disc (`grab-radius`, kept up to date as the view is resized or scaled), so a drag of a few pixels moves the ground at the middle of the body by as many pixels, and the touched point stays under the pointer. New `discRadius` on `<wakusei-body>` (the disc's radius on the screen, in CSS pixels).
- **The check** is kazoku-ui's shared `e2e/ground.mjs` (copied unchanged from its `templates/e2e-ground.mjs`): in Mars (line, realistic and painted), Venus and the Moon a drag right moves the ground right, a drag up moves it up, the arrow keys agree and Auto-turn goes the right way; exact grab is checked in painted Mars and the Moon.
- **The documentation site is the family's of 2026-11-03** (MODULES-331): a seeded sample of its pages is read in the browser, and the guides show their pictures as real images (`![..](../images/..)`) instead of links, in English and Japanese.
- The freeze test that counts what the page keeps now counts after two rounds of changes, not one: on a slow runner the first round was still making the rows' pictures, so the count rose once and then stayed flat (24, 24, 24 with the processor slowed four times); a real leak would keep rising.
- **The Turn button goes the body's real way** (MODULES-203): Mars turns to the right and Venus, which turns backwards, to the left (it turned every body the same way before); a test per direction.

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
