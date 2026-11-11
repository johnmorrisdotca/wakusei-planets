// The monthly look at the planned landings: lists every planned place on the Moon and Mars whose announced date has passed (a year is passed once it has ended, a month once it has ended) and every one
// whose announcement was read more than 40 days ago, each with the page to read again. Exit code 1 when any date has passed, so a scheduled run is noticed. Reads nothing from the network.
//
// Usage: node scripts/check-planned.ts [--today 2027-01-05]
import { PLACES_MARS } from "../src/places/mars.ts";
import { PLACES_MOON } from "../src/places/moon.ts";
import type { Place } from "../src/places.ts";

const at = process.argv.indexOf("--today");
const today = at > 0 ? (process.argv[at + 1] ?? "") : new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today takes a date such as 2027-01-05, not "${today}"`);

/** The last day an announced date covers: "2027" is all of 2027, "2027-03" all of March. */
function lastDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number | undefined, number | undefined];
  if (d !== undefined) return date;
  if (m !== undefined) return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return `${y}-12-31`;
}

const DAY = 86_400_000;
const planned: Place[] = [...PLACES_MOON, ...PLACES_MARS].filter((place) => place.kind === "planned");
const passed = planned.filter((place) => lastDay(place.planned!.date) < today);
const stale = planned.filter((place) => (Date.parse(today) - Date.parse(place.planned!.read)) / DAY > 40);

console.log(`${planned.length} planned landings held; today ${today}`);
for (const place of passed) console.log(`PASSED  ${place.id}: ${place.planned!.dateOf} ${place.planned!.date} (${place.planned!.status}), read ${place.planned!.read}: ${place.source.url ?? ""}`);
for (const place of stale) if (!passed.includes(place)) console.log(`READ    ${place.id}: read ${place.planned!.read}, more than 40 days ago: ${place.source.url ?? ""}`);
if (passed.length === 0 && stale.length === 0) console.log("none has passed, and every announcement was read in the last 40 days");
process.exitCode = passed.length > 0 ? 1 : 0;
