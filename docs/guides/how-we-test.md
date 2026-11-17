---
title: How we test
section: explanation
order: 13
description: "What each check measures and against what: unit tests with a coverage floor, the browser, freeze and soak, Horizons, usage, the docs examples and the size budget."
---

Each check below says what it measures and what it measures it against. A check that fails stops the change; none of them is advisory.

## Unit tests and the coverage floor

`pnpm test` runs `test/*.test.ts` with Node's own test runner: the maths, the data tables, the pure entry points and the elements' logic, with no browser. `pnpm test:coverage` runs the same tests with Node's built-in coverage over `src/` and fails when a figure is under its floor. `pnpm check` runs it, and CI runs `pnpm check`.

The floors are set just under what was measured on 2026-11-17 (96.28 per cent of lines, 93.48 of branches, 95.86 of functions): **96 lines, 93 branches, 95 functions**. They live in the `test:coverage` script in `package.json`. A floor only goes up: when a change raises a figure by a whole point, raise the floor in the same change; never lower one to let a change through.

## The browser: the demo and the docs site

`pnpm test:demo` builds the demo and the docs site and plays Playwright tests in a real browser: Chromium and WebKit, at a desk's and at a phone's width. They check what a person sees and presses: the pictures draw, the controls work, the pages link to each other.

## Freeze and soak

`pnpm test:freeze` loads each page that draws WebGL or a canvas and checks that it stops: no draw at rest, none when out of sight or in a hidden tab, and a canvas or graphics object that stays inside its budget. `pnpm test:soak` runs a page for a minute (`SOAK_MINUTES` sets it) and checks that memory and objects do not grow.

## Accuracy against Horizons

The positions are measured against NASA's JPL Horizons: the tests under `test/` hold every planet, the Moon and every moon, the comets, the asteroids and the close approaches to a stated distance from Horizons' answer, and fail when one is further away. The numbers are in [Accuracy](accuracy.md).

## Usage

`pnpm test:usage` builds each way of using the package that the README and the guides show (a script tag, a bundler, React, Vue, Svelte, Angular, an iframe) and opens it in a browser. A way that stops working fails here.

## The docs examples

`pnpm docs:check` type-checks every TypeScript example in the docs and the doc comments against the built package, runs each one in Node, and fails on a broken link or front matter.

## The size budget

`pnpm size:budget` bundles and minifies each published entry point as a reader's bundler would, gzips it and compares the bytes with `scripts/size-baseline.json`. An entry fails when it grows by more than **5 per cent** and more than 256 bytes over its baseline, when it has no baseline, or when its baseline names an entry that is gone. `pnpm check` runs it after the build.

A growth you mean is recorded on purpose: run `pnpm size:budget:update`, commit the new `scripts/size-baseline.json` with the change that grew it, and say why in the changelog.
