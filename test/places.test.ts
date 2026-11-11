// The places on the Moon and Mars and 31 other bodies: the counts of each kind pinned, every record's source, a dozen positions held to sources other than the ones the table uses for them (test/data/places-second-source.json, made by
// scripts/make-places-checks.py), the lookups and helpers, the errors a bad input gives, and that every table is a chunk of its own which no other entry point of the package carries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import { angleBetween, findPlace, PLACES_CREDITS, isDaylight, listPlaces, loadPlaces, localSolarTime, nearestPlace, PLACE_BODIES, placeDistanceKm, placesNear, placesOfKind, subSolarPoint, terminator, type Place, type PlaceBody, type PlaceKind } from "../src/places.ts";
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
  assert.equal(PLACE_BODIES.length, 33);
  assert.deepEqual([...PLACE_BODIES].slice(0, 4), ["moon", "mars", "mercury", "venus"]);
  assert.deepEqual(count(moon), { impact: 14, crash: 35, landing: 22, crewed: 6, rover: 13, planned: 8, feature: 768 });
  assert.deepEqual(count(mars), { crash: 6, landing: 12, rover: 7, planned: 1, feature: 914 });
  assert.equal(moon.length, 866);
  assert.equal(mars.length, 940);
});

test("every record has a source and a name in both languages, every id is unique, every position is on the globe", () => {
  for (const [body, places] of [["moon", moon], ["mars", mars]] as const) {
    assert.equal(new Set(places.map((p) => p.id)).size, places.length, `${body}'s ids are unique`);
    for (const place of places) {
      assert.ok(place.id.startsWith(`${body}/`), place.id);
      assert.ok(Number.isFinite(place.lat) && Number.isFinite(place.lon), place.id);
      assert.ok(place.lat >= -90 && place.lat <= 90 && place.lon >= -180 && place.lon <= 180, `${place.id} at ${place.lat}, ${place.lon}`);
      assert.ok(place.name.en.length > 0 && place.name.ja.length > 0, place.id);
      assert.ok(["iau-gazetteer", "gcat-landercat", "nssdca", "pds-ode", "nasa-mars24", "agency", "nasa-ntrs", "pds-atmospheres", "paper", "announcement"].includes(place.source.id) && /^\d{4}-\d{2}-\d{2}$/.test(place.source.read), place.id);
      if (place.kind === "feature") {
        assert.equal(place.source.id, "iau-gazetteer", place.id);
        assert.ok(place.feature !== undefined && place.feature.diameterKm >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(place.feature.approved), place.id);
      } else if (place.kind === "planned") {
        assert.ok(place.planned !== undefined && place.operator !== undefined && place.mission !== undefined, place.id);
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
  assert.equal(moon.filter((p) => p.approximate).length, 25);
  assert.equal(mars.filter((p) => p.approximate).length, 6);
  // every Mars lander says how its latitude stands; the Gazetteer's features are planetocentric
  for (const p of mars) assert.ok(p.kind === "feature" || ["planetocentric", "converted", "not stated"].includes(p.source.latitude ?? ""), p.id);
  assert.equal(findPlace(mars, "Phoenix")!.source.latitude, "converted");
  assert.ok(Math.abs(findPlace(mars, "Phoenix")!.lat - 67.986) < 0.01, "Phoenix's 68.22 is planetographic, 67.99 planetocentric");
  assert.ok(Math.abs(findPlace(mars, "Mars Pathfinder")!.lat - 19.095) < 1e-4 && Math.abs(findPlace(mars, "InSight")!.lat - 4.5) < 1e-4);
  assert.equal(findPlace(mars, "Viking 1")!.lat, 22.27);
});

test("every source the tables use has a credit, and the lander catalogue's is the line its licence asks for", () => {
  const used = new Set([...moon, ...mars].map((p) => p.source.id));
  for (const id of used) assert.ok(PLACES_CREDITS.some((credit) => credit.id === id && credit.line.length > 0 && credit.url.startsWith("https://")), `a credit for ${id}`);
  assert.equal(PLACES_CREDITS.find((c) => c.id === "gcat-landercat")!.line, "data from GCAT (J. McDowell, planet4589.org/space/gcat)");
  assert.equal(PLACES_CREDITS.find((c) => c.id === "gcat-landercat")!.licence, "CC BY 4.0");
});

test("a dozen positions agree with sources other than the ones the table takes them from", () => {
  const fixture = JSON.parse(readFileSync(new URL("./data/places-second-source.json", import.meta.url), "utf8")) as { rows: { id: string; source: string; lat: number; lon: number; convertFrom?: string }[] };
  // Luna 9's position is the first Soviet report's and NASA says the lander is not there; NSSDCA's Pathfinder point is an estimate from Viking pictures made before the landing (its longitude is 0.3 degree west of the radio-tracked one); the rest agree to 0.011 degree
  const tolerance: Record<string, number> = { "moon/luna-9": 0.8, "mars/mars-pathfinder": 0.3 };
  const RATIO = (3376.2 / 3396.19) ** 2;
  const missing = new Set(["Apollo 11", "Apollo 17", "Luna 2", "Luna 9", "Chang'e 3", "Chang'e 4", "Chang'e 5", "Chandrayaan-3", "SLIM", "Viking 1", "Curiosity", "Perseverance", "Zhurong"]);
  const worst: string[] = [];
  assert.ok(fixture.rows.length >= 20);
  for (const row of fixture.rows) {
    const place = findPlace(row.id.startsWith("moon") ? moon : mars, row.id)!;
    assert.ok(place !== undefined, row.id);
    // a row that prints a planetographic latitude is turned into a planetocentric one first, as the table's own are
    const lat = row.convertFrom === "planetographic" ? (Math.atan(RATIO * Math.tan((row.lat * Math.PI) / 180)) * 180) / Math.PI : row.lat;
    const miss = angleBetween(place.lat, place.lon, lat, row.lon);
    assert.ok(miss < (tolerance[row.id] ?? 0.012), `${row.id} is ${miss} degrees from ${row.source}`);
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
  assert.equal(nearestPlace(moon, 7.4, -59, "planned")!.place.id, "moon/im-3");
  assert.equal(nearestPlace([], 0, 0), undefined);
  assert.equal(nearestPlace(mars, 18.44, 77.45, "rover")!.place.name.en, "Perseverance");
  // a distance over the surface on the body's own radius: Apollo 11 to Apollo 17 is about 8 degrees of great circle on the Moon
  const km = placeDistanceKm("moon", eagle, findPlace(moon, "Apollo 17 lunar module")!);
  assert.ok(Math.abs(km - angleBetween(eagle.lat, eagle.lon, 20.1911, 30.7723) * Math.PI / 180 * 1737.4) < 1e-6 && km > 600 && km < 700, `${km} km`);
  assert.ok(Math.abs(placeDistanceKm("mars", { lat: 0, lon: 0 }, { lat: 0, lon: 90 }) - (Math.PI / 2) * 3396.19) < 1, "a quarter of Mars's equator");
});

test("features with a Japanese name are found by it and by the Latin one; the rest keep the IAU's Latin name", () => {
  const tranquility = findPlace(moon, "静かの海")!;
  assert.equal(tranquility.id, "moon/mare-tranquillitatis");
  assert.equal(findPlace(moon, "Mare Tranquillitatis"), tranquility);
  assert.equal(findPlace(moon, "mare tranquillitatis"), tranquility);
  assert.equal(findPlace(mars, "オリンポス山")!.name.en, "Olympus Mons");
  assert.equal(findPlace(mars, "Olympus Mons")!.name.ja, "オリンポス山");
  assert.equal(findPlace(moon, "嵐の大洋")!.name.en, "Oceanus Procellarum");
  assert.equal(findPlace(moon, "アルプス谷")!.name.en, "Vallis Alpes");
  assert.equal(findPlace(moon, "ティコ")!.name.en, "Tycho");
  assert.equal(findPlace(mars, "マリネリス峡谷")!.name.en, "Valles Marineris");
  assert.equal(findPlace(mars, "ヘラス平原")!.kind, "feature");
  // every mare has its usual Japanese name
  for (const mare of moon.filter((p) => p.feature?.type === "Mare, maria")) assert.notEqual(mare.name.ja, mare.name.en, mare.name.en);
  // the named count
  assert.equal(moon.filter((p) => p.kind === "feature" && p.name.ja !== p.name.en).length, 126);
  assert.equal(mars.filter((p) => p.kind === "feature" && p.name.ja !== p.name.en).length, 38);
  // a feature without a Japanese name has the Latin name for it, and every type has a Japanese word
  assert.equal(findPlace(moon, "Lacus Excellentiae")!.name.ja, "Lacus Excellentiae");
  for (const p of [...moon, ...mars]) if (p.kind === "feature") assert.ok(/[ぁ-んァ-ヶ一-龠]/.test(p.feature!.typeWord.ja), `${p.id}: ${p.feature!.typeWord.ja}`);
  assert.equal(findPlace(moon, "Statio Tranquillitatis")!.feature!.typeWord.ja, "着陸地点");
  assert.equal(findPlace(mars, "Perseverance")!.name.ja, "パーシビアランス");
});

test("places load by body on request, by kind, and an unknown body is refused", async () => {
  assert.equal((await loadPlaces("moon")).length, 866);
  assert.equal((await loadPlaces("mars")).length, 940);
  assert.equal((await listPlaces("moon")).length, 866);
  assert.deepEqual((await listPlaces("moon", "crewed")).map((p) => p.name.en), ["Apollo 11 lunar module", "Apollo 12 lunar module", "Apollo 14 lunar module", "Apollo 15 lunar module", "Apollo 16 lunar module", "Apollo 17 lunar module"]);
  assert.deepEqual((await listPlaces("mars", "rover")).map((p) => p.name.en), ["PROP-M", "Sojourner", "Spirit", "Opportunity", "Curiosity", "Perseverance", "Zhurong"]);
  assert.equal((await listPlaces("mars", "crewed")).length, 0);
  const kinds: PlaceKind[] = ["crash", "impact"];
  assert.equal((await listPlaces("moon", ...kinds)).length, 49);
  await assert.rejects(() => loadPlaces("earth" as "moon"), RangeError);
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
  assert.throws(() => placeDistanceKm("earth" as "moon", { lat: 0, lon: 0 }, { lat: 0, lon: 1 }), RangeError);
  assert.throws(() => placeDistanceKm("eros", { lat: 0, lon: 0 }, { lat: 0, lon: 1 }), RangeError, "an irregular body has no radius to measure over");
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

// ---- the other 31 bodies ----------------------------------------------------------------------------------------------------------------------------------------------------------------

// each body's table: how many places of each kind (made by scripts/make-places-more-data.py from the Gazetteer's files of 2026-11-11 and the sources named in NOTICE.md), and how many are marked famous
const OTHER: Record<string, { kinds: Record<string, number>; famous: number }> = {
  mercury: { kinds: { crash: 1, feature: 401 }, famous: 11 }, venus: { kinds: { entry: 4, landing: 11, crash: 3, feature: 386 }, famous: 13 }, io: { kinds: { feature: 261 }, famous: 8 }, europa: { kinds: { feature: 129 }, famous: 9 },
  ganymede: { kinds: { feature: 196 }, famous: 9 }, callisto: { kinds: { feature: 154 }, famous: 4 }, titan: { kinds: { landing: 1, feature: 304 }, famous: 15 }, enceladus: { kinds: { feature: 87 }, famous: 7 },
  mimas: { kinds: { feature: 42 }, famous: 1 }, tethys: { kinds: { feature: 53 }, famous: 2 }, dione: { kinds: { feature: 98 }, famous: 3 }, rhea: { kinds: { feature: 144 }, famous: 4 }, iapetus: { kinds: { feature: 70 }, famous: 5 },
  miranda: { kinds: { feature: 18 }, famous: 4 }, ariel: { kinds: { feature: 26 }, famous: 3 }, umbriel: { kinds: { feature: 13 }, famous: 3 }, titania: { kinds: { feature: 18 }, famous: 3 }, oberon: { kinds: { feature: 10 }, famous: 4 },
  triton: { kinds: { feature: 63 }, famous: 7 }, pluto: { kinds: { feature: 73 }, famous: 7 }, charon: { kinds: { feature: 15 }, famous: 3 }, ceres: { kinds: { feature: 149 }, famous: 8 }, vesta: { kinds: { feature: 106 }, famous: 5 },
  eros: { kinds: { landing: 1 }, famous: 1 }, ryugu: { kinds: { landing: 3, impact: 1 }, famous: 2 }, bennu: { kinds: { landing: 1 }, famous: 1 }, dimorphos: { kinds: { impact: 1 }, famous: 1 },
  "tempel-1": { kinds: { impact: 1 }, famous: 1 }, "67p": { kinds: { landing: 1 }, famous: 1 }, jupiter: { kinds: { entry: 2 }, famous: 1 }, saturn: { kinds: { entry: 1 }, famous: 1 },
};

const tables: Record<string, readonly Place[]> = {};
for (const body of PLACE_BODIES) tables[body] = await loadPlaces(body as PlaceBody);

test("every body's table has the counts pinned, its own ids, a name in both languages, a position on the globe and a credited source", () => {
  assert.deepEqual(Object.keys(OTHER), PLACE_BODIES.filter((b) => b !== "moon" && b !== "mars"));
  const credited = new Set(PLACES_CREDITS.map((credit) => credit.id));
  for (const [body, want] of Object.entries(OTHER)) {
    const list = tables[body]!;
    assert.deepEqual(count(list), want.kinds, `${body}'s counts`);
    assert.equal(list.filter((p) => p.famous).length, want.famous, `${body}'s famous places`);
    assert.equal(new Set(list.map((p) => p.id)).size, list.length, `${body}'s ids are unique`);
    for (const place of list) {
      assert.ok(place.id.startsWith(`${body}/`), place.id);
      assert.ok(place.lat >= -90 && place.lat <= 90 && place.lon >= -180 && place.lon <= 180, `${place.id} at ${place.lat}, ${place.lon}`);
      assert.ok(place.name.en.length > 0 && place.name.ja.length > 0, place.id);
      assert.ok(credited.has(place.source.id) && /^\d{4}-\d{2}-\d{2}$/.test(place.source.read), `${place.id} has a credited source`);
      assert.ok(place.famous === undefined || place.famous === true, place.id);
      if (place.kind === "feature") {
        assert.equal(place.source.id, "iau-gazetteer", place.id);
        assert.ok(place.feature !== undefined && place.feature.diameterKm >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(place.feature.approved) && /[ぁ-んァ-ヶ一-龠]/.test(place.feature.typeWord.ja), place.id);
        assert.ok(typeof place.origin === "string" && place.origin.length > 0, `${place.id} says where its name comes from`);
      } else {
        assert.notEqual(place.source.id, "iau-gazetteer", place.id);
        assert.ok(place.date !== undefined && /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}Z)?)?)?$/.test(place.date) && place.operator !== undefined && place.country !== undefined && place.mission !== undefined && place.outcome !== undefined, place.id);
        assert.ok(["landing", "crash", "impact", "entry"].includes(place.kind), place.id);
        assert.equal(place.outcome, { landing: "soft", crash: "hard", impact: "impact", entry: "entry" }[place.kind as "landing"], `${place.id}'s outcome follows its kind`);
        if (place.source.id !== "gcat-landercat" && place.source.id !== "nssdca") assert.ok(place.source.url !== undefined && place.source.url.startsWith("https://"), `${place.id} names the page it is typed from`);
      }
    }
    // the sites come first, by date, then the features by size
    const sites = list.filter((p) => p.kind !== "feature");
    assert.deepEqual(list.slice(0, sites.length), sites, `${body}: sites first`);
    assert.deepEqual(sites.map((p) => p.date), [...sites.map((p) => p.date)].sort(), `${body}: sites by date`);
    const sizes = list.slice(sites.length).map((p) => p.feature!.diameterKm);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a), `${body}: features by size`);
  }
  // only atmospheres give entries, and only the bodies with a surface in it give landings
  for (const [body, list] of Object.entries(tables)) if (placesOfKind(list, "entry").length > 0) assert.ok(["venus", "jupiter", "saturn"].includes(body), body);
  // every source used by any table has a credit
  const used = new Set(Object.values(tables).flatMap((list) => list.map((p) => p.source.id)));
  assert.deepEqual([...used].sort(), ["agency", "announcement", "gcat-landercat", "iau-gazetteer", "nasa-mars24", "nasa-ntrs", "nssdca", "paper", "pds-atmospheres", "pds-ode"].filter((id) => used.has(id as Place["source"]["id"])));
  for (const id of used) assert.ok(credited.has(id), `a credit for ${id}`);
});

