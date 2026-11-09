---
title: "For children: your weight and age on other worlds"
section: how-to
order: 19
description: What you weigh and how old you are on the Sun, the planets, Pluto and the moons, and when your next birthday comes there, from the surface gravity and the length of each world's year and day.
---

`/kids` answers two questions a child asks: *how much would I weigh on Mars?* and *how old would I be on Jupiter?* It runs anywhere, with no browser and no clock of its own: the dates are arguments. The demo's [kids page](https://johnmorrisdotca.github.io/wakusei-planets/kids.html) puts it on big friendly cards, in English and Japanese.

```ts
import { ageOn, nextBirthdayOn, weightOn } from "@johnmorrisdotca/wakusei-planets/kids";

const born = Date.UTC(2016, 10, 8);
const today = Date.UTC(2026, 10, 8);

console.log(weightOn("moon", 30).toFixed(1), "kg on the Moon");
console.log(weightOn("jupiter", 30).toFixed(1), "kg at Jupiter's cloud tops");
console.log(ageOn("earth", born, today)?.wholeYears, "years on the Earth");
console.log(ageOn("mars", born, today)?.years.toFixed(1), "years on Mars");
console.log(nextBirthdayOn("mars", born, today)?.date.toISOString().slice(0, 10), "is the next Mars birthday");
```

## Weight

`weightOn(world, weight)` gives what you would weigh on a world, in the unit you give: kilograms in, kilograms out, pounds in, pounds out. Your mass does not change; the pull does. It is the number a bathroom scale on the Earth would show if you stood on that world.

The pull is the surface gravity, GM divided by the radius squared, taken at the equator and not counting the world's own turning, as a multiple of the Earth's worked out the same way, so the Earth is exactly 1. `surfaceGravity(world)` gives it in metres a second squared (`metresPerSecondSquared`), as that multiple (`relativeToEarth`), where it is measured (`surface`) and the source (`source`).

| World | Pull (Earth = 1) | Surface gravity, m/s² |
|---|---|---|
| Sun | 28.0 | 274 |
| Mercury | 0.38 | 3.70 |
| Venus | 0.91 | 8.87 |
| Earth | 1 | 9.80 |
| Moon | 0.17 | 1.62 |
| Mars | 0.38 | 3.71 |
| Jupiter | 2.53 | 24.8 |
| Saturn | 1.07 | 10.4 |
| Uranus | 0.91 | 8.87 |
| Neptune | 1.14 | 11.1 |
| Pluto | 0.06 | 0.62 |
| Io | 0.18 | 1.80 |
| Titan | 0.14 | 1.35 |

Where it is measured: a planet's or a moon's surface; the Sun's visible surface (the photosphere); and, for Jupiter, Saturn, Uranus and Neptune, **the cloud tops, where the air pressure is 1 bar**, the same as at sea level on the Earth, because a gas giant has no ground to stand on. The `surface` field says `"surface"`, `"photosphere"` or `"cloud-tops"`.

The sources, per world. The GM of the Sun, Mercury and Venus is from NASA's planetary fact sheets (https://nssdc.gsfc.nasa.gov/planetary/factsheet/). The GM of the Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto and every moon is from JPL's Planetary Satellite Physical Parameters (https://ssd.jpl.nasa.gov/sats/phys_par/). The radii are the IAU's and NASA's, the same as `BODIES`. They are the numbers `journeyStop` already holds. Each world's `source` says which. The values match NASA's published surface gravity within 1 percent (the tests hold that). A body with no published mass (Nereid, and the dwarf planets other than Pluto) is not a world here, so `WORLD_IDS` leaves it out.

## Age

`ageOn(world, birth, now)` gives how old you are there, in that world's years and days:

| Field | What it is |
|---|---|
| `years` | Your age in that world's years, with the part of the year gone (5.3 is five years and a bit). |
| `wholeYears` | The whole years: the age a child would say. |
| `days` | The days you have lived there, a day being that world's solar day. |
| `yearDays` | How long the world's year is, in Earth days. |
| `dayHours` | How long its solar day is, in Earth hours. |

A world's **year** is its orbit period, from NASA's planetary fact sheet: Mercury 87.969 days, Venus 224.701, Mars 686.98, Jupiter 4,332.589, Saturn 10,759.22, Uranus 30,685.4, Neptune 60,189 and Pluto 90,560. A moon goes round the Sun with its planet, so **a moon's year is its planet's**: the Moon's is the Earth's, Titan's is Saturn's. On the Earth, and so on the Moon, the years are counted by calendar birthdays, so `wholeYears` is your real age and a ten-year-old is 10 on the day.

A world's **day** is its solar day, noon to noon: 1 / (1 / the spin period − 1 / the year), with the spin period from the IAU (backwards for Venus, Uranus and Pluto). Mercury's is 4,222 hours (176 Earth days), Venus's 2,802 hours, the Earth's exactly 24, Mars's 24.66, Jupiter's 9.93, Pluto's 153 and the Moon's 708.7 hours (29.5 Earth days). A moon that always shows one face to its planet has a solar day about as long as its orbit.

The Sun has no year and no day to count, so `ageOn("sun", ...)` is `null`. Nix and Hydra, the two small moons of Pluto, tumble with no steady spin, so their `days` and `dayHours` are `null` (their years are Pluto's).

## The next birthday

`nextBirthdayOn(world, birth, now)` gives the first moment on or after `now` when the world is back where it was on the day you were born, counting its years from your birth: `date`, `turns` (the age you turn there) and `inEarthDays` (0 on the day itself). On the Earth and the Moon it is the calendar birthday, and 29 February is kept on 28 February in a year with no 29th. The Sun gives `null`.

## Dates

A birthday is a calendar date, so give the birthday and today as **midnight UTC of the date**, a `Date` or milliseconds: `Date.UTC(2016, 10, 8)` is 8 November 2016. A page turns a date field and today's local date into that, as the demo does. A birthday after `now`, or a date that is not one, throws a `RangeError`.

```ts
import { WORLD_IDS, ageOn } from "@johnmorrisdotca/wakusei-planets/kids";

const now = new Date();
const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const [year, month, day] = "2016-11-08".split("-").map(Number);
console.log(WORLD_IDS.length, ageOn("venus", Date.UTC(year!, month! - 1, day!), today)?.wholeYears);
```

## The kids page

The demo's `kids.html` has a big card for the Sun, each planet, Pluto, the Moon and the big moons (Io, Europa, Ganymede, Callisto, Titan and Triton). Each has its line drawing (`lineSvg`), its name in large rounded type, how many times the Earth's its pull is, your weight there, your age in years and days, and your next birthday. Type a weight in kilograms or pounds and a birthday. English and Japanese, one at a time, the Japanese in plain everyday words. The fields and buttons are 56 pixels tall.

**Nothing is stored.** The weight and the birthday live in the two fields and nowhere else: not in `localStorage`, not in a cookie, not in the address. Reloading the page empties them. A page of your own should do the same with a child's birthday.

## The words

The page's words are in `demo/words.js`, every key in both languages. The Japanese is for children, mostly hiragana; have it read by someone who reads Japanese before it ships.
