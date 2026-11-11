---
title: A name on the body
section: how-to
order: 7
description: Write a body's name on its own globe, like a title laid over the thing it names, turning with it or facing you, in four looks, once or all round, at the equator or near a pole, in the page's language and font.
---

`body-label="painted"` on `<wakusei-body>` or `<wakusei-space>` writes the body's name on its globe in the shaded looks: large letters that lie on the surface, let the surface show through, and turn with the body, as a film puts a title over the thing it names. It is off by default (the name beside a body stays), and it draws nothing on a body too small on the screen. The drawing is the family's, `@johnmorrisdotca/kazoku-ui/body-label`, so a name on the Earth here and on chikyu-earth's Earth look the same.

```html
<wakusei-body body="mars" look="realistic" body-label="painted"></wakusei-body>

<wakusei-space time="2026-11-02T14:00Z" body-label="etched" body-label-repeat="both" lang="ja"></wakusei-space>
```

The default when it is on is John's pick: **Michroma, painted, at half strength, the name once, on the equator, turning with the body**.

## The attributes

The names are the family's standard, the same on both elements and on chikyu-earth:

| Attribute | Value |
|---|---|
| `body-label` | the look: `painted` (pale letters over the surface), `etched` (the letters lighten the surface), `outline` (only the letters' edges) or `burned` (darker letters). Absent, or anything else: no name on the body. |
| `body-label-strength` | how strongly it shows, 0 to 1; `0.5` by default |
| `body-label-repeat` | `once` (the default), `both` (two, on opposite sides, so one is always in view while the body turns) or `around` (as many as fit all round) |
| `body-label-latitude` | the band's latitude in degrees: `0` (the default) is the equator, `55` or `-55` a band near the north or the south pole; within 70 of the equator |
| `body-label-facing` | present: the name keeps facing you while the body turns under it |
| `body-label-font` | a CSS font family your page has loaded, instead of Michroma |
| `body-label-fallback-font` | the family for letters the font has none of, such as Japanese (`"Noto Sans JP"`) |

The property `bodyLabel` takes the same as one object (`space.bodyLabel = { look: "painted", strength: 0.5, repeat: "once", latitude: 0, facing: false, font: "Michroma", fallbackFont: "" }`), and `null` for none; set, it takes the place of the attributes (`readNameLabel(el)` from `/painter` is what the element reads them with).

## The text

The text is the body's own name in the element's `lang`: `EARTH` in capitals in English, `地球` in Japanese. Michroma has Latin letters only, so Japanese is drawn in `body-label-fallback-font`, else the page's sans. A page that draws through the painter itself (`painter.make(three, "Mars", { label: { look: "painted", text: "HOME" } })`) may give any text.

## The font

Michroma (Vernon Adams, SIL Open Font License 1.1) is fetched once, 64 kB, from kazoku-ui's own copy, the first time a name is written in it, and never when `body-label-font` names a font of your own. Until it is in, nothing is drawn; the view draws itself again when the name is ready. The label looks for the file next to kazoku-ui's module (`fonts/Michroma-Regular.ttf`); a bundler that does not carry the file along tells the label where it put it with `setBodyLabelFontUrl("/fonts/Michroma-Regular.ttf")` from `/painter`, before the first name is written. `NOTICE.md` has the licence.

## The rules

- The name is lit as the body is: by the Sun, so a name on the night side is dark too (`light="lit"` on the space view lights it from your side, like the bodies).
- A body drawn smaller than 24 CSS pixels in radius carries no name (`minRadiusPx` in `bodyLabel`), so the dwarf planets from afar, the small moons and the whole solar system are left plain, and a name comes as you zoom in. Saturn's rings sit outside the band; the Sun's name is drawn on its disc, fully lit.
- A name written once is on the far side half the time: `body-label-repeat="both"` keeps one in view, or `body-label-facing` keeps it turned to you.
- Nothing is redrawn at rest, and a change of setting redraws the one texture the name is written on. `pnpm test:freeze` covers it.
- `stats.label` on `<wakusei-body>`, and `stats.bodyLabels` on `<wakusei-space>` (how many are drawn and the one on the body looked at), say what is drawn now: its text, and its turn about the pole when it faces you.

## In your own scene

Through the painter, the label is `label` in the context `make` takes, and `setLabel` on the painting changes or removes it later; `painting.label` reads what is written. The painter lights the name with the same direction it lights the body, so no three.js light is needed. A page that hands over a subset of three.js (`setThreeLoader`) adds `CanvasTexture`, `SRGBColorSpace` and `NormalBlending` to it for the name to be drawn; without them the body is drawn without its name, with one warning in the console.

```ts no-run
import * as THREE from "three";
import { painter } from "@johnmorrisdotca/wakusei-planets/painter";

const mars = painter.make(THREE, "Mars", { look: "painted", label: { look: "painted", lang: "en" } });
mars.setLabel({ look: "etched", repeat: "both", strength: 0.8 });
console.log(mars.label?.text);
```
