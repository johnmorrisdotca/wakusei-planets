---
title: Troubleshooting
section: troubleshooting
order: 10
description: What to check when a body does not appear, looks plain or sits still.
---

## Nothing appears

Open the console. A line drawing needs only the element's script. Check that the tag is `<wakusei-body>` (not `wakusei-planets`) and that `body` is one of the names in `BODIES`.

## The shaded look is a plain ball

The body's entry point was not imported. Import `@johnmorrisdotca/wakusei-planets/jupiter` (or `/all`) beside the element.

## It shows the line drawing when I asked for shaded

The browser gave no WebGL. The element says so with its `data-state="unavailable"` and keeps the line drawing.

## It does not move

By design. A picture is drawn only when something changes. Give it `turn="12"` or a `rate`, or the reader's controls. A reader who prefers reduced motion gets no movement on its own.

## Two shaded bodies, one is a picture

One WebGL context serves the page. The body in focus is live. Use `live="hover"` to give it to the one the reader points at.

## three.js does not load from a CDN page

Use jsDelivr's `/+esm` addresses, or an import map for `three`.
