// The places on the Moon and Mars: the counts of each kind pinned, every record's source, a dozen positions held to sources other than the ones the table uses for them (test/data/places-second-source.json, made by
// scripts/make-places-checks.py), the lookups and helpers, the errors a bad input gives, and that the two tables are chunks of their own which no other entry point of the package carries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import { angleBetween, findPlace, isDaylight, listPlaces, loadPlaces, localSolarTime, nearestPlace, PLACE_BODIES, placeDistanceKm, placesNear, placesOfKind, subSolarPoint, terminator, type Place, type PlaceKind } from "../src/places.ts";
import { PLACES_MOON } from "../src/places/moon.ts";
import { PLACES_MARS } from "../src/places/mars.ts";

const moon = PLACES_MOON as readonly Place[];
const mars = PLACES_MARS as readonly Place[];

const count = (places: readonly Place[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const place of places) out[place.kind] = (out[place.kind] ?? 0) + 1;
  return out;
};

test("the counts of each kind on each body are pinned", () => {
  assert.deepEqual([...PLACE_BODIES], ["moon", "mars"]);
  assert.deepEqual(count(moon), { impact: 14, crash: 35, landing: 22, crewed: 6, rover: 13, feature: 768 });
  assert.deepEqual(count(mars), { crash: 6, landing: 12, rover: 7, feature: 914 });
  assert.equal(moon.length, 858);
  assert.equal(mars.length, 939);
  assert.equal(placesOfKind(moon, "planned").length + placesOfKind(mars, "planned").length, 0, "no planned landing is held until an agency's announcement is typed in by hand");
});

test("every record has a source and a name in both languages, every id is unique, every position is on the globe", () => {
  for (const [body, places] of [["moon", moon], ["mars", mars]] as const) {
    assert.equal(new Set(places.map((p) => p.id)).size, places.length, `${body}'s ids are unique`);
    for (const place of places) {
      assert.ok(place.id.startsWith(`${body}/`), place.id);
      assert.ok(Number.isFinite(place.lat) && Number.isFinite(place.lon), place.id);
      assert.ok(place.lat >= -90 && place.lat <= 90 && place.lon >= -180 && place.lon <= 180, `${place.id} at ${place.lat}, ${place.lon}`);
      assert.ok(place.name.en.length > 0 && place.name.ja.length > 0, place.id);
      assert.ok(["iau-gazetteer", "gcat-landercat", "nssdca", "agency"].includes(place.source.id) && /^\d{4}-\d{2}-\d{2}$/.test(place.source.read), place.id);
      if (place.kind === "feature") {
        assert.equal(place.source.id, "iau-gazetteer", place.id);
        assert.ok(place.feature !== undefined && place.feature.diameterKm >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(place.feature.approved), place.id);
      } else {
        assert.notEqual(place.source.id, "iau-gazetteer", place.id);
        assert.ok(place.date !== undefined && /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}Z)?)?)?$/.test(place.date) && place.operator !== undefined && place.country !== undefined && place.mission !== undefined && place.outcome !== undefined, place.id);
        assert.ok(place.approximate === undefined || place.approximate === true, place.id);
      }
      if (place.kind === "crewed") assert.equal(place.outcome, "crewed");
    }
  }
  // the places with a position the source itself calls rough are marked so
  assert.equal(findPlace(moon, "Luna 2")!.approximate, true);
  assert.equal(findPlace(moon, "Luna 9")!.approximate, true);
  assert.equal(findPlace(moon, "Apollo 11 lunar module")!.approximate, undefined);
  assert.equal(moon.filter((p) => p.approximate).length, 17);
  assert.equal(mars.filter((p) => p.approximate).length, 5);
});

