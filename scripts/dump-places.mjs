// Writes every full place record of every body (the `/places/<body>` lists) as JSON on stdout, for the Python scripts that make the search lists and check ids.
// Usage: node scripts/dump-places.mjs > places.json
import { loadPlaces, PLACE_BODIES } from "../src/places.ts";

const out = {};
for (const body of PLACE_BODIES) out[body] = await loadPlaces(body);
process.stdout.write(JSON.stringify(out));
