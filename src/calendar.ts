// Calendars: the Gregorian and the Julian, the switch between them in October 1582, years before 1 CE (astronomical numbering, so the year 0 is 1 BCE), days of the week and of the year.
// Whole days are counted as integers, so a date goes to a moment and back without a digit lost and years from -271821 to 275760 (the range of a JavaScript `Date`) all work. Pure: no DOM, no three.js.
import { moment, type When } from "./when.ts";

const DAY_MS = 86_400_000;
/** The Julian day number (the day that begins at midnight) of 1970-01-01. */
const UNIX_DAY_NUMBER = 2_440_588;
/** The Julian day number of 1582-10-15, the first day of the Gregorian calendar. */
const REFORM_DAY_NUMBER = 2_299_161;

/**
 * Which calendar: `gregorian` and `julian` are used for every year (the proleptic calendars), and `auto` follows history: the Julian calendar to 1582-10-04 and the Gregorian from 1582-10-15.
 *
 * @example
 * ```ts
 * import { type Calendar } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const calendar: Calendar = "auto";
 * console.log(calendar);
 * ```
 */
export type Calendar = "gregorian" | "julian" | "auto";

/**
 * A date and time of day. The year is astronomical (1 BCE is 0, 2 BCE is -1), the month is 1 to 12, the day starts at 1.
 *
 * @example
 * ```ts
 * import { toCalendar, type CivilTime } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * const t: CivilTime = toCalendar(Date.UTC(1957, 9, 4, 19, 26, 24));
 * console.log(t.year, t.month, t.day, t.hour);
 * ```
 */
export interface CivilTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const floorMod = (a: number, b: number): number => a - b * Math.floor(a / b);

function dayNumberOf(year: number, month: number, day: number, gregorian: boolean): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const base = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  return gregorian ? base - Math.floor(y / 100) + Math.floor(y / 400) - 32045 : base - 32083;
}

function dateOfDayNumber(J: number, gregorian: boolean): { year: number; month: number; day: number } {
  const f = gregorian ? J + 1401 + Math.floor((Math.floor((4 * J + 274277) / 146097) * 3) / 4) - 38 : J + 1401;
  const e = 4 * f + 3;
  const g = Math.floor(floorMod(e, 1461) / 4);
  const h = 5 * g + 2;
  const day = Math.floor(floorMod(h, 153) / 5) + 1;
  const month = ((Math.floor(h / 153) + 2) % 12) + 1;
  return { year: Math.floor(e / 1461) - 4716 + Math.floor((14 - month) / 12), month, day };
}

/**
 * Whether a year is a leap year.
 * @param year - The astronomical year.
 * @param calendar - `gregorian` (a century is a leap year only if divisible by 400), `julian` (every fourth year), or `auto` (the Julian rule to 1582, the Gregorian after).
 * @returns `true` for a leap year.
 *
 * @example
 * ```ts
 * import { isLeapYear } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(isLeapYear(1900), isLeapYear(1900, "julian"), isLeapYear(2000));
 * ```
 */
export function isLeapYear(year: number, calendar: Calendar = "auto"): boolean {
  if (!Number.isInteger(year)) throw new RangeError(`year must be a whole number, got ${year}`);
  const gregorian = calendar === "gregorian" || (calendar === "auto" && year > 1582);
  return floorMod(year, 4) === 0 && (!gregorian || floorMod(year, 100) !== 0 || floorMod(year, 400) === 0);
}

/**
 * The number of days in a month; October 1582 has 21 in the `auto` calendar, the ten days of the switch being left out.
 * @param year - The astronomical year.
 * @param month - 1 to 12.
 * @param calendar - `gregorian`, `julian` or `auto`.
 * @returns The days in the month.
 *
 * @example
 * ```ts
 * import { daysInMonth } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(daysInMonth(2024, 2), daysInMonth(1582, 10));
 * ```
 */
export function daysInMonth(year: number, month: number, calendar: Calendar = "auto"): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`month must be a whole number from 1 to 12, got ${month}`);
  if (calendar === "auto" && year === 1582 && month === 10) return 21;
  if (month === 2) return isLeapYear(year, calendar) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * A moment as a date and time of day in UTC, in the Gregorian or the Julian calendar.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param calendar - `auto` (default: the calendar in use that day), `gregorian` or `julian` for every year.
 * @returns The year (astronomical), month, day, hour, minute, second and millisecond.
 *
 * @example
 * ```ts
 * import { toCalendar } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(toCalendar(Date.UTC(1582, 9, 15)), toCalendar(Date.UTC(1582, 9, 15), "julian").day);
 * ```
 */
