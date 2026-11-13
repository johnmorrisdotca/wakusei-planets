import { skyBodies } from "@johnmorrisdotca/wakusei-planets/sky-bodies";

// Where the Sun, the Moon and the planets are over Tokyo at 21:00 on 21 June 2026 (12:00 UTC): plain data, no browser, no clock read.
const sky = skyBodies(Date.UTC(2026, 5, 21, 12), { latitude: 35.69, longitude: 139.69, heightM: 40 });
const up = sky.filter((body) => body.aboveHorizon).map((body) => body.id);
const moon = sky.find((body) => body.id === "moon");
const mars = sky.find((body) => body.id === "mars");

console.log(`Up: ${up.join(", ")}`);
console.log(`Moon: ${Math.round(moon.illuminatedFraction * 100)} per cent lit, ${moon.horizontal.altitudeDeg.toFixed(1)} degrees up`);
console.log(`Mars: magnitude ${mars.magnitude.toFixed(1)}, ${mars.elongationDeg.toFixed(0)} degrees ${mars.east ? "east" : "west"} of the Sun`);
