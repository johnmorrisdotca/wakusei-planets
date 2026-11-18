import { nextAlignment, riseSetTimes, seasons } from "@johnmorrisdotca/wakusei-planets/sky";

// The equinoxes and solstices of 2026, in UTC: plain Dates, no browser, no clock read. Needs the optional peer: pnpm add astronomy-engine
const year = seasons(2026);

console.log(`Spring equinox ${year.marchEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Summer solstice ${year.juneSolstice.toISOString().slice(0, 16)}Z`);
console.log(`Autumn equinox ${year.septemberEquinox.toISOString().slice(0, 16)}Z`);
console.log(`Winter solstice ${year.decemberSolstice.toISOString().slice(0, 16)}Z`);

// Sunrise and sunset over a calendar day of a time zone (the zone is required): New York on 1 November 2026, the day the clocks go back.
const newYork = { observer: { latitude: 40.7128, longitude: -74.006 }, timeZone: "America/New_York" };
const day = riseSetTimes("sun", Date.UTC(2026, 10, 1, 12), newYork);
const clock = (date) => date.toLocaleTimeString("en-GB", { timeZone: newYork.timeZone, hour: "2-digit", minute: "2-digit" });
console.log(`Sunrise ${clock(day.rise)}, sunset ${clock(day.set)}`);

// Jupiter's opposition: its ecliptic longitude 180 degrees from the Sun's (not the closest approach of two bodies, which /nearest finds).
const opposition = nextAlignment("jupiter", Date.UTC(2026, 0, 1), { kind: "opposition" });
console.log(`Jupiter opposition ${opposition.time.toISOString().slice(0, 16)}Z`);