export function toCalendar(when: When, calendar: Calendar = "auto"): CivilTime {
  const ms = Math.floor(moment(when));
  const dayNumber = Math.floor(ms / DAY_MS) + UNIX_DAY_NUMBER;
  const inDay = floorMod(ms, DAY_MS);
  const gregorian = calendar === "gregorian" || (calendar === "auto" && dayNumber >= REFORM_DAY_NUMBER);
  const { year, month, day } = dateOfDayNumber(dayNumber, gregorian);
  return { year, month, day, hour: Math.floor(inDay / 3_600_000), minute: Math.floor((inDay % 3_600_000) / 60_000), second: Math.floor((inDay % 60_000) / 1000), millisecond: inDay % 1000 };
}

/**
 * A date and time of day in UTC as a moment, in milliseconds since 1970. A day that does not exist (31 April, 29 February in a common year, or 5 to 14 October 1582 in the `auto` calendar) throws a `RangeError`.
 * @param civil - The year (astronomical), and the month (1), day (1), hour, minute, second and millisecond (0) when left out.
 * @param calendar - `auto` (default), `gregorian` or `julian`.
 * @returns Milliseconds since 1970.
 *
 * @example
 * ```ts
 * import { fromCalendar } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(fromCalendar({ year: 333, month: 1, day: 27, hour: 12 }, "julian"), new Date(fromCalendar({ year: 2000, month: 1, day: 1, hour: 12 })).toISOString());
 * ```
 */
export function fromCalendar(civil: { year: number } & Partial<Omit<CivilTime, "year">>, calendar: Calendar = "auto"): number {
  const { year, month = 1, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0 } = civil;
  for (const [name, value] of Object.entries({ year, month, day, hour, minute, second, millisecond })) if (!Number.isInteger(value)) throw new RangeError(`${name} must be a whole number, got ${value}`);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59 || millisecond < 0 || millisecond > 999) throw new RangeError(`the time of day ${hour}:${minute}:${second}.${millisecond} does not exist`);
  if (day < 1 || day > daysInMonth(year, month, calendar)) throw new RangeError(`${year}-${month}-${day} does not exist in the ${calendar} calendar`);
  let gregorian = calendar === "gregorian";
  if (calendar === "auto") {
    const afterReform = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
    if (year === 1582 && month === 10 && day > 4 && day < 15) throw new RangeError(`${year}-${month}-${day} does not exist: the calendar skipped 5 to 14 October 1582`);
    gregorian = afterReform;
  }
  return (dayNumberOf(year, month, day, gregorian) - UNIX_DAY_NUMBER) * DAY_MS + hour * 3_600_000 + minute * 60_000 + second * 1000 + millisecond;
}

/**
 * The day of the week of a moment in UTC: 0 Sunday to 6 Saturday.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @returns 0 to 6.
 *
 * @example
 * ```ts
 * import { dayOfWeek } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(dayOfWeek(Date.UTC(1954, 5, 30)));
 * ```
 */
export function dayOfWeek(when: When): number {
  return floorMod(Math.floor(moment(when) / DAY_MS) + 4, 7);
}

/**
 * The day of the year of a moment in UTC: 1 on 1 January.
 * @param when - A `Date` or milliseconds since 1970 (UTC).
 * @param calendar - `auto` (default), `gregorian` or `julian`.
 * @returns 1 to 366.
 *
 * @example
 * ```ts
 * import { dayOfYear } from "@johnmorrisdotca/wakusei-planets/time";
 *
 * console.log(dayOfYear(Date.UTC(1978, 10, 14)), dayOfYear(Date.UTC(1988, 3, 22)));
 * ```
 */
export function dayOfYear(when: When, calendar: Calendar = "auto"): number {
  const ms = moment(when);
  const { year } = toCalendar(ms, calendar);
  const dayNumber = Math.floor(ms / DAY_MS) + UNIX_DAY_NUMBER;
  const gregorian = calendar === "gregorian" || (calendar === "auto" && year > 1582);
  return dayNumber - dayNumberOf(year, 1, 1, gregorian) + 1;
}
