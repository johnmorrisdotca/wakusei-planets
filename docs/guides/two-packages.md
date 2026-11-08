---
title: Why two packages
section: explanation
order: 8
description: What wakusei-planets does and what chikyu-earth does, which one to install, and how they work alone and together.
---

The Sun, the planets and their moons are here, in wakusei-planets. The Earth as a place to live is in [chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth): its countries, day and night, city lights, clouds, markers for places, and the satellites going round it. Each package works on its own, and they fit together when a page wants both.

## The rule

- **chikyu-earth is for someone who cares about the Earth only.** Everything that is about the Earth in detail lives there.
- **wakusei-planets is for any other body, and for the solar system.** The Sun, the eight planets, the dwarf planets, the moons, where each one is on a date, and the space between them. The Earth is here too, as one body among the others: its size, its tilt, its turn, its place on its orbit and a picture of it from space.
- **The dependency runs one way.** wakusei-planets may use chikyu-earth (an optional peer), and chikyu-earth never needs wakusei-planets.

The test for where a new feature goes: would someone install only one of the two packages and still want it? A map of the world's countries is wanted by people who never think about Jupiter, so it is chikyu-earth's. Where Mars is tonight is wanted by people who never draw a country, so it is wakusei-planets'.

## What lives where

| You want | Package |
|---|---|
| A globe with the countries, turning at the Earth's own rate | chikyu-earth |
| Day and night on the Earth, city lights, clouds | chikyu-earth |
| Markers for places, a ride over the Earth | chikyu-earth |
| Satellites: the space stations and Starlink round the Earth | chikyu-earth |
| The Sun, the planets, the dwarf planets and the moons, in three looks | wakusei-planets |
| Where each body is on a date, its pole, its phase, its rings | wakusei-planets |
| The Sun and the Moon from a place: sunrise, moonrise, phases (`/suncalc`) | wakusei-planets |
| Time scales, calendars and sidereal time (`/time`) | wakusei-planets |
| The Earth as one planet among the others, in the same looks | wakusei-planets |
| The solar system as a scene you fly through | moving here from chikyu-earth's space view |

## Using only wakusei-planets

Everything in this package works without chikyu-earth. The Earth is drawn like every other body: its realistic and painted looks are NASA's Blue Marble picture, and its line look is this package's own outline.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/earth/+esm"></script>
<wakusei-body body="earth" look="realistic"></wakusei-body>
```

With a bundler, `npm install @johnmorrisdotca/wakusei-planets` is all. npm and pnpm do not install an optional peer, and nothing here imports chikyu-earth, so the build never asks for it (a check in `pnpm test:usage` bundles `/earth` with chikyu-earth missing and draws it).

## Using only chikyu-earth

Install `@johnmorrisdotca/chikyu-earth` alone for the Earth in detail. It does not import this package. Its own README and guides cover it.

## Using them together

Install both:

```sh
npm install @johnmorrisdotca/wakusei-planets @johnmorrisdotca/chikyu-earth
```

- **The Earth's line look becomes chikyu-earth's globe with the countries.** Import chikyu-earth's element beside `/earth`, and every `<wakusei-body body="earth" look="line">` on the page draws it. Without that import the line Earth is this package's outline; if the element arrives later, the Earth switches to it.

```js no-check
import "@johnmorrisdotca/chikyu-earth/element";
import "@johnmorrisdotca/wakusei-planets/element";
import "@johnmorrisdotca/wakusei-planets/earth";
```

- **The realistic and painted Earth stay this package's**, so the Earth looks like the other planets beside it.
- **One WebGL context for the page.** Both packages draw through kazoku-ui's shared renderer, so a page with a planet and a globe still has one context and one budget.
- **The space view.** Today chikyu-earth's `<chikyu-space>` draws the Sun and the planets with this package's painter (`setBodyPainter`; chikyu-earth's guide "The real Sun, planets, Pluto and moons"). That view is moving into this package so the solar system lives in one place; when it lands, this guide and the upgrading notes say how to switch, and chikyu-earth keeps the Earth and its satellites.

## Why not one package

A page about a city's sunrise, a school page about Saturn's rings or a chart of tonight's sky should not download the world's country outlines and a satellite propagator, and a map of countries should not download the planets' theories. Two packages keep each one small for the people who want only it, and the shared parts (the renderer, the view controls, the theme and language) come from kazoku-ui, so using both costs no more than each alone.
