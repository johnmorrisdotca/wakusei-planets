---
title: Landing sites, with their flags
section: how-to
order: 22
description: "Every landing on the Moon and Mars that touched down softly and was heard from, 39 in all, as one small plain list: names in English and Japanese, the day, the point, who flew it, the country as a flag code, and the page each coordinate comes from. On the 3D Moon and Mars, the sites are named beside their dots with their country's flag."
---

[日本語](ja/landing-sites.md)

`/landing-sites` is the short list of landings that worked: **28 on the Moon** and **11 on Mars**, each with what a card or a flat map needs and nothing else. It is plain data (no DOM, no three.js, about 5 kB gzipped) and it is not a second set of places: every site's point is the point the place tables (`/places/moon`, `/places/mars`) hold, and a test pins the two together, so a site on a card is the site on the globe.

```ts
import { findLandingSite, flagCodeOf, landingSitesOf } from "@johnmorrisdotca/wakusei-planets/landing-sites";

const eagle = findLandingSite("Apollo 11")!;
console.log(eagle.name.en, eagle.name.ja, eagle.date, eagle.lat, eagle.lon, eagle.agency.en, eagle.country, flagCodeOf(eagle.country));
console.log(eagle.source.name, eagle.source.url);
console.log(landingSitesOf("mars").map((site) => `${site.name.en} (${site.country})`).join(", "));
```

## What is in it

| | Sites |
|---|---|
| Moon, crewed | Apollo 11, 12, 14, 15, 16, 17 |
| Moon, Soviet | Luna 9, 13, 16, 17, 20, 21, 23, 24 |
| Moon, American | Surveyor 1, 3, 5, 6, 7; IM-1 Odysseus, Blue Ghost 1, IM-2 Athena |
| Moon, Chinese, Indian, Japanese | Chang'e 3, 4, 5, 6; Chandrayaan-3; SLIM |
| Mars | Mars 3 (it landed, then fell silent after about 20 seconds), Viking 1 and 2, Mars Pathfinder, Spirit, Opportunity, Phoenix, Curiosity, InSight, Perseverance, Zhurong |

A site is in the list when a source says the craft touched down on the surface and was heard from after it. Craft that crashed or were lost on the way down (Luna 5, 7 and 8, Mars 2, Mars Polar Lander, Beagle 2, Schiaparelli, Hakuto-R, the Vikram of Chandrayaan-2) are not here; the place tables hold them as crashes. Mars 6, which sent data on the way down and went silent as it reached the surface, is in the place tables as a landing at an approximate point and is left out here: no source says it was heard from after touchdown. A rover is not a site of its own: it is `alsoAt` the lander's. Landers still to fly are in the place tables as `planned`, not here. The Moon's newest are Blue Ghost 1 and IM-2 (March 2025); NASA's table of the Moon's landings has no later soft landing.

## One record

```ts
import type { LandingSite } from "@johnmorrisdotca/wakusei-planets/landing-sites";

const site: LandingSite = {
  id: "moon/apollo-17",                       // <body>/<slug>
  place: "moon/apollo-17-lunar-module",       // the same site in the place tables
  alsoAt: ["moon/apollo-17-lunar-rover"],     // other places on the spot: the rover, the descent stage
  body: "moon",
  name: { en: "Apollo 17", ja: "アポロ17号" },
  date: "1972-12-11T19:54Z",                  // UTC
  lat: 20.1911, lon: 30.7723,                 // planetocentric, east, -180 to 180
  agency: { en: "NASA", ja: "NASA" },
  country: "US",                              // ISO 3166-1 alpha-2, or SU for the Soviet Union
  stand: "apollo-17",                         // you can stand here: the id in the standing view
  source: { name: "NASA NSSDCA, Table of Anthropogenic Impacts and Spacecraft on the Moon", url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html" },
  page: "https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-096C",
};
console.log(site.id);
```