test("the cuts: bodies with up to 400 named features keep them all, Mercury keeps the 400 largest, Venus the 25 largest of each type, and the famous ones are always in", () => {
  // the Gazetteer's own counts on 2026-11-11 (a file of that day): Mercury 621, Venus 1985, Titan 304, Io 261, the rest fewer
  const features = (body: string) => tables[body]!.filter((p) => p.kind === "feature");
  assert.equal(features("titan").length, 304);
  assert.equal(features("io").length, 261);
  const mercury = features("mercury");
  assert.ok(mercury.length >= 400 && mercury.length <= 402, `${mercury.length} on Mercury`);
  assert.ok(mercury.filter((p) => !p.famous).every((p) => p.feature!.diameterKm >= 69), "every Mercury feature not famous is 69 km or more");
  const venus = features("venus");
  const perType = new Map<string, number>();
  for (const p of venus) perType.set(p.feature!.type, (perType.get(p.feature!.type) ?? 0) + 1);
  assert.ok(perType.size >= 20, "Venus keeps every type");
  for (const [type, n] of perType) assert.ok(n <= 25 + 5, `${type} has ${n} on Venus`);
  assert.equal(findPlace(tables.venus!, "Maxwell Montes")!.famous, true);
  assert.ok(venus.length < 450);
});

