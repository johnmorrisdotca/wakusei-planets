---
title: Looks and bodies
section: how-to
order: 7
description: The looks, each body's own entry point, three.js, pictures and the budget that keeps the page light.
---

## The looks

- `line`: a clean outline drawing, an SVG string. It needs nothing else.
- `realistic`: the photo maps, lit from the Sun's side. `painted` is the same maps, kept so an older page still works. The demo's one button for them is Realistic.
- `illustrated`: the shaded drawing `realistic` used to be, worked out in the shader from the body's colours and features. It is not a default.
- `painted`: a real surface map, for the Sun, the planets from Mercury to Pluto, Ceres, the Moon, the four Galilean moons, Saturn's Mimas, Enceladus, Tethys, Dione, Rhea, Titan and Iapetus, Triton and Charon; Saturn's rings come from a Cassini picture of them. A small picture is drawn first and a sharper one is fetched when the view is zoomed in; if a picture cannot be fetched the shaded look stays. NOTICE.md names each map.

![Saturn in the painted look, with its rings from a Cassini picture.](../images/hero-saturn-painted.png)

![The Earth in the painted look, from NASA's Blue Marble picture.](../images/hero-earth-painted.png)

![Io in the painted look, one of the fourteen painted moons.](../images/hero-io-painted.png)

![Venus in the realistic look, from its cloud map.](../images/hero-venus-realistic.png)

## Each body is its own entry point

A shaded look is code and data for one body, so each has its own import: `@johnmorrisdotca/wakusei-planets/saturn`, and `/moons-jupiter` for the Galilean moons. `/all` imports every one. A body whose entry has not been imported is drawn as a plain lit ball in its colour.

## The Earth

The Earth is drawn like every other body. Its realistic and painted looks are NASA's Blue Marble picture, lit and turned like the rest, with a rim of air (a shaded Earth cannot honestly be worked out from numbers, so both looks use the picture); `/all` includes it. They share the page's one WebGL context and have stills in a row of bodies. Its line look is this package's own outline unless the page also has [chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth)'s globe with the countries. For that, install `@johnmorrisdotca/chikyu-earth` (an optional peer, 0.10.0 or later) and import its element beside `/earth`:

```js no-check
import "@johnmorrisdotca/chikyu-earth/element";
import "@johnmorrisdotca/wakusei-planets/earth";
```

`/earth` never imports chikyu-earth itself, so a project without it builds and draws the outline; when chikyu-earth's element arrives later on the page, the Earth switches to its globe.

## The dwarf planets

Besides Pluto: `ceres`, `orcus`, `haumea`, `quaoar`, `makemake`, `gonggong`, `eris` and `sedna`, in every look. They are put where they are from JPL's osculating elements of June 2026 (good for a few years either side), their sizes are from the papers NOTICE.md lists, Haumea (1161 x 852 x 513 km, turning every 3.9 hours) and Quaoar are drawn as the long shapes they are, and only Ceres has a painted map (Dawn's), which its realistic look draws too, so Ceres looks like Ceres, with the bright spots of Occator crater, in every look. The surface of the others is drawn from their published colours, so it is an estimate, and where a pole has not been measured it is taken along the orbit's pole: NOTICE.md says which. The moons Weywot, Xiangliu and S/2015 (136472) 1 are not drawn because no orbit with a published phase exists.

## The minor bodies

Five more, each with its own name for `body` in every look: the asteroids `vesta` and `pallas`, the centaurs `chiron` and `pholus` (small icy bodies between Jupiter and Neptune) and Halley's comet, `halley`. Their kind is `asteroid`, `centaur` or `comet` (`BODIES.vesta.kind`, `MINOR_IDS` lists them). Each is put where JPL Horizons has it on a fitted table, within an arc-second (the accuracy guide has the table); sizes, poles and spins are the Small-Body Database's, with the sources in NOTICE.md. Vesta (569 x 554 x 453 km, turning every 5.3 hours) is the long shape Dawn measured and has Dawn's own photomap as its painted look, which its realistic look draws too. Pallas is on its side (tipped 84 degrees) and the long shape its published sizes give. Nobody has photographed Chiron or Pholus as more than a point of light, and Halley's nucleus was photographed by a probe whose pictures this package may not use, so those three are drawn from their numbers (a rock of the right size, shape and colour with invented craters), and NOTICE.md says so. Where a pole has not been measured (Chiron, Pholus, Halley) the spin axis is taken along the orbit's pole, and Halley, whose nucleus tumbles, is drawn still. `?body=vesta` opens the demo on Vesta.

## The moons

Every moon has its own name for `body`, in every look and in the demo's row of moons: Mars: `phobos`, `deimos`. Jupiter: `io`, `europa`, `ganymede`, `callisto`. Saturn: `mimas`, `enceladus`, `tethys`, `dione`, `rhea`, `titan`, `iapetus`. Uranus: `miranda`, `ariel`, `umbriel`, `titania`, `oberon`. Neptune: `proteus`, `triton`, `nereid`. Pluto: `charon`, `nix`, `hydra`. Orcus: `vanth`. Haumea: `hiiaka`, `namaka`. Eris: `dysnomia`. The Earth's is `moon`. `?body=io` opens the demo on Io.

## One WebGL context, drawn on demand

Every shaded body on a page shares one WebGL context through kazoku-ui's shared renderer. The body in focus is live and the others show pictures: set `live="hover"` to give the context to whichever one the reader points at, `live="off"` for pictures only. Nothing is drawn while nothing changes, no animation frame is asked for while the page is at rest, a moving picture is drawn at most thirty times a second, the canvas is held to 4096 pixels a side and six million pixels, and everything is freed when the element leaves. A body that is out of sight or in a hidden tab is not drawn, and a lost WebGL context comes back by itself.

## Real sizes

`scale-to="jupiter"` draws a body at its real size relative to Jupiter. The body's `radiusKm`, `tiltDeg` and `rotationHours` are in `BODIES`.
