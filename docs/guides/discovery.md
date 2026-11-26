---
title: Discovery facts
section: how-to
order: 16
description: When, where, how and by whom each planet, dwarf planet, minor body and fully drawn moon was found, how it was first designated, and where its name comes from, each fact with its source.
---

`/discovery` is the story of how each body was found, as data you can print, search or put in a card: the day, the place, who, how, the first provisional designation, the number, and where the name comes from. Every fact says which source it was read from, so a page can show it, and a reader can check it.

```ts
import { discoveryOf, DISCOVERY_SOURCES } from "@johnmorrisdotca/wakusei-planets/discovery";

const neptune = discoveryOf("neptune")!;
console.log(neptune.date?.value, neptune.place?.value, neptune.by?.value.join(", "));
console.log(neptune.nameOrigin?.value);
for (const note of neptune.notes) console.log(note);
const where = neptune.date!.source;
console.log("read from", DISCOVERY_SOURCES[where]![0]);
```

`discoveryOf(id)` gives the record of one body in `DISCOVERY_IDS`: the eight planets, nine dwarf planets, the eight minor bodies the package draws (Bennu, Eros, Vesta, Pallas, Chiron, Pholus, Halley and Arrokoth), the Moon and the other moons the package draws in full. `DISCOVERIES` is the whole list in order. The fields, each of them `null` where no source read gives it:

| Field | Meaning |
|---|---|
| `ancient` | true for Mercury to Saturn, the Earth and the Moon, known since before recorded history: they have no date, place or discoverer |
| `date` | the day (`1846-09-23`), or the month where the source gives only that (`1989-06`). It is the date of the observation the source gives, which is not always the day it was recognised: `notes` says where another source differs |
| `place` | the observatory, the city or the spacecraft, as the source writes it |
| `by` | the discoverers, as the source writes them (`null` for Haumea: the Gazetteer and JPL name no person) |
| `method` | how it was found: `ancient`, `visual`, `calculation` (Neptune), `photographic`, `electronic`, `adaptive-optics`, `space-telescope` or `spacecraft`. This one is worked out here from the place and the date, not read from a list, and its source says `derived` |
| `designation` | the first provisional designation: `1930 BM` for Pluto, `S/1978 P 1` for Charon |
| `number` | the minor planet number (`(134340)`) or the moon's number round its planet (`Saturn VI`) |
| `announced` | the circular that announced a moon found since 2005 |
| `namedBy` | who gave an old moon its name, where the Gazetteer says |
| `nameOrigin` | where the name comes from, in our own words |
| `notes` | where another source gives a different day or credit, and what a field leaves out |

## Where the facts come from

| Key | Source | Read |
|---|---|---|
| `usgs` | the IAU Working Group for Planetary System Nomenclature's Gazetteer of Planetary Nomenclature, hosted by the USGS (a US government work): the day, the place, the discoverers and the account of each name | 2026-11-18 |
| `jpl-sbdb` | the JPL Small-Body Database's discovery record, which holds what the Minor Planet Center published: the first designation, the day, the place and the discoverers of a numbered minor planet. The eight minor bodies the package draws were read from the same API on 2026-11-26; each of those records says so in `notes` | 2026-11-18 |
| `jpl-ssd-moons` | JPL's Planetary Satellite Discovery Circumstances: a moon's designation and number and the circular that announced it (the read of `/moon-catalogue`) | 2026-11-11 |
| `wikidata` | Wikidata (CC0), only where the others give nothing: the four people credited with Neptune, the day Vanth was found, the origin of a few names | 2026-11-18 |
| `derived` | worked out here, not published: the `method` | 2026-11-18 |

`DISCOVERY_SOURCES` has the names and addresses. The records are made by `scripts/make-discovery-data.py`, which fetches nothing: a fact changes by a change to that file, with its source.

Where the day is a matter of which observation counts, the Gazetteer's day is used and `notes` has the other. Pluto's is 23 January 1930, the day of the plates (Wikidata gives 18 February 1930), and Charon's is 13 April 1978 (Wikidata gives 22 June). Io is 8 January 1610 (Wikidata, 7th), and Mimas 18 July 1789 (Wikidata and Wikipedia, 17 September). Vanth's day is Wikidata's, since the Gazetteer does not list it, and its place and method are left out for that reason: neither source gives them.

Where the credit is a matter of who counts, `by` follows the Gazetteer or JPL and `notes` has the rest. Neptune is J.G. Galle, who found it at Berlin; Wikidata also credits Le Verrier and Adams, who calculated where it should be, and d'Arrest. Haumea has no person, and its note says what Wikidata lists.

## Left out

The day a minor planet was numbered and the day it was named are not in these records: the JPL record names the batch of the Minor Planet Center's circulars that did it (`20060907/Numbers.arc` for Pluto), not a day, and no source read gives the day a moon's name was approved. A later record can add them.