test("famous places: modest, on every body, the names a reader knows, on the Moon and Mars as well", () => {
  const famous = (list: readonly Place[]) => list.filter((p) => p.famous).map((p) => p.name.en);
  assert.equal(famous(moon).length, 30);
  assert.equal(famous(mars).length, 28);
  for (const name of ["Apollo 11 lunar module", "Apollo 17 lunar module", "Tycho", "Copernicus", "Shackleton", "Mare Tranquillitatis", "Chang'e 4"]) assert.ok(famous(moon).includes(name), name);
  for (const name of ["Olympus Mons", "Valles Marineris", "Gale", "Jezero", "Perseverance", "Curiosity", "Viking 1"]) assert.ok(famous(mars).includes(name), name);
  assert.ok(famous(tables.venus!).includes("Maxwell Montes") && famous(tables.venus!).includes("Venera 9"));
  assert.ok(famous(tables.mercury!).includes("Caloris Planitia") && famous(tables.mercury!).includes("MESSENGER impact"));
  assert.ok(famous(tables.pluto!).includes("Sputnik Planitia") && famous(tables.ceres!).includes("Occator") && famous(tables.titan!).includes("Huygens"));
  for (const [body, list] of Object.entries(tables)) {
    assert.ok(famous(list).length >= 1, `${body} has a famous place`);
    assert.ok(famous(list).length <= 30, `${body}'s list is modest`);
    assert.ok(list.filter((p) => p.famous).length <= list.length / 3 + 3, `${body}: not most of the table`);
  }
});

