<h1 align="center">Wakusei Planets <sub>惑星</sub></h1>

<p align="center"><strong>The Sun, the planets and their moons, for the web.</strong><br>
A clean line drawing, a shaded realistic drawing, or a painted surface map, with each body's real size, axial tilt and rotation as data, and a planet's moons where they are at any date and time.</p>

<p align="center">
  <a href="https://github.com/johnmorrisdotca/wakusei-planets/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/johnmorrisdotca/wakusei-planets/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-2f5d4a"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/types-TypeScript-3178c6">
</p>

<p align="center"><a href="https://johnmorrisdotca.github.io/wakusei-planets/"><strong>Open the demo →</strong></a> · <a href="https://johnmorrisdotca.github.io/wakusei-planets/embed.html">Embed page</a> · <a href="https://johnmorrisdotca.github.io/wakusei-planets/docs/">Docs</a></p>

<p align="center"><img alt="Jupiter and Saturn drawn in the realistic look, and Saturn as a line drawing" src="docs/images/hero-desk.png" width="640"></p>

## One minute

```sh
npm install @johnmorrisdotca/wakusei-planets
```

A page with no build step needs one tag. `look="line"` is an SVG and needs nothing else:

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

The same tag with the shared [kazoku-ui](https://github.com/johnmorrisdotca/kazoku-ui) controls, which turn, tip, zoom and pan the body:

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

A bundled app imports it: `import "@johnmorrisdotca/wakusei-planets/element"` (and `import { lineSvg } from "@johnmorrisdotca/wakusei-planets"` for the SVG string, which needs no browser). For the shaded look add the body's own entry point, `import "@johnmorrisdotca/wakusei-planets/jupiter"`, and `three` (an optional peer).

## Three looks

| Look | What it is | Needs |
|---|---|---|
| `line` | A clean outline drawing with the body's key features: bands, craters, rings and their gaps, caps, the dark side dashed off. An SVG. | nothing |
| `realistic` | A shaded sphere drawn from the body's real colours and features, lit from the Sun's side, with the rings casting shadows. No pictures: the surface is worked out in a shader. | `three`, the body's entry point |
| `painted` | A real surface map from public-domain NASA, USGS and JPL imagery. Small pictures first (1.31 MB for all of them in the package), a sharper one fetched when you zoom in. | `three`, the body's entry point |

Every body has its real size relative to the others (`scale-to="jupiter"`), its axial tilt and its rotation. The Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto are drawn, and so are 25 moons (the Moon, Phobos and Deimos, the four Galilean moons, Saturn's seven larger moons, Uranus's five, Proteus, Triton and Nereid, Charon, Nix and Hydra). The Earth is [chikyu-earth](https://github.com/johnmorrisdotca/chikyu-earth)'s own globe, not a second copy: `import "@johnmorrisdotca/wakusei-planets/earth"` (it needs `@johnmorrisdotca/chikyu-earth` installed). The painted looks cover the Sun, the planets from Mercury to Pluto, the Moon, the four Galilean moons, Titan, Rhea, Enceladus and Mimas, and Saturn's rings are Cassini's own picture of them.

## As the Earth sees it

Give a body a `time` and it is drawn as the sky shows it then: its pole and rotation, how far the rings are open (Saturn's rings are edge-on in March 2025), the phase of the Moon or Venus, the Sun's direction.

```html
<wakusei-body body="saturn" look="realistic" time="2026-11-02T12:00:00Z"></wakusei-body>
```

## Every way to use it

| How | Where |
|---|---|
| A script tag from jsDelivr or unpkg, a shaded body from a CDN | [CDN guide](docs/guides/html-and-cdn.md) |
| An ES module in Vite or webpack, only the bodies you need | [bundlers guide](docs/guides/bundlers.md) |
| React, Vue, Svelte, Angular; Next.js, Nuxt, SvelteKit | [frameworks guide](docs/guides/frameworks.md) |
| An `<iframe>` of the embed page, no script of your own | [iframe guide](docs/guides/embed-in-an-iframe.md) |
| TypeScript types, an SVG string on a server, Node | [TypeScript and Node guide](docs/guides/typescript-and-node.md) |
| The looks, the entry points, one WebGL context | [looks and bodies](docs/guides/looks-and-bodies.md) |
| Moons where they are on a date, time that runs fast | [moons and time](docs/guides/moons-and-time.md) |
| Something does not appear | [troubleshooting](docs/guides/troubleshooting.md) |

The guides are also in Japanese (日本語), one language to a page: [docs/guides/ja/](docs/guides/ja/getting-started.md).

In React, with the browser-only import where a server render never reaches it:

```tsx
import { useEffect } from "react";

export function WakuseiBody({ body = "saturn", look = "line" }: { body?: string; look?: "line" | "realistic" }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/element");
    void import("@johnmorrisdotca/wakusei-planets/all");
  }, []);
  return <wakusei-body body={body} look={look} />;
}
```

Vue, Svelte and Angular components, the Vite and webpack setups and an `<iframe>` are in the guides, each one built and opened in a browser by `pnpm test:usage`.

## Light by design

A page full of bodies stays light: one WebGL context for the page through kazoku-ui's shared renderer (the body in focus is live, the others are pictures), nothing drawn while nothing changes, at most thirty frames a second while it moves, a canvas held to 4096 pixels a side and six million pixels, everything freed when an element leaves, no drawing out of sight or in a hidden tab, no movement for a reader who prefers reduced motion, and a lost WebGL context coming back by itself. The tests count draws, animation frames, contexts and GPU objects at rest and over many changes (`pnpm test:freeze`, and a soak with `pnpm test:soak`).

## The element

| Attribute | What it does | Default |
| --- | --- | --- |
| `body` | The body's name. | `earth` |
| `look` | `line`, `realistic` or `painted`. | `line` |
| `size` | The width in pixels. | `320` |
| `time` | `now` or an ISO date: the body as the Earth sees it then. Left out, a portrait. | portrait |
| `moons` | A planet with its moons on their orbits (with a date). | off |
| `rate` | Simulated seconds for each real second. | `1` |
| `turn` | A portrait turns this many degrees a second. | `0` |
| `tilt`, `pitch`, `phase`, `meridian` | A portrait's pose in degrees. | the body's own |
| `scale-to` | Draw to scale with another body. | fills its box |
| `live` | `always`, `hover` or `off`: when a shaded body takes the page's one WebGL context. | `always` |
| `lang` | `en` or `ja` for names and labels. | `en` |

The pure side has no DOM: `BODIES`, `apparent(id, time)`, `system(planet, time)`, `orbitPath`, `portrait` and `lineSvg(id, options)`.

## The data

Sizes, flattening, poles and rotation are the IAU's and NASA's; planet positions are JPL's approximate elements; the Moon's are Meeus's largest terms; the other moons are JPL's mean elements. Nothing is fetched at run time by the line and shaded looks, which use no pictures. See [NOTICE.md](NOTICE.md).

## The name

Wakusei (惑星, わくせい) is Japanese for a planet.

## The family

<!-- family:start (made by scripts/family-readme.mjs from scripts/family-template.mjs; change those, not this) -->
Wakusei Planets is one of thirty-four packages, each made for the same site, each at
[github.com/johnmorrisdotca](https://github.com/johnmorrisdotca) or [github.com/spxis](https://github.com/spxis). The code of every one is MIT.

**Games — board**

- [Domino](https://github.com/johnmorrisdotca/domino) (ドミノ): dominoes and Mexican Train. [Demo](https://johnmorrisdotca.github.io/domino/).
- [Gunjin](https://github.com/johnmorrisdotca/gunjin) (軍人): five hidden-rank strategy games with pass-the-device play. [Demo](https://johnmorrisdotca.github.io/gunjin/).
- [Narabe](https://github.com/johnmorrisdotca/narabe) (並べ): one rules engine for abstract board games, from gomoku and Reversi to Go and checkers. [Demo](https://johnmorrisdotca.github.io/narabe/).
- [Sugoroku](https://github.com/johnmorrisdotca/sugoroku) (双六): backgammon and its variants, with the doubling cube and match play. [Demo](https://johnmorrisdotca.github.io/sugoroku/).
- [Tenka](https://github.com/johnmorrisdotca/tenka) (天下): world conquest for two to six, on a map of the real world. [Demo](https://johnmorrisdotca.github.io/tenka/).

**Games — cards & tiles**

- [Hitotsu](https://github.com/johnmorrisdotca/hitotsu) (一つ): a colour-card shedding game for two to eight, with the house rules people play. [Demo](https://johnmorrisdotca.github.io/hitotsu/).
- [Jarajara](https://github.com/johnmorrisdotca/jarajara) (ジャラジャラ): mahjong tiles drawn as SVG, stacked layouts, and the matching solitaire Awase. [Demo](https://johnmorrisdotca.github.io/jarajara/).
- [Kumimoji](https://github.com/johnmorrisdotca/kumimoji) (組み文字): a crossword tile race, in English and Japanese kana. [Demo](https://johnmorrisdotca.github.io/kumimoji/).
- [Toranpu](https://github.com/johnmorrisdotca/toranpu) (トランプ): a deck of playing cards, card games with computer players, and solitaires. [Demo](https://johnmorrisdotca.github.io/toranpu/).

**Games — puzzles**

- [Houseki](https://github.com/johnmorrisdotca/houseki) (宝石): gem and stone matching puzzles: falling triplets, stone collapse, colour chains and gem swap. [Demo](https://johnmorrisdotca.github.io/houseki/).
- [Jirai](https://github.com/johnmorrisdotca/jirai) (地雷): minesweeper on shaped grids with verified no-guess boards. [Demo](https://johnmorrisdotca.github.io/jirai/).
- [Karakuri](https://github.com/johnmorrisdotca/karakuri) (からくり): eight hyper-casual puzzle games, some of them physics: draw a shield, pull pins, cut ropes, slide blocks, pour tubes. [Demo](https://johnmorrisdotca.github.io/karakuri/).
- [Kazu](https://github.com/johnmorrisdotca/kazu) (数): grid number puzzles: Sudoku and its variants, Futoshiki and Skyscrapers. [Demo](https://johnmorrisdotca.github.io/kazu/).
- [Kyuubu](https://github.com/johnmorrisdotca/kyuubu) (キューブ): a turning cube for the browser, 2×2 to 7×7, with record solves to replay. [Demo](https://johnmorrisdotca.github.io/kyuubu/).
- [Meikyuu](https://github.com/johnmorrisdotca/meikyuu) (迷宮): mazes on squares, hexagons, triangles and circles, made from a seed and drawn through with a finger or the mouse. [Demo](https://johnmorrisdotca.github.io/meikyuu/).
- [Suido](https://github.com/johnmorrisdotca/suido) (水道): a pipe puzzle: turn the pieces until the water reaches every drain. [Demo](https://johnmorrisdotca.github.io/suido/).
- [Tobiishi](https://github.com/johnmorrisdotca/tobiishi) (飛び石): peg solitaire with nine boards and seeded solvable challenges. [Demo](https://johnmorrisdotca.github.io/tobiishi/).
- [Tsunagi](https://github.com/johnmorrisdotca/tsunagi) (繋ぎ): a line-joining logic puzzle whose every level has exactly one answer. [Demo](https://johnmorrisdotca.github.io/tsunagi/).

**Games — dice & random**

- [Korokoro](https://github.com/johnmorrisdotca/korokoro) (コロコロ): dice, with notation, exact odds, real sounds and the dice of many games. [Demo](https://johnmorrisdotca.github.io/korokoro/).
- [Tane](https://github.com/johnmorrisdotca/tane) (種): seeded random numbers and daily seeds, the same in every browser and on every server. [Demo](https://johnmorrisdotca.github.io/tane/).

**Language**

- [Bushu](https://github.com/johnmorrisdotca/bushu) (部首): find a kanji by the parts it is made of. [Demo](https://johnmorrisdotca.github.io/bushu/).
- [Hikidashi](https://github.com/johnmorrisdotca/hikidashi) (引き出し): a drawer of small Japanese text tools: era dates, kanji numerals, readings and sentence difficulty. [Demo](https://johnmorrisdotca.github.io/hikidashi/).
- [Kotoba](https://github.com/johnmorrisdotca/kotoba) (言葉): word lists and word-game rules in English, French, German and Japanese. [Demo](https://johnmorrisdotca.github.io/kotoba/).

**Geography & data**

- [address-plus](https://github.com/johnmorrisdotca/address-plus) (アドレスプラス): parse and format addresses in the United States, Canada, Japan, Australia, France, Germany and the United Kingdom. [Demo](https://johnmorrisdotca.github.io/address-plus/).
- [Chikyu Earth](https://github.com/johnmorrisdotca/chikyu-earth) (地球): a line-drawn globe that turns at the Earth's own rate, with an optional realistic Earth from space and markers for any place. [Demo](https://johnmorrisdotca.github.io/chikyu-earth/).
- [Chizu](https://github.com/johnmorrisdotca/chizu) (地図): maps of the world and of countries' regions, in English and Japanese, with a quiz and callouts. [Demo](https://johnmorrisdotca.github.io/chizu/).
- [Hata](https://github.com/johnmorrisdotca/hata) (旗): country and regional flags as SVG, at their true proportions and keyed by ISO code. [Demo](https://johnmorrisdotca.github.io/hata/).
- [Kuni](https://github.com/johnmorrisdotca/kuni) (国): countries and their regions, with ISO codes and names in English and Japanese. [Demo](https://johnmorrisdotca.github.io/kuni/).
- [Wakusei Planets](https://github.com/johnmorrisdotca/wakusei-planets) (惑星): the Sun, the planets and their moons, as line drawings, shaded drawings and painted surface maps, with their real sizes, tilt and rotation. [Demo](https://johnmorrisdotca.github.io/wakusei-planets/).

**Sports**

- [Dougu Sports](https://github.com/johnmorrisdotca/dougu-sports) (道具): sports emblems as SVG: trophies, medals, crests, and the ball and gear of every sport, with optional 3D turning. [Demo](https://johnmorrisdotca.github.io/dougu-sports/).
- [Kyogijo Stadiums](https://github.com/johnmorrisdotca/kyogijo-stadiums) (競技場): sports fields, rinks, courts and ballparks drawn to scale as SVG, with each team and the score on them. [Demo](https://johnmorrisdotca.github.io/kyogijo-stadiums/).
- [Senshu Jerseys](https://github.com/johnmorrisdotca/senshu-jerseys) (選手): sports jerseys, sweaters, kits, caps, helmets and retired-number banners as SVG, front and back, with optional 2.5D turning. [Demo](https://johnmorrisdotca.github.io/senshu-jerseys/).
- [Taisen Brackets](https://github.com/johnmorrisdotca/taisen-brackets) (対戦): a sport-agnostic tournament bracket, drawn as SVG, from a list of ties. [Demo](https://johnmorrisdotca.github.io/taisen-brackets/).

**Developer tools**

- [REST in Pieces](https://github.com/spxis/rest-in-pieces) (レスト・イン・ピーシーズ): seeded test data and REST APIs for frontend development, with latency and error drills. [Demo](https://spxis.github.io/rest-in-pieces/).


**This package is Wakusei Planets.** The demos of all thirty-four share one header and footer, so each links the rest.
<!-- family:end -->
