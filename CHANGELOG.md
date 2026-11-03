# Changelog

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