test("positions on the other bodies agree with what the sources say, east longitude from -180 to 180", () => {
  const at = (body: string, name: string) => findPlace(tables[body]!, name)!;
  // features (the Gazetteer's centre points, east longitude, planetocentric latitude)
  const maxwell = at("venus", "Maxwell Montes");
  assert.ok(Math.abs(maxwell.lat - 65.2) < 0.01 && Math.abs(maxwell.lon - 3.3) < 0.01 && maxwell.feature!.diameterKm === 797);
  const maat = at("venus", "Maat Mons");
  assert.ok(Math.abs(maat.lat - 0.5) < 0.01 && Math.abs(maat.lon - (194.6 - 360)) < 0.01, "194.6 east is -165.4");
  const sputnik = at("pluto", "Sputnik Planitia");
  assert.ok(Math.abs(sputnik.lat - 19.51) < 0.01 && Math.abs(sputnik.lon - 178.69) < 0.01 && sputnik.feature!.diameterKm === 1492);
  const occator = at("ceres", "Occator");
  assert.ok(Math.abs(occator.lat - 19.82) < 0.01 && Math.abs(occator.lon - (239.335 - 360)) < 0.01, `${occator.lon}`);
  const loki = at("io", "Loki Patera");
  assert.ok(Math.abs(loki.lat - 13.008) < 0.01 && Math.abs(loki.lon - 51.2136) < 0.01);
  assert.ok(Math.abs(at("titan", "Kraken Mare").lat - 68) < 1e-6 && Math.abs(at("titan", "Kraken Mare").lon - 50) < 1e-6);
  assert.ok(Math.abs(at("vesta", "Rheasilvia").lat - -71.95) < 0.01 && Math.abs(at("vesta", "Rheasilvia").lon - 86.3) < 0.01);
  assert.ok(at("mercury", "Caloris Planitia").feature!.diameterKm === 1500 && at("mercury", "Tolstoj").feature!.diameterKm === 355);
  // the first of a pair is the one with the size the Gazetteer gives
  assert.equal(at("io", "Pele").feature!.typeWord.en, "eruptive centre");
  // Venus's landers: Basilevsky and Weitz's Magellan-updated positions where they have one (and the catalogue's kept beside), GCAT's where not
  const venera9 = at("venus", "Venera 9");
  assert.ok(Math.abs(venera9.lat - 31.01) < 1e-6 && Math.abs(venera9.lon - (291.64 - 360)) < 1e-6 && venera9.source.id === "nasa-ntrs" && venera9.gcatPosition !== undefined, "Venera 9's position is the paper's");
  assert.ok(angleBetween(venera9.lat, venera9.lon, venera9.gcatPosition![0], venera9.gcatPosition![1]) > 0.5, "GCAT's is more than half a degree away (a degree on Venus is 106 km)");
  const venera8 = at("venus", "Venera 8");
  assert.equal(venera8.gcatPosition, undefined, "the paper and the catalogue agree on Venera 8");
  assert.equal(at("venus", "Venera 7").source.id, "gcat-landercat");
  assert.equal(at("venus", "Venera 7").approximate, true);
  assert.equal(at("venus", "Venera 13").approximate, undefined);
  assert.equal(at("venus", "Venera 13").date, "1982-03-01T03:57Z", "a catalogue date with a single-digit day keeps its day");
  assert.equal(findPlace(mars, "Mars 3 lander")!.date, "1971-12-02T13:47Z", "Mars 3's single-digit day is kept");
  assert.equal(at("venus", "Venera 4").kind, "entry");
  // Pioneer Venus: the PDS's impact positions (GCAT has the North Probe's latitude and longitude the wrong way round)
  const north = at("venus", "Pioneer Venus North Probe");
  assert.ok(Math.abs(north.lat - 59.3) < 1e-6 && Math.abs(north.lon - 4.8) < 1e-6 && north.kind === "crash");
  assert.deepEqual(north.gcatPosition, [4.4, 60.1]);
  assert.equal(at("venus", "Pioneer Venus Day Probe").kind, "landing");
  assert.ok(Math.abs(at("venus", "Pioneer Venus Large Probe").lon - (304 - 360)) < 1e-6);
  // the other sites
  const messenger = at("mercury", "MESSENGER impact");
  assert.ok(Math.abs(messenger.lat - 54.4398) < 1e-6 && Math.abs(messenger.lon - (210.1205 - 360)) < 1e-6 && messenger.date === "2015-04-30T19:26Z" && messenger.kind === "crash");
  const huygens = at("titan", "Huygens");
  assert.ok(Math.abs(huygens.lat - -10.3) < 1e-6 && Math.abs(huygens.lon - 167.7) < 1e-6 && huygens.date === "2005-01-14T11:38Z" && huygens.kind === "landing", "192.3 west is 167.7 east");
  const dart = at("dimorphos", "DART");
  assert.ok(Math.abs(dart.lat - -8.84) < 1e-6 && Math.abs(dart.lon - (264.3 - 360)) < 1e-6 && dart.kind === "impact" && dart.date === "2022-09-26T23:14Z" && dart.source.id === "paper");
  const cassini = at("saturn", "Cassini");
  assert.ok(Math.abs(cassini.lat - 9.4) < 1e-6 && Math.abs(cassini.lon - -53) < 1e-6 && cassini.kind === "entry" && cassini.date === "2017-09-15T10:45Z");
  const galileo = at("jupiter", "Galileo probe");
  assert.ok(Math.abs(galileo.lat - 6.5) < 1e-6 && Math.abs(galileo.lon - -4.4) < 1e-6 && galileo.date === "1995-12-07T22:04Z");
  const nightingale = at("bennu", "OSIRIS-REx");
  assert.ok(nightingale.site === "Nightingale" && Math.abs(nightingale.lat - 56) < 1e-6 && Math.abs(nightingale.lon - 43) < 1e-6 && nightingale.approximate === true);
  assert.deepEqual(tables.ryugu!.map((p) => p.name.en), ["MASCOT", "Hayabusa2 first touchdown", "SCI impact", "Hayabusa2 second touchdown"]);
  assert.equal(at("ryugu", "SCI impact").kind, "impact");
  assert.equal(at("eros", "NEAR Shoemaker").date, "2001-02-12T20:01Z");
  assert.equal(at("tempel-1", "Deep Impact impactor").source.frame?.startsWith("the comet's shape-model frame"), true);
  assert.equal(at("67p", "Philae at Abydos").site, "Abydos");
  // a Japanese name finds its place, the Latin one too
  assert.equal(findPlace(tables.pluto!, "スプートニク平原"), sputnik);
  assert.equal(findPlace(tables.venus!, "ベネラ9号"), venera9);
  assert.equal(findPlace(tables.mercury!, "メッセンジャー 衝突地点"), messenger);
  // distances on a body with a radius in BODIES: Venus's equator, a quarter of the way round
  assert.ok(Math.abs(placeDistanceKm("venus", { lat: 0, lon: 0 }, { lat: 0, lon: 90 }) - (Math.PI / 2) * 6051.8) < 1);
  assert.ok(placeDistanceKm("titan", huygens, at("titan", "Kraken Mare")) > 1000);
});