test("a dozen positions agree with sources other than the ones the table takes them from", () => {
  const fixture = JSON.parse(readFileSync(new URL("./data/places-second-source.json", import.meta.url), "utf8")) as { rows: { id: string; source: string; lat: number; lon: number }[] };
  // Luna 9's position is the first Soviet report's and NASA says the lander is not there; Viking 2 and Pathfinder differ by a few tenths of a degree between NASA's pages, which give the latitude in different conventions
  const tolerance: Record<string, number> = { "moon/luna-9": 0.8, "mars/viking-2": 0.7, "mars/mars-pathfinder": 0.4, "mars/insight": 0.06 };
  const missing = new Set(["Apollo 11", "Apollo 17", "Luna 2", "Luna 9", "Chang'e 3", "Chang'e 4", "Chang'e 5", "Chandrayaan-3", "SLIM", "Viking 1", "Curiosity", "Perseverance", "Zhurong"]);
  const worst: string[] = [];
  assert.ok(fixture.rows.length >= 20);
  for (const row of fixture.rows) {
    const place = findPlace(row.id.startsWith("moon") ? moon : mars, row.id)!;
    assert.ok(place !== undefined, row.id);
    const miss = angleBetween(place.lat, place.lon, row.lat, row.lon);
    assert.ok(miss < (tolerance[row.id] ?? 0.05), `${row.id} is ${miss} degrees from ${row.source}`);
    worst.push(`${row.id} ${miss.toFixed(3)}`);
    for (const name of [...missing]) if (place.name.en.startsWith(name) || place.id.includes(name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))) missing.delete(name);
  }
  assert.deepEqual([...missing], [], "each of the places asked for is in the fixture");
  console.log(`positions against a second source (degrees): ${worst.join(", ")}`);
});

test("the famous places are where the sources put them: Apollo 11 at Tranquility Base, Perseverance in Jezero, Chang'e 4 on the far side, Olympus Mons and Mare Imbrium", () => {
  const eagle = findPlace(moon, "Apollo 11 lunar module")!;
  assert.ok(Math.abs(eagle.lat - 0.67416) < 1e-4 && Math.abs(eagle.lon - 23.47314) < 1e-4, `${eagle.lat}, ${eagle.lon}`);
  assert.equal(eagle.kind, "crewed");
  assert.equal(eagle.site, "Statio Tranquillitatis");
  assert.ok(eagle.date?.startsWith("1969-07-20"), eagle.date);
  assert.equal(eagle.name.ja, "アポロ11号 月着陸船");
  assert.equal(eagle.source.id, "nssdca");
  const surveyor = findPlace(moon, "Surveyor 1")!;
  assert.ok(surveyor.lat < 0, "Surveyor 1 landed south of the equator (GCAT's catalogue has its latitude north; NASA's table, which the place takes, has it south)");
  const athena = findPlace(moon, "IM-2 Athena")!;
  assert.ok(athena.lon > 0, "IM-2 is east of the prime meridian");
  const percy = findPlace(mars, "Perseverance")!;
  assert.ok(Math.abs(percy.lat - 18.4446) < 0.01 && Math.abs(percy.lon - 77.4508) < 0.01);
  assert.equal(percy.kind, "rover");
  assert.equal(percy.site, "Octavia E. Butler Landing");
  const change4 = findPlace(moon, "嫦娥4号")!;
  assert.ok(change4.lon < -170 || change4.lon > 170, `Chang'e 4 is on the far side at ${change4.lon}`);
  const olympus = findPlace(mars, "Olympus Mons")!;
  assert.equal(olympus.kind, "feature");
  assert.ok(olympus.feature!.diameterKm > 500 && Math.abs(olympus.lat - 18.65) < 1 && Math.abs(olympus.lon - -133.8) < 1, `${olympus.lat}, ${olympus.lon}, ${olympus.feature!.diameterKm} km`);
  const imbrium = findPlace(moon, "mare imbrium")!;
  assert.ok(imbrium.feature!.diameterKm > 1000 && imbrium.feature!.typeWord.ja === "海");
  for (const name of ["Jezero", "Gale", "Valles Marineris", "Hellas Planitia", "Planum Boreum", "Planum Australe", "Arsia Mons", "Pavonis Mons", "Ascraeus Mons", "Cerberus Fossae"]) assert.ok(findPlace(mars, name) !== undefined, name);
  for (const name of ["Tycho", "Copernicus", "Aristarchus", "Kepler", "Shackleton", "Mare Tranquillitatis", "Oceanus Procellarum"]) assert.ok(findPlace(moon, name) !== undefined, name);
  assert.equal(findPlace(moon, "nowhere"), undefined);
  // the near places of Tranquility Base: the lunar module is within a kilometre of the point, and it is the nearest of the visited places
  const near = placesNear(moon, 0.674, 23.473, 3);
  assert.ok(near.some((n) => n.place.id === eagle.id && n.degrees < 0.04));
  assert.ok(near.every((n, i) => i === 0 || n.degrees >= near[i - 1]!.degrees));
  assert.equal(nearestPlace(moon, 0.674, 23.473, "crewed", "landing", "rover")!.place.id, eagle.id);
  assert.equal(nearestPlace(moon, 0.674, 23.473, "planned"), undefined);
  assert.equal(nearestPlace([], 0, 0), undefined);
  assert.equal(nearestPlace(mars, 18.44, 77.45, "rover")!.place.name.en, "Perseverance");
  // a distance over the surface on the body's own radius: Apollo 11 to Apollo 17 is about 8 degrees of great circle on the Moon
  const km = placeDistanceKm("moon", eagle, findPlace(moon, "Apollo 17 lunar module")!);
  assert.ok(Math.abs(km - angleBetween(eagle.lat, eagle.lon, 20.1911, 30.7723) * Math.PI / 180 * 1737.4) < 1e-6 && km > 600 && km < 700, `${km} km`);
  assert.ok(Math.abs(placeDistanceKm("mars", { lat: 0, lon: 0 }, { lat: 0, lon: 90 }) - (Math.PI / 2) * 3396.19) < 1, "a quarter of Mars's equator");
});

