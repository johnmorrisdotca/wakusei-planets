# Changelog

## Unreleased

## 0.1.0

The first release. The package, to the family's standard from the start: a demo and an embed page on GitHub Pages, a documentation site in English and Japanese, a README with every way to use it (each one tested), the shared release workflow with its freeze test.

- Line drawings, as SVG strings and as `<wakusei-body look="line">`, of the Sun, Mercury, Venus, Mars, Jupiter, Saturn (with its rings), Uranus (with its rings), Neptune and Pluto, and of the Moon, Phobos and Deimos, the Galilean moons, Saturn's seven larger moons, Uranus's five, Neptune's Proteus, Triton and Nereid, and Pluto's Charon, Nix and Hydra: real relative sizes, axial tilt and rotation as data.
- The Earth, through a thin adapter over chikyu-earth's own globe (`/earth`, chikyu-earth an optional peer): its line globe, and its Earth from space when the body is live. No second copy.
- Shaded realistic drawings with three.js through kazoku-ui's shared renderer, each body its own optional entry point: bands, spots, craters, caps and the Pluto heart worked out in a shader, rings that cast shadows, the Sun's glow.
- The sky for a date and time: a body's pole, rotation, phase and ring opening as the Earth sees it, and a planet's moons on their orbits where they are then (JPL elements, Meeus for the Moon), worked out about once a second and carried forward between.
- One WebGL context per page, nothing drawn at rest, thirty frames a second at most, canvas within 4096 pixels a side and 6 MP, everything freed, no drawing out of sight, reduced motion respected, a lost context recovers; tested by `pnpm test:freeze` and a soak.