test("every other body's table is a chunk of its own: no other entry point carries it, and the sizes stay small", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".ts": "ts" } });
    return result.outputFiles.map((file) => file.text).join("");
  };
  const marks: Record<string, string> = { venus: "Maxwell Montes", pluto: "Sputnik Planitia", titan: "Kraken Mare", io: "Loki Patera", ceres: "Ahuna Mons", mercury: "Caloris Planitia", dimorphos: "the kinetic impactor" };
  const own = {} as Record<string, string>;
  for (const [body, mark] of Object.entries(marks)) {
    own[body] = await bundle(`export * from "./src/places/${body}.ts";`);
    assert.ok(own[body]!.includes(mark), `the /places/${body} bundle holds its table (${mark})`);
  }
  for (const [body, text] of Object.entries(own)) for (const [other, mark] of Object.entries(marks)) if (other !== body) assert.ok(!text.includes(mark), `the ${body} table does not hold ${other}'s ${mark}`);
  for (const entry of ["./src/index.ts", "./src/space/index.ts", "./src/places/moon.ts", "./src/places/mars.ts"]) {
    const text = await bundle(`import ${JSON.stringify(entry)};`);
    for (const mark of ["Maxwell Montes", "Sputnik Planitia", "Kraken Mare", "Loki Patera", "Ahuna Mons", "Caloris Planitia"]) assert.ok(!text.includes(mark), `${entry} does not carry ${mark}`);
  }
  // sizes: each table gzipped is under 40 kB, and the new ones together are 190 kB or so
  let total = 0;
  const sizes: string[] = [];
  for (const body of Object.keys(OTHER)) {
    const raw = readFileSync(new URL(`../src/data/places-${body}.ts`, import.meta.url));
    const gz = gzipSync(raw, { level: 9 }).length;
    assert.ok(gz < 40_000, `${body} is ${gz} bytes gzipped`);
    total += gz;
    if (raw.length > 20_000) sizes.push(`${body} ${raw.length}/${gz}`);
  }
  assert.ok(total < 250_000, `the new tables are ${total} bytes gzipped in all`);
  console.log(`places beyond the Moon and Mars: ${total} bytes gzipped in all; raw/gzipped of the larger: ${sizes.join(", ")}`);
});