test("places load by body on request, by kind, and an unknown body is refused", async () => {
  assert.equal((await loadPlaces("moon")).length, 858);
  assert.equal((await loadPlaces("mars")).length, 939);
  assert.equal((await listPlaces("moon")).length, 858);
  assert.deepEqual((await listPlaces("moon", "crewed")).map((p) => p.name.en), ["Apollo 11 lunar module", "Apollo 12 lunar module", "Apollo 14 lunar module", "Apollo 15 lunar module", "Apollo 16 lunar module", "Apollo 17 lunar module"]);
  assert.deepEqual((await listPlaces("mars", "rover")).map((p) => p.name.en), ["PROP-M", "Sojourner", "Spirit", "Opportunity", "Curiosity", "Perseverance", "Zhurong"]);
  assert.equal((await listPlaces("mars", "crewed")).length, 0);
  const kinds: PlaceKind[] = ["crash", "impact"];
  assert.equal((await listPlaces("moon", ...kinds)).length, 49);
  await assert.rejects(() => loadPlaces("venus" as "moon"), RangeError);
  await assert.rejects(() => listPlaces("earth" as "moon"), RangeError);
});

test("a bad input says what is wrong", () => {
  for (const fn of [(w: number | Date) => subSolarPoint("moon", w), (w: number | Date) => terminator("mars", w, 8), (w: number | Date) => localSolarTime("moon", 0, w), (w: number | Date) => isDaylight("mars", 0, 0, w)]) {
    assert.throws(() => fn(Number.NaN), RangeError);
    assert.throws(() => fn(new Date(Number.NaN)), RangeError);
    assert.throws(() => fn("2020-01-01" as unknown as number), TypeError);
    assert.doesNotThrow(() => fn(new Date(Date.UTC(2020, 0, 1))));
  }
  assert.throws(() => angleBetween(Number.NaN, 0, 0, 0), RangeError);
  assert.throws(() => angleBetween(0, 0, 0, "1" as unknown as number), RangeError);
  assert.throws(() => placeDistanceKm("venus" as "moon", { lat: 0, lon: 0 }, { lat: 0, lon: 1 }), RangeError);
  assert.equal(findPlace(moon, 5 as unknown as string), undefined);
  assert.equal(findPlace(moon, ""), undefined);
  assert.deepEqual(placesNear(moon, 0, 0, -1), []);
});

