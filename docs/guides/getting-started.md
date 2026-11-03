---
title: Getting started
section: tutorial
order: 1
description: Put a planet on a page, tilt it, and let the reader turn it, in about five minutes.
---

This guide puts Saturn on a page and lets the reader turn, tip and zoom it. You need a text editor and a browser. Nothing is installed: the page loads the package from a CDN.

Picture: [The documentation site: a search box, the entry points, the guides in sections and every export with its example.](https://raw.githubusercontent.com/johnmorrisdotca/wakusei-planets/main/docs/images/docs-site.png)

## 1. A page with a planet

Save this as `saturn.html` and open it. The `<wakusei-body>` tag is the body; the script above it makes the tag work.

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

`body` is the name of the body (`sun`, `mercury`, `venus`, `earth`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`, the dwarf planets `ceres`, `orcus`, `haumea`, `quaoar`, `makemake`, `gonggong`, `eris` and `sedna`, `moon` and the moons of the planets). `look="line"` is a clean outline drawing, an SVG that needs nothing else. The disc leans at Saturn's own axial tilt, 26.73 degrees, and the rings are open as a viewer above the north pole would see them. `size` is the width in pixels.

## 2. Let the reader turn it

The package draws; the shared [kazoku-ui](https://github.com/johnmorrisdotca/kazoku-ui) view controls supply every hand and button: drag to turn, tilt, zoom, pinch, pan and Fit. Add them, and pass what they say to the body with one listener:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wakusei Planets with the shared controls</title>
    <script type="module">
      import "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/kazoku-ui/view-controls/define/+esm";
      import "https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets/element/+esm";

      const body = document.querySelector("wakusei-body");
      document.querySelector("kazoku-view-controls").addEventListener("kazoku-viewchange", (event) => {
        body.setView(event.detail);
      });
    </script>
  </head>
  <body>
    <div id="view" tabindex="0">
      <wakusei-body body="saturn" look="line" size="420"></wakusei-body>
    </div>
    <kazoku-view-controls for="view" address controls="advanced" tilt-max="90" speed="0"></kazoku-view-controls>
  </body>
</html>
```

`setView(view)` takes the controls' camera: `yaw` turns the body about its own pole, `tilt` tips the pole toward or away from you, and `zoom` and the pan move the picture. A line drawing is redrawn at once; a shaded one is drawn again by the shared renderer, at most thirty times a second and only while it moves. The surface under the pointer follows the pointer, so a drag moves the ground the way the hand goes; to make the touched point stay under the pointer, give the controls the disc's radius in pixels: `controls.setAttribute("grab-radius", String(Math.round(body.discRadius)))` (`discRadius` is the radius of the body's disc on the screen, which changes with the size of the element and with `scale-to`).

## 3. Where next

- Shade it, from the real colours and features: [looks and bodies](looks-and-bodies.md).
- Show a planet's moons where they are on a date: [moons and time](moons-and-time.md).
- Use it from a bundler or a framework: [bundlers](bundlers.md) and [frameworks](frameworks.md).
- Show it in someone else's page without a script of your own: [embed in an iframe](embed-in-an-iframe.md).
- Draw it on a server, or with types: [TypeScript and Node](typescript-and-node.md).
- Something does not appear: [troubleshooting](troubleshooting.md).
