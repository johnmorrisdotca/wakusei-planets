// The table in docs/guides/nearest.md: the least and greatest distance of each pair of planets from 1900 to 2100, in au, with the year of each; a star marks an extreme at the span's own edge, not a turning point inside it. `node scripts/distance-table.ts`.
import "../src/tables/all.ts";
import { distanceRange } from "../src/nearest.ts";
import { PLANET_IDS } from "../src/facts.ts";

const planets = PLANET_IDS.filter((id) => id !== "pluto");
const name = (id: string): string => id[0]!.toUpperCase() + id.slice(1);
console.log("| Pair | Least (au) | Year | Greatest (au) | Year |\n|---|---|---|---|---|");
for (let i = 0; i < planets.length; i += 1) {
  for (let j = i + 1; j < planets.length; j += 1) {
    const { min, max } = distanceRange(planets[i]!, planets[j]!, { from: Date.UTC(1900, 0, 1), to: Date.UTC(2100, 0, 1) });
    console.log(`| ${name(planets[i]!)} and ${name(planets[j]!)} | ${min.distanceAu.toFixed(3)} | ${min.time.getUTCFullYear()}${min.atEdge ? "*" : ""} | ${max.distanceAu.toFixed(3)} | ${max.time.getUTCFullYear()}${max.atEdge ? "*" : ""} |`);
  }
}