test("a table loads on request for every body, and its list is the entry point's", async () => {
  for (const body of PLACE_BODIES) assert.equal((await loadPlaces(body)).length, tables[body]!.length, body);
  assert.deepEqual((await listPlaces("venus", "entry")).map((p) => p.name.en), ["Venera 4", "Venera 5", "Venera 6", "Pioneer Venus Bus"]);
  assert.deepEqual((await listPlaces("ryugu", "impact")).map((p) => p.name.en), ["SCI impact"]);
  assert.equal(nearestPlace(tables.venus!, 31, -68.4, "landing")!.place.name.en, "Venera 9");
  assert.equal(nearestPlace(tables.pluto!, 19.5, 178.7, "feature")!.place.name.en, "Sputnik Planitia");
});

test("the planned landings: typed from the agencies' own pages, each at a named site of the Gazetteer, marked approximate, with the date the page gives and what it is the date of", () => {
  const planned = [...placesOfKind(moon, "planned"), ...placesOfKind(mars, "planned")];
  assert.deepEqual(planned.map((p) => p.id), ["moon/griffin-mission-one", "moon/im-3", "moon/blue-moon-mk1-endurance", "moon/im-4", "moon/blue-ghost-mission-2", "moon/viper", "moon/blue-ghost-mission-3", "moon/blue-ghost-mission-4", "mars/rosalind-franklin"]);
  for (const place of planned) {
    assert.equal(place.approximate, true, place.id);
    assert.equal(place.source.id, "announcement");
    assert.ok(place.source.url?.startsWith("https://") && !/wikipedia|news/i.test(place.source.url), place.id);
    assert.ok(/^\d{4}(-\d{2})?$/.test(place.planned!.date) && ["launch", "landing"].includes(place.planned!.dateOf) && ["announced", "slipped", "cancelled"].includes(place.planned!.status), place.id);
    assert.equal(place.date, undefined, "a planned landing has no date of arrival");
    assert.ok(typeof place.site === "string");
  }
  // each sits on the centre of its named site, as the Gazetteer holds it (or as the feature in the table where it is one)
  for (const [id, feature] of [["moon/im-4", "Mons Mouton"], ["moon/viper", "Mons Mouton"], ["moon/blue-moon-mk1-endurance", "Shackleton"], ["moon/blue-ghost-mission-3", "Mons Gruithuisen Gamma"], ["mars/rosalind-franklin", "Oxia Planum"]] as const) {
    const place = [...moon, ...mars].find((p) => p.id === id)!;
    const at = findPlace(id.startsWith("moon") ? moon : mars, feature)!;
    assert.ok(angleBetween(place.lat, place.lon, at.lat, at.lon) < 1e-3, `${id} on ${feature}`);
  }
  // in each list they come after the sites and before the features
  const kinds = moon.map((p) => p.kind);
  assert.ok(kinds.indexOf("planned") > kinds.lastIndexOf("crash") && kinds.lastIndexOf("planned") < kinds.indexOf("feature"));
});