test("the sub-solar point stays within the body's tilt, the terminator is 90 degrees from it all round, and the local solar time is noon under the Sun and midnight opposite", () => {
  for (const [id, tilt] of [["moon", 1.6], ["mars", 25.3]] as const) {
    for (let k = 0; k < 12; k += 1) {
      const when = Date.UTC(2026, 0, 1) + k * 31 * 86_400_000;
      const sun = subSolarPoint(id, when);
      assert.ok(Math.abs(sun.lat) <= tilt + 0.1, `${id}: the Sun is ${sun.lat.toFixed(2)} degrees from the equator`);
      const line = terminator(id, when, 36);
      assert.equal(line.length, 37);
      for (const p of line) assert.ok(Math.abs(angleBetween(p.lat, p.lon, sun.lat, sun.lon) - 90) < 1e-6, `${id}: a terminator point is ${angleBetween(p.lat, p.lon, sun.lat, sun.lon)} from the Sun`);
      assert.ok(Math.abs(localSolarTime(id, sun.lon, when) - 12) < 1e-9);
      assert.ok(Math.abs(localSolarTime(id, sun.lon + 180, when) % 24) < 1e-9 || Math.abs(localSolarTime(id, sun.lon + 180, when) - 24) < 1e-9);
      assert.ok(Math.abs(localSolarTime(id, sun.lon + 15, when) - 13) < 1e-9, "15 degrees east is an hour later");
      assert.equal(isDaylight(id, sun.lat, sun.lon, when), true);
      assert.equal(isDaylight(id, -sun.lat, sun.lon + 180, when), false);
    }
  }
  // the Moon's sub-solar longitude goes once round in a synodic month, eastward... that is, the Sun moves west over the Moon: the longitude falls by about 12.2 degrees a day
  const a = subSolarPoint("moon", Date.UTC(2026, 10, 11)).lon;
  const b = subSolarPoint("moon", Date.UTC(2026, 10, 12)).lon;
  const moved = ((a - b + 540) % 360) - 180;
  assert.ok(Math.abs(moved - 12.19) < 0.5, `the Sun moved ${moved.toFixed(2)} degrees west over the Moon in a day`);
});

test("the two tables are chunks of their own: no other entry point of the package carries them", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    return result.outputFiles.map((file) => file.text).join("");
  };
  // names that appear only in the tables
  const moonMarks = ["Statio Tranquillitatis", "Mare Imbrium"];
  const marsMarks = ["Octavia E. Butler Landing", "Olympus Mons"];
  const onlyMoon = await bundle(`export * from "./src/places/moon.ts";`);
  const onlyMars = await bundle(`export * from "./src/places/mars.ts";`);
  for (const mark of moonMarks) assert.ok(onlyMoon.includes(mark), `the /places/moon bundle holds the table (${mark})`);
  for (const mark of marsMarks) assert.ok(onlyMars.includes(mark), `the /places/mars bundle holds the table (${mark})`);
  for (const mark of marsMarks) assert.ok(!onlyMoon.includes(mark), `the Moon's table does not hold ${mark}`);
  for (const mark of moonMarks) assert.ok(!onlyMars.includes(mark), `the Mars table does not hold ${mark}`);
  const entries = ["./src/index.ts", "./src/space/index.ts", "./src/spacecraft.ts", "./src/nearest.ts", "./src/element.ts", "./src/space/element.ts", "./src/roadster.ts", "./src/comets.ts", "./src/time.ts", "./src/stars.ts", "./src/suncalc.ts", "./src/coordinates.ts", "./src/data-door.ts", "./src/door/index.ts"];
  for (const entry of entries) {
    const text = await bundle(`import ${JSON.stringify(entry)};`);
    for (const mark of [...moonMarks, ...marsMarks]) assert.ok(!text.includes(mark), `${entry} does not carry the places tables`);
  }
  // /places itself holds the helpers and loads a table only with a dynamic import: bundled without splitting it still keeps the tables out of the entry chunk
  const helpers = await build({ stdin: { contents: `export * from "./src/places.ts";`, resolveDir: root, loader: "ts" }, bundle: true, splitting: true, outdir: "out", format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"] });
  const entry = helpers.outputFiles.find((file) => /stdin/.test(file.path))!.text;
  for (const mark of [...moonMarks, ...marsMarks]) assert.ok(!entry.includes(mark), `the /places chunk does not hold ${mark}`);
  const raw = (name: string) => readFileSync(new URL(`../src/data/places-${name}.ts`, import.meta.url));
  console.log(`places: moon ${moon.length} records, table ${raw("moon").length} bytes raw, ${gzipSync(raw("moon"), { level: 9 }).length} gzipped; mars ${mars.length} records, ${raw("mars").length} bytes raw, ${gzipSync(raw("mars"), { level: 9 }).length} gzipped`);
  assert.ok(gzipSync(raw("moon"), { level: 9 }).length < 40_000 && gzipSync(raw("mars"), { level: 9 }).length < 40_000);
});
