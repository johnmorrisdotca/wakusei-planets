---
title: In a plain HTML page, from a CDN
section: how-to
order: 2
description: Add a planet to any page with one script tag from jsDelivr or unpkg, and a shaded one the same way.
---

A page with no build step loads the package from a CDN. Each snippet below was run in a browser by the package's tests, with the CDN's answers made from the built package.

## From jsDelivr

jsDelivr bundles the package and its dependencies into one module when an address ends in `/+esm`, so one tag is enough:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
  </head>
  <body>
    <wakusei-body body="saturn" look="line" size="320"></wakusei-body>
  </body>
</html>
```

## From unpkg

unpkg serves the package's own files, and `?module` turns the bare imports in them into unpkg addresses:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets from unpkg</title>
    <script type="module" src="https://unpkg.com/@johnmorrisdotca/wakusei-planets/dist/element.js?module"></script>
  </head>
  <body>
    <wakusei-body body="saturn" look="line" size="320"></wakusei-body>
  </body>
</html>
```

## A shaded body

The shaded looks are drawn with three.js, which jsDelivr's `/+esm` brings in too (it is an optional peer of the package, so a page of line drawings never loads it). Each body's shaded look is its own file, loaded beside the element:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>A shaded Jupiter from jsDelivr</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm"></script>
    <script type="module" src="https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/jupiter/+esm"></script>
  </head>
  <body>
    <wakusei-body body="jupiter" look="realistic" size="360"></wakusei-body>
  </body>
</html>
```

Many bodies on one page share one WebGL context: the one in focus is drawn live and the others show pictures. See [looks and bodies](looks-and-bodies.md).
