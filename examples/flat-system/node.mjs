import { loadSpacecraft } from "@johnmorrisdotca/wakusei-planets/spacecraft";
import { squeezeAu, systemMarks } from "@johnmorrisdotca/wakusei-planets/flat/system";

// The flat solar system needs no browser: where the Tesla Roadster and the Earth are on the map for a date, and how far out the map squeezes each.
await loadSpacecraft("roadster");
const marks = systemMarks(Date.UTC(2026, 10, 17), { layers: ["planets", "craft"], craft: ["roadster"] });
const car = marks.find((mark) => mark.id === "roadster");
const earth = marks.find((mark) => mark.id === "earth");

console.log(`The Tesla Roadster is ${car.distanceAu.toFixed(2)} au from the Sun, the Earth ${earth.distanceAu.toFixed(2)} au`);
console.log(`With the edge at 50 au, the Earth is ${Math.round(squeezeAu(1, 0, 50, "squeezed").r * 100)} per cent of the way out, squeezed, and ${Math.round(squeezeAu(1, 0, 50, "true").r * 100)} per cent to scale`);
