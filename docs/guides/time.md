---
title: Time
section: how-to
order: 14
description: Julian dates, calendars, time scales, sidereal time and Mars time, in a few kilobytes with no dependencies.
---

`/time` is everything the sky needs to know about the clock: Julian dates (with the functions of the [julian](https://www.npmjs.com/package/julian) package under the same names), the Gregorian and Julian calendars, the time scales (UTC, UT1, TAI, GPS, TT, TDB) with the leap seconds, sidereal time and Mars time. It runs anywhere, imports nothing but itself and is about 3 kB gzipped.

A moment is a `Date` or a number of milliseconds since 1970, which is UTC as JavaScript counts it (leap seconds are not counted). A `Date` is never changed; an invalid one throws a `RangeError` that names it.

```ts
import { convertTimeScale, fromCalendar, greenwichMeanSiderealTime, marsSolDate, toCalendar, toJulianDate } from "@johnmorrisdotca/wakusei-planets/time";

const sputnik = Date.UTC(1957, 9, 4, 19, 26, 24);
console.log(toJulianDate(sputnik).toFixed(2));                       // 2436116.31
console.log(toCalendar(sputnik).day, new Date(fromCalendar({ year: 333, month: 1, day: 27 }, "julian")).toISOString());
console.log((convertTimeScale(Date.UTC(2026, 10, 7), "utc", "tt") - Date.UTC(2026, 10, 7)) / 1000);   // 69.184
console.log((greenwichMeanSiderealTime(Date.UTC(1987, 3, 10)) / 15).toFixed(4), marsSolDate(Date.UTC(2021, 1, 18, 20, 55)).toFixed(1));
```

## Julian dates

| Function | Gives |
|---|---|
| `toJulianDate(when)` and `fromJulianDate(jd)` | the Julian date as a number, and back |
| `julian(when)` and `toDate(jd)` | the Julian date as a string with six decimals, and back to a `Date` (the `julian` package's own) |
| `toJulianDay(when)`, `toMillisecondsInJulianDay(when)`, `fromJulianDayAndMilliseconds(day, ms)` | the whole Julian day (it starts at noon) and the milliseconds into it, and the way back with no digit lost |
| `modifiedJulianDate(when)` | the Julian date less 2,400,000.5 |
| `julianCenturies(when, scale?)`, `julianMillennia(when, scale?)` | centuries and millennia from J2000.0, in terrestrial time unless `scale` is `"utc"` |
| `J2000_JD`, `J2000_MS`, `B1950_JD`, `UNIX_EPOCH_JULIAN_DATE` | the epochs |

A Julian date held as one number near 2.46 million has about a tenth of a millisecond left over, so when it matters keep the pair `toJulianDay` and `toMillisecondsInJulianDay`: `fromJulianDayAndMilliseconds` gives back the very same millisecond for any moment.

### Coming from julian

Import the same names from `/time`. `julian(date)`, `toDate`, `toJulianDay`, `toMillisecondsInJulianDay` and `fromJulianDayAndMilliseconds` give what julian gives for every moment from noon on 31 December 1969, and they also take milliseconds. Before that, julian truncates toward zero and returns a day one too high with a negative number of milliseconds; here the day is the floor and the milliseconds are always from 0 up to one day, so `fromJulianDayAndMilliseconds(toJulianDay(t), toMillisecondsInJulianDay(t))` is `t` for every moment, which is what julian's README promises. `julian()` gives the same string for all of them. `toDate` rounds a fraction of a millisecond to the nearest, where julian lets `Date` truncate it.

## Calendars

`toCalendar(when, calendar?)` and `fromCalendar(civil, calendar?)` go between a moment and a year, month, day, hour, minute, second and millisecond in UTC. The calendar is `"auto"` (the default: Julian to 4 October 1582, Gregorian from 15 October), or `"gregorian"` or `"julian"` for every year. Years are astronomical: 1 BCE is 0 and 2 BCE is -1. Dates work over the whole range of a JavaScript `Date`, from the year -271821 to 275760.

```ts
import { dayOfWeek, dayOfYear, daysInMonth, fromCalendar, isLeapYear, toCalendar } from "@johnmorrisdotca/wakusei-planets/time";

console.log(toCalendar(fromCalendar({ year: 1582, month: 10, day: 4 }) + 86_400_000));   // 15 October 1582: the ten days between do not exist
console.log(dayOfWeek(Date.UTC(1954, 5, 30)), dayOfYear(Date.UTC(1988, 3, 22)), daysInMonth(1582, 10), isLeapYear(1900), isLeapYear(1900, "julian"));
```

A day that does not exist (31 April, 29 February in a common year, 5 to 14 October 1582 in `auto`) throws a `RangeError` with the date in the message. `dayOfWeek` is 0 for Sunday.

## Time scales

| Scale | What it is | From UTC |
|---|---|---|
| `utc` | the clock; JavaScript does not count leap seconds | 0 |
| `ut1` | the Earth's turn, within 0.9 s of UTC | `dut1` (from the IERS; 0 when left out) |
| `tai` | atomic time | the leap seconds: 10 s in 1972, 37 s since 2017 |
| `gps` | GPS time | TAI less 19 s (18 s since 2017) |
| `tt` | terrestrial time, what the planets' theories run in | TAI plus 32.184 s: 69.184 s since 2017 |
| `tdb` | barycentric dynamical time | TT plus a term of at most 1.7 ms |

`convertTimeScale(when, from, to, { dut1 })` moves a moment between any two; the number it returns is read on the target scale's own clock, so the difference is just added or taken off. `deltaT(when, dut1?)` is TT minus UT1 in seconds, `taiMinusUtc` and `ttMinusUtc` the offsets, `tdbMinusTt` the small term.

Where the numbers come from: the leap seconds are IERS Bulletin C, exact from 1972. Before 1972 the offset is delta T from the polynomials of Espenak and Meeus (NASA). After the last leap second in 2017 it is held at 69.184 s, the assumption JPL Horizons makes, because future leap seconds are not known: the Earth is slowing and a forecast of delta T would be several seconds higher by 2050. UT1 is UTC unless you pass `dut1`, which the IERS publishes weekly.

## Sidereal time

`greenwichMeanSiderealTime(when, dut1?)`, `greenwichApparentSiderealTime(when, dut1?)` and `localSiderealTime(when, longitude, { apparent?, dut1? })` give the Earth's turn against the stars in degrees from 0 to 360 (divide by 15 for hours). The apparent time adds the equation of the equinoxes, `equationOfTheEquinoxes(when)`, up to about a second of time. They agree with Meeus's worked examples to a hundredth of a second (the mean time) and with astronomy-engine to a thousandth of a degree.

## Mars time

`marsSolDate(when)`, `coordinatedMarsTime(when)` (hours from 0 to 24 on Mars's prime meridian) and `marsLocalMeanSolarTime(when, longitude)` follow Allison and McEwen (2000). A sol is 88,775.244 seconds. Curiosity touched down at about 15:00 local mean solar time at Gale, which the tests check.

## What is not here

Future leap seconds, a forecast of delta T beyond 2017, and unit conversions from attoseconds to gigayears are not here. UT1 needs the IERS's own numbers, which change weekly and are not shipped.
