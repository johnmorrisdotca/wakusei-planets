---
title: Colouring sheets for children
section: how-to
order: 20
description: Printable colouring sheets of the Sun, the planets and the big moons, with thick lines, the real colours and three facts, on A4 or US Letter, in English and Japanese, and the ready-made PDFs.
---

`/sheets` makes one printable sheet for each of the Sun, the eight planets, Pluto, the Moon, Io, Europa, Ganymede, Callisto, Titan, Triton and Charon, and one sheet with all the planets in a row at one scale. A sheet is for a child who colours: a big picture in thick black lines (the outline 3 mm, every line inside 2.5 mm), a row of squares in the body's real colours with their names, and three facts in large type. The picture is drawn from the package's own numbers (sizes, tilt, rings, features), never traced or copied, and the facts are worked out from the same numbers.

The page around the picture (the header with the brand "Space Program X", the package and the title and a "Name:" box, and the footer with the credits, the version, the date and a QR code back to the demo) is kazoku-ui's print part, in its `kid` type: names 28 pt, body 18 pt, lines 3 mm.

## The ready-made PDFs

Every sheet is a PDF on A4 and on US Letter, in English and in Japanese, built in CI from the demo and published with it: [the English list](https://johnmorrisdotca.github.io/wakusei-planets/pdf/) and [the Japanese list](https://johnmorrisdotca.github.io/wakusei-planets/pdf/ja.html). Each is one page.

## The demo

[The colouring sheets page](https://johnmorrisdotca.github.io/wakusei-planets/kids.html) shows a sheet as it prints. Pick the body (or all the planets) and the paper, then press Print / save PDF: the browser's print window saves a PDF too, so there is no PDF library. The page's language (the language button in the header) is the sheet's.

## In your own page

```ts
import { KIDS_SHEETS, kidsFacts, kidsRoom, kidsSvg } from "@johnmorrisdotca/wakusei-planets/sheets";

console.log(KIDS_SHEETS.length, "sheets:", KIDS_SHEETS.slice(0, 4).join(", "), "...");
console.log(kidsFacts("saturn", "en").join(" "));

const room = kidsRoom("letter");
const svg = kidsSvg("saturn", { ...room, lang: "ja" });
console.log(svg.length > 1000, svg.includes("ぬってね！"));
```

`kidsSvg(id, { widthMm, heightMm, lang })` is the sheet's one SVG, measured in millimetres, so a millimetre of the picture is a millimetre of the paper. It needs no browser. `kidsRoom(page, orientation)` is the room the page's body has, estimated for A4 and Letter.

To print, build the whole page with `kidsSheet`, which measures the room the page really has (the sheet is laid out out of sight for a moment) so the picture is drawn at the size it prints:

```ts no-run
import { printCss, printSheet } from "@johnmorrisdotca/kazoku-ui/print";
import { kidsLayout, kidsSheet } from "@johnmorrisdotca/wakusei-planets/sheets";

const options = { page: "letter", language: "en" } as const;
const style = document.createElement("style");
style.textContent = printCss(kidsLayout("mars", options));
document.head.append(style);

const sheet = kidsSheet("mars", options);
document.body.append(sheet);
document.querySelector("#print")?.addEventListener("click", () => printSheet(sheet));
```

`kidsLayout` gives `printCss` the paper, the turn (the lineup is printed on its side) and the type. `page` is `a4`, `letter`, `a3` or `tabloid`.

## What is on a sheet

- **The picture.** The body's outline and its big features: bands (Jupiter, Saturn, Neptune), dark regions (Moon, Mars), craters, cracks (Europa), the Earth's lands, Pluto's heart, Saturn's rings and Uranus's. A feature too small to colour is made bigger or left out, and two never overlap. The Sun has its rays.
- **Colour me!** Two to four squares of the body's real colours, each with its name.
- **Three facts.** A planet: how wide it is and how that compares with Earth, how long it takes to spin, how long it takes to go round the Sun. A moon: how wide, how long it takes to go round its planet, the face it shows. The Sun: how wide, how long it takes to spin, how far away it is. Widths are three figures; the years come from the size of the orbit (Kepler's third law).
- **The lineup.** The eight planets in a row at one scale, each with a number under it, the names in order below, and three facts, one of them how wide the Sun would be at this scale.

The Japanese is plain and mostly hiragana, with the kanji of a name in brackets after its reading.

## Tested

The sheets are tested without a browser (every sheet on every paper in both languages, the line widths, the facts against the numbers, the text against the room, the lineup's scale) and in Chromium and WebKit (the page, the print copy, the picture drawn at the size it prints). In Chromium every sheet is also printed to a PDF on A4, Letter, A3 and Tabloid and the PDF is read for its paper size and its page count: one page each.
