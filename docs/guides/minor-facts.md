---
title: Facts about the minor bodies and dwarf planets
section: how-to
order: 35
description: The orbit's size, shape and period and the discovery of Vesta, Pallas, Chiron, Pholus, Halley's comet and the nine dwarf planets, as plain data with the uncertainty, the epoch and the source of every figure.
---

`MINOR_FACTS` from `@johnmorrisdotca/wakusei-planets/minor-facts` holds what a card for one of the small bodies needs and `bodyInfo` does not give: the size and shape of its orbit, its period, and who found it and when. It covers the five minor bodies the space view places (Vesta, Pallas, Chiron, Pholus and Halley's comet) and the nine dwarf planets (Ceres, Pluto, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris and Sedna): `MINOR_FACT_IDS` lists them and `minorFacts(id)` finds one by id in any case.

```js
import { MINOR_FACTS, periodYears } from "@johnmorrisdotca/wakusei-planets/minor-facts";

// What is known of two small bodies: the size of the orbit (its semi-major axis), the period and who found it, each with the uncertainty the Small-Body Database gives. Plain data, no browser, no clock read.
for (const id of ["halley", "eris"]) {
  const body = MINOR_FACTS[id];
  const a = body.orbit.semiMajorAxisAu;
  console.log(`${body.designation}: semi-major axis ${a.value.toFixed(1)} au, period ${periodYears(body).toFixed(1)} years, found ${body.discovery.date} by ${body.discovery.by[0]} (read ${body.source.read})`);
}
```

Every figure is a `{ value, sigma }`: the value and its one-sigma uncertainty in the same unit, as NASA/JPL's Small-Body Database gives them, or `sigma: null` where it gives none (it gives none for Pluto's orbit). The orbit (`orbit.semiMajorAxisAu`, `eccentricity`, `perihelionAu`, `aphelionAu` and `periodDays`) is the database's osculating orbit at its own epoch (`orbit.epoch`, a Julian date): the orbit the body would follow if only the Sun pulled on it from then on. The planets pull the real orbit about a little, so a figure is for that moment and not for all time, most of all for a comet's period. The epoch is 2461200.5 (2026-06-09) for all but Pluto (2457588.5, 2016-07-19) and Halley's comet (2439875.5, 1968-01-20). `periodYears(facts)` is the period in days over 365.25, worked out here and not stated by the database.

`discovery` is the date (`YYYY-MM-DD`), the finders' names in the database's form and the place it names, as the database states them; a body the database gives no discovery for has none (every body here has one). `source` says which answer the record is typed from (a URL that gives it again), the name of the source and the day it was read, 2026-11-13. NOTICE.md names the source and its terms. The facts are one source's statement: where another says otherwise (who found Halley's comet is a matter of what counts as finding), this says what the database says.

The `/asteroids` entry holds the other hundred or so bodies, with their own elements, sizes and the year each was found; it does not repeat these fourteen.
