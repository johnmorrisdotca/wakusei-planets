import { lineupBodies, lineupText } from "@johnmorrisdotca/wakusei-planets";

// The table of radii needs no browser: the largest known stars, smallest first, with the error and the source of each.
const largest = lineupBodies({ set: "largest" }).at(-1);
const text = lineupText(largest, "en");

console.log(`${text.name}: ${text.radius}, ${text.km}, ${text.source}`);