`source` is where the numbers were read, and every record has one. `checkedAgainst` is a second NASA page that gives the same place (where the record's own source is GCAT, it is the NASA page that agrees to the 0.01 degree it prints). `page` is the mission's NSSDCA page, where one loads. `approximate` is on where the source says "about" (Luna 9, whose position comes from the first Soviet report and is probably at least 10 km from the real one; Mars 3). A `note` says how a landing ended where a source does.

**Where the Moon's numbers come from.** NASA NSSDCA's "Table of Anthropogenic Impacts and Spacecraft on the Moon", read on 2026-11-17 and compared row by row with every Moon record here (28 of 28 agree). **Mars:** the Mars Orbital Data Explorer's list of landing sites for Pathfinder, Spirit, Opportunity and Phoenix; NASA NSSDCA's Viking pages for the Vikings; NASA GISS's Mars24 lander list for InSight; and GCAT (J. McDowell, CC BY 4.0) for Mars 3, Curiosity, Perseverance and Zhurong, each checked against NASA's Mars24 or ODE pages. A Mars latitude is planetocentric; where a source prints a planetographic one (Phoenix's 68.22 N) the record says so in its `note`.

## Countries and flags

`country` is the two capital letters of ISO 3166-1, and `SU` for the Soviet Union (the code ISO 3166-3 kept for it). `flagCodeOf(country)` gives the code a flag element takes (`J`, the one-letter code GCAT uses for Japan, becomes `JP`), or `undefined` where there is no flag to show.

The flags are `@johnmorrisdotca/hata`'s, drawn by its `<hata-flag>` element: real flags as SVG, not emoji, which Windows does not draw. **This package has no dependency on hata.** The marks it lays are DOM, and where a place has a country and flags are on, a mark carries `<hata-flag code="US" border>`; a page that imports `@johnmorrisdotca/hata/element/define` gets the flag, and any other page gets the name alone, because an element nobody has defined draws nothing. The Soviet Union's flag is hata's (`SU`). There is no flag for an agency of several countries (ESA); such a site shows its name only.

## Flags on the 3D Moon and Mars

`site-flags` on `<wakusei-body>` and `<wakusei-space>` (the property `siteFlags`), with `places` on:

```html
<script type="module">
  import "@johnmorrisdotca/wakusei-planets/element";
  import { loadPlaces } from "@johnmorrisdotca/wakusei-planets/places";
  import { setPlacesLoader } from "@johnmorrisdotca/wakusei-planets/element";
  import "@johnmorrisdotca/hata/element/define"; // the flag; leave it out and the names stand alone

  setPlacesLoader(loadPlaces);
</script>
<wakusei-body body="moon" look="painted" places="landing" site-flags style="width: 480px; height: 480px"></wakusei-body>
```

- The tip of any place with a country (the tip a hover, focus or touch shows) carries the country's flag before the name.
- On a body close enough (110 CSS pixels of radius on the screen), each landing site is named beside its dot with its flag, on the right of the dot or, where that has no room, the left. A name that would sit on a dot or on another name is left out; closer in, more of them find room. Names come in the view's `lang`.
- Nothing is drawn faster or more often: the labels move with the dots they belong to.
- A press on a mark sends the same `wakusei-place` event as before, and its `detail` now has `site`: the landing site, or `undefined` for a place that is not one (a crash, a rover, a feature). The page can show a card from it: the names, the day, the agency, the flag code and the source.

```ts no-run
const body = document.querySelector("wakusei-body")!;
body.addEventListener("wakusei-place", (event) => {
  const { site } = (event as CustomEvent<{ site?: import("@johnmorrisdotca/wakusei-planets/landing-sites").LandingSite }>).detail;
  if (site !== undefined) console.log(`${site.name.en}, ${site.agency.en}, ${site.date.slice(0, 4)}`, site.source.url);
});
```

Apollo 17 is also a place to stand: its record has `stand: "apollo-17"`, the id `<wakusei-surface site>` and `land(space, "apollo-17")` (`/surface/land`) take. The marker and the standing view are the same site; the list does not repeat it.

## What it costs

`/landing-sites` is one table of about 5 kB gzipped and no code beyond three lookups. The marks cost what they did: with `site-flags` off nothing changes; with it on, a mark's name and flag are two small elements, laid in the draw the marks are laid in already.
