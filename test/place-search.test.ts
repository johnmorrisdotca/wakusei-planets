// The search lists of every point of interest on every body (`/places/search`): which bodies have one, the counts of each kind pinned, that every record has a source, that every id of 0.66.0 still resolves (test/fixtures/places-ids-0.66.0.json),
// that each full record is in its body's list, the hardware rows, the matching, and that each list is a chunk of its own which no other entry point carries.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import { PLACE_ID_ALIASES } from "../src/data/places-aliases.ts";
import { SEARCH_TYPES } from "../src/data/places-search-types.ts";
import { layerOf } from "../src/place-marks.ts";
import { loadPlaces, PLACE_BODIES, PLACES_CREDITS, type Place } from "../src/places.ts";
import { hitToPlace, loadPlaceSearch, PLACE_KIND_WORDS, PLACE_SEARCH_BODIES, placeHitUrl, readPlaceHits, resolvePlaceId, searchPlaces, SEARCH_SOURCE_IDS, type PlaceHit } from "../src/places/search.ts";

const frozen = JSON.parse(readFileSync(new URL("./fixtures/places-ids-0.66.0.json", import.meta.url), "utf8")) as Record<string, [string, number, number]>;
const lists = new Map<string, readonly PlaceHit[]>();
for (const body of PLACE_SEARCH_BODIES) lists.set(body, await loadPlaceSearch(body));
const satellites = (await loadPlaceSearch("moon", { satellites: true })).slice((lists.get("moon") as readonly PlaceHit[]).length);
const all = [...lists.values()].flat();
const count = (list: readonly PlaceHit[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const hit of list) out[hit.kind] = (out[hit.kind] ?? 0) + 1;
  return out;
};

test("every body of /places has a list, and so have 19 bodies more: 52 lists, the Moon's lettered craters in a chunk of their own", async () => {
  assert.equal(PLACE_SEARCH_BODIES.length, 52);
  assert.deepEqual([...PLACE_SEARCH_BODIES].slice(0, 33), [...PLACE_BODIES]);
  assert.deepEqual([...PLACE_SEARCH_BODIES].slice(33), ["amalthea", "dactyl", "deimos", "didymos", "dinkinesh", "donaldjohanson", "epimetheus", "gaspra", "hyperion", "ida", "itokawa", "janus", "lutetia", "mathilde", "phobos", "phoebe", "proteus", "steins", "thebe"].sort());
  assert.equal(satellites.length, 7064);
  assert.ok(satellites.every((hit) => hit.kind === "feature" && hit.type === "Satellite Feature" && hit.id.startsWith("moon/")));
  assert.equal((lists.get("moon") as readonly PlaceHit[]).filter((hit) => hit.type === "Satellite Feature").length, 0, "the plain Moon list has none of them");
  assert.equal((await loadPlaceSearch("mars", { satellites: true })).length, (lists.get("mars") as readonly PlaceHit[]).length, "satellites is for the Moon only");
  assert.equal(all.length + satellites.length, 16344);
});

test("the Gazetteer's names are all there: 16,108 features on 50 targets, from the files of 2026-11-18, and the ones with no position are not", () => {
  const features = (list: readonly PlaceHit[]) => list.filter((hit) => hit.kind === "feature");
  assert.equal(features(all).length + satellites.length, 16108);
  const of = (body: string) => features(lists.get(body) as readonly PlaceHit[]).length;
  assert.equal(of("moon") + satellites.length, 9087);
  assert.equal(of("mars"), 2054, "Mars's 2,055 rows hold one feature twice");
  assert.equal(of("venus"), 1985);
  assert.equal(of("mercury"), 613, "Mercury's 621 rows hold eight features twice");
  assert.equal(of("dione"), 98 - 3);
  for (const [body, n] of Object.entries({ titan: 304, io: 261, ganymede: 196, callisto: 154, ceres: 149, rhea: 144, europa: 129, vesta: 106, enceladus: 87, pluto: 73, iapetus: 70, triton: 63, tethys: 53, mimas: 42, eros: 41, lutetia: 37, bennu: 36, gaspra: 34 })) assert.equal(of(body), n, body);
  assert.equal(of("phobos"), 20);
  assert.equal(of("itokawa"), 17);
  assert.equal(of("dimorphos"), 11);
  for (const body of ["puck", "nix"]) assert.equal(lists.has(body), false, `${body}: every name the Gazetteer has for it is without a position`);
  const names = new Set(all.map((hit) => hit.name.en));
  for (const missing of ["Fab Dorsum", "Gleti", "Metztli", "Bogle", "Butz", "Afar Lobus", "Olduvai Lobus"]) assert.equal(names.has(missing), false, `${missing} has no position in the Gazetteer`);
  for (const hit of all) if (hit.kind === "feature") assert.ok(Number.isInteger(hit.source.ref) && (hit.source.ref as number) > 0 && hit.source.read === "2026-11-18", hit.id);
});

test("the counts of each kind are pinned: the sites and planned landings of the full lists, and the hardware", () => {
  assert.deepEqual(count(lists.get("moon") as readonly PlaceHit[]), { planned: 8, crash: 35, impact: 14, landing: 22, hardware: 10, crewed: 6, rover: 15, feature: 2023 });
  assert.deepEqual(count(lists.get("mars") as readonly PlaceHit[]), { planned: 1, hardware: 66, crash: 6, landing: 12, rover: 7, feature: 2054 });
  assert.deepEqual(count(lists.get("ryugu") as readonly PlaceHit[]), { hardware: 2, landing: 3, impact: 1, feature: 13 });
  assert.equal(all.filter((hit) => hit.kind !== "feature" && hit.kind !== "hardware").length, 158);
  assert.equal(all.filter((hit) => hit.kind === "hardware").length, 78);
});

test("every record has a source, both names, a position on the globe and its body's id; every id is unique; sites and features are sorted as documented", () => {
  const ids = new Set<string>();
  const credits = new Set(PLACES_CREDITS.map((credit) => credit.id));
  assert.deepEqual([...SEARCH_SOURCE_IDS].sort(), PLACES_CREDITS.map((credit) => credit.id).sort(), "the tables number every source that is credited, and no other");
  for (const hit of [...all, ...satellites]) {
    assert.ok(!ids.has(hit.id), `${hit.id} is twice in the lists`);
    ids.add(hit.id);
    assert.ok(hit.id.startsWith(`${hit.body}/`) && /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*$/.test(hit.id), hit.id);
    assert.ok(hit.name.en !== "" && hit.name.ja !== "" && hit.typeWord.en !== "" && hit.typeWord.ja !== "", hit.id);
    assert.ok(Math.abs(hit.lat) <= 90 && hit.lon >= -180 && hit.lon <= 180, `${hit.id} is on the globe`);
    assert.ok(credits.has(hit.source.id) && /^\d{4}-\d{2}-\d{2}$/.test(hit.source.read), `${hit.id}'s source`);
    assert.ok(hit.diameterKm >= 0, hit.id);
    assert.equal((hit.source.id === "iau-gazetteer") === (hit.kind === "feature"), true, `${hit.id}: a feature is the Gazetteer's and a site is not`);
    if (hit.kind !== "feature") assert.ok(hit.type === undefined && hit.diameterKm === 0 && hit.typeWord.en === PLACE_KIND_WORDS[hit.kind].en, hit.id);
  }
  for (const list of lists.values()) {
    const firstFeature = list.findIndex((hit) => hit.kind === "feature");
    assert.ok(firstFeature < 0 || list.slice(0, firstFeature).every((hit) => hit.kind !== "feature") && list.slice(firstFeature).every((hit) => hit.kind === "feature"), "the sites come first, then the features");
    const refs = list.filter((hit) => hit.kind === "feature").map((hit) => hit.source.ref as number);
    assert.deepEqual(refs, [...refs].sort((a, b) => a - b), "the features follow in the order of their Gazetteer ids");
  }
});

test("every place of the full lists is in its body's search list, with the same id, kind, name and position (and a feature with its size)", async () => {
  for (const body of PLACE_BODIES) {
    const full = await loadPlaces(body);
    const byId = new Map((lists.get(body) as readonly PlaceHit[]).map((hit) => [hit.id, hit]));
    for (const place of full) {
      const hit = byId.get(resolvePlaceId(place.id));
      assert.ok(hit !== undefined, `${place.id} is in the search list`);
      if (hit.id !== place.id) {
        assert.equal(hit.name.en, place.name.en, `${place.id} is an alias of the same feature`);
        continue;
      }
      assert.equal(hit.kind, place.kind, place.id);
      assert.deepEqual(hit.name, place.name, place.id);
      const tolerance = place.kind === "feature" ? 0.0011 : 1e-9;
      // a feature the shapefile holds in two parts has the centre of one part in the list and of the other in the full record (the ten ids with an alias)
      const twoParts = Object.values(PLACE_ID_ALIASES).includes(place.id);
      if (!twoParts) assert.ok(Math.abs(hit.lat - place.lat) <= tolerance && Math.abs(hit.lon - place.lon) <= tolerance + (Math.abs(place.lon) > 179.99 ? 360 : 0), `${place.id} is where the full list has it`);
      if (place.kind === "feature" && !twoParts) assert.ok(Math.abs(hit.diameterKm - (place.feature as NonNullable<Place["feature"]>).diameterKm) < 0.0051, `${place.id}'s size`);
      if (place.kind !== "feature") {
        assert.equal(hit.date, place.date, place.id);
        assert.equal(hit.source.id, place.source.id, place.id);
        assert.equal(hit.source.read, place.source.read, place.id);
        assert.equal(hit.approximate, place.approximate, place.id);
      }
    }
  }
});

test("a favourite saved with 0.66.0 still resolves: every id of that release is in a list, or is an alias of an id that is", () => {
  const ids = new Set([...all, ...satellites].map((hit) => hit.id));
  assert.equal(Object.keys(frozen).length, 4654);
  let aliased = 0;
  for (const [id, [name]] of Object.entries(frozen)) {
    const now = resolvePlaceId(id);
    if (now !== id) aliased += 1;
    assert.ok(ids.has(now), `${id} (${name}) is gone: it resolves to ${now}`);
    assert.equal((all.find((hit) => hit.id === now) as PlaceHit).name.en, name, `${id} is still ${name}`);
  }
  assert.equal(aliased, 10, "the ten ids a count had been added to, for features the Gazetteer's shapefiles hold in two parts");
  for (const [old, now] of Object.entries(PLACE_ID_ALIASES)) assert.ok(ids.has(now) && !ids.has(old), `${old} -> ${now}`);
  assert.equal(resolvePlaceId("moon/tycho"), "moon/tycho");
  assert.equal(resolvePlaceId("mercury/kunisada-2"), "mercury/kunisada");
  assert.equal(resolvePlaceId("constructor"), "constructor", "a name on Object.prototype is not an alias");
  // the ids that were told apart by a count are two different places and stay two
  for (const id of ["mars/schiaparelli", "mars/schiaparelli-2", "moon/falcon", "moon/falcon-2"]) assert.ok(ids.has(id), id);
  // a new id never carries a count: where a name is taken it carries the Gazetteer's feature id
  const dated = [...all, ...satellites].filter((hit) => hit.kind === "feature" && /-\d+$/.test(hit.id) && !(hit.id in frozen));
  const slug = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const hit of dated) assert.ok(hit.id === `${hit.body}/${slug(hit.name.en)}` || hit.id.endsWith(`-${hit.source.ref}`), `${hit.id} is its name, or carries its Gazetteer id, not a count`);
});

test("the hardware: GCAT's rows, the new kind, in the search lists only, each with its source, its date and where GCAT says it is only to a degree", async () => {
  const hardware = all.filter((hit) => hit.kind === "hardware");
  for (const body of PLACE_BODIES) assert.equal((await loadPlaces(body)).some((place) => place.kind === "hardware"), false, `${body}'s full list has no hardware`);
  for (const hit of hardware) {
    assert.equal(hit.source.id, "gcat-landercat", hit.id);
    assert.equal(hit.source.read, "2026-11-18", hit.id);
    assert.ok(hit.date !== undefined && /^\d{4}-\d{2}-\d{2}/.test(hit.date), hit.id);
    assert.deepEqual(hit.typeWord, { en: "hardware", ja: "機器・部品" });
  }
  const at = (id: string) => hardware.find((hit) => hit.id === id) as PlaceHit;
  const parachute = at("mars/perseverance-parachute");
  assert.ok(Math.abs(parachute.lat - 18.4519) < 1e-9 && Math.abs(parachute.lon - 77.432) < 1e-9 && parachute.approximate === undefined);
  assert.equal(at("mars/curiosity-cruise-stage").approximate, true, "GCAT gives the cruise stage to a degree");
  assert.equal(at("mars/mars-2-heat-shield").approximate, true);
  assert.equal(at("mars/spirit-heat-shield").lat, -14.5649);
  assert.equal(at("mars/viking-1-aeroshell").lon, -47.95, "312.05 east");
  for (const id of ["moon/apollo-11-passive-seismic-experiment-easep", "moon/apollo-11-laser-reflector-easep", "moon/apollo-12-experiment-package-alsep", "moon/apollo-14-experiment-package-alsep", "moon/apollo-14-equipment-cart-met",
    "moon/apollo-15-experiment-package-alsep", "moon/apollo-16-experiment-package-alsep", "moon/apollo-17-experiment-package-alsep", "moon/eaglecam-im-1", "moon/chang-e-6-ejected-camera-yidong-xiangji", "mars/tianwen-1-ejected-camera-fenli",
    "ryugu/hayabusa2-target-marker-a", "ryugu/hayabusa2-target-marker-b"]) assert.ok(at(id) !== undefined, id);
  assert.ok(Math.abs(at("moon/apollo-17-experiment-package-alsep").lat - 20.1923) < 1e-9);
  assert.equal(layerOf("hardware"), "landing", "a page that marks the landings marks hardware too, once a list holds some");
  const rashid = (await loadPlaces("moon")).find((place) => place.id === "moon/rashid") as Place;
  assert.ok(rashid.kind === "rover" && rashid.outcome === "hard" && rashid.source.id === "gcat-landercat" && rashid.source.read === "2026-11-18");
  assert.ok((await loadPlaces("moon")).some((place) => place.id === "moon/sora-q" && place.kind === "rover"));
});

test("the plain words of the types: every type has English and Japanese, and the new ones are the package's table's", () => {
  assert.equal(SEARCH_TYPES.length, 57);
  for (const [name, en, ja] of SEARCH_TYPES) assert.ok(name !== "" && en !== "" && ja !== "", name);
  const word = (name: string) => SEARCH_TYPES.find((type) => type[0] === name) as readonly [string, string, string];
  assert.deepEqual(word("Satellite Feature").slice(1), ["satellite crater", "付随クレーター"]);
  assert.deepEqual(word("Saxum, saxa").slice(1), ["boulder", "岩塊"]);
  assert.deepEqual(word("Lobus, lobi").slice(1), ["lobe", "ローブ"]);
  assert.deepEqual(word("Collum, colli").slice(1), ["neck", "くびれ"]);
  assert.deepEqual(word("Crater, craters").slice(1), ["crater", "クレーター"]);
  const tycho = (lists.get("moon") as readonly PlaceHit[]).find((hit) => hit.id === "moon/tycho") as PlaceHit;
  assert.deepEqual(tycho.typeWord, { en: "crater", ja: "クレーター" });
  assert.equal(tycho.name.ja, "ティコ");
  assert.equal(satellites.find((hit) => hit.id === "moon/tycho-a")?.name.ja, "Tycho A", "a lettered crater keeps its IAU name");
});

test("positions and sizes agree with the Gazetteer's files of 2026-11-18, east longitude from -180 to 180", () => {
  const at = (body: string, id: string) => (lists.get(body) as readonly PlaceHit[]).find((hit) => hit.id === id) as PlaceHit;
  const olympus = at("mars", "mars/olympus-mons");
  assert.deepEqual([olympus.lat, olympus.lon, olympus.diameterKm, olympus.source.ref], [18.653, -133.803, 610.13, 4453]);
  const tychoA = satellites.find((hit) => hit.id === "moon/tycho-a") as PlaceHit;
  assert.deepEqual([tychoA.lat, tychoA.lon, tychoA.diameterKm, tychoA.source.ref], [-39.939, -12.066, 28.96, 13551]);
  assert.equal(at("venus", "venus/maxwell-montes").lon, 3.3, "Venus's 0 to 360 east is read as -180 to 180");
  assert.equal(placeHitUrl(olympus), "https://planetarynames.wr.usgs.gov/Feature/4453");
  assert.equal(placeHitUrl(at("mars", "mars/perseverance-parachute")), undefined);
});

test("search: the whole name first, then a name that starts with the text, then a word, then any name that holds it; Japanese and accents; kinds; the limit", async () => {
  const moon = await loadPlaceSearch("moon", { satellites: true });
  assert.deepEqual(searchPlaces(moon, "tycho", { limit: 3 }).map((hit) => hit.id), ["moon/tycho", "moon/tycho-a", "moon/tycho-d"]);
  assert.equal(searchPlaces(moon, "  TYCHO ")[0]?.id, "moon/tycho", "case and spaces");
  assert.equal(searchPlaces(moon, "静かの海")[0]?.id, "moon/mare-tranquillitatis");
  assert.equal(searchPlaces(moon, "mare tranquillitatis")[0]?.id, "moon/mare-tranquillitatis");
  assert.deepEqual(searchPlaces(moon, "apollo 11").slice(0, 3).map((hit) => hit.kind), ["crewed", "hardware", "hardware"], "the visited sites come before features");
  assert.equal(searchPlaces(moon, "tycho").length, 20);
  assert.equal(searchPlaces(moon, "tycho", { limit: 100 }).length > 20, true);
  assert.deepEqual(searchPlaces(moon, "tycho", { kinds: ["crash", "rover"] }), []);
  assert.deepEqual(searchPlaces(moon, ""), []);
  assert.deepEqual(searchPlaces(moon, "   "), []);
  assert.deepEqual(searchPlaces(moon, "zzzzqqqq"), []);
  const accented = [...all, ...satellites].find((hit) => hit.name.en.normalize("NFD") !== hit.name.en && /^[A-Za-zÀ-ÿ' ]+$/.test(hit.name.en)) as PlaceHit;
  const plain = accented.name.en.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  assert.ok(searchPlaces([...all, ...satellites], plain, { limit: 50 }).some((hit) => hit.id === accented.id), `${accented.name.en} is found as ${plain}`);
  const word = searchPlaces(moon, "lunar module", { limit: 10 });
  assert.ok(word.length >= 6 && word.every((hit) => hit.name.en.toLowerCase().includes("lunar module")));
  const apollo = searchPlaces(all, "apollo", { limit: 200 });
  assert.ok(apollo.some((hit) => hit.body === "moon") && apollo.length >= 20, "the lists of several bodies make one search");
});

test("a hit as a place: the record the package's other parts take; a table is read as documented; the units are right", () => {
  const olympus = (lists.get("mars") as readonly PlaceHit[]).find((hit) => hit.id === "mars/olympus-mons") as PlaceHit;
  const place = hitToPlace(olympus);
  assert.deepEqual([place.id, place.kind, place.lat, place.lon, place.feature?.type, place.feature?.diameterKm, place.feature?.approved, place.source.url], ["mars/olympus-mons", "feature", 18.653, -133.803, "Mons, montes", 610.13, "", "https://planetarynames.wr.usgs.gov/Feature/4453"]);
  const rashid = hitToPlace((lists.get("moon") as readonly PlaceHit[]).find((hit) => hit.id === "moon/rashid") as PlaceHit);
  assert.ok(rashid.feature === undefined && rashid.date === "2023-04-25T16:40Z" && rashid.source.url === undefined);
  const approx = hitToPlace((lists.get("moon") as readonly PlaceHit[]).find((hit) => hit.approximate === true) as PlaceHit);
  assert.equal(approx.approximate, true);
  const read = readPlaceHits("moon", "2026-11-18\n\tf\tTycho\tティコ\t6\t-43.31\t-11.36\t85\t6163\n\tf\tAristarchus\t\t6\t23.7\t-47.4\t40\t10\nA/b-c\tr\tX Y\t\t\t1\t2\t\t2@2026-01-02\t2025-01-01\ta");
  assert.deepEqual(read.map((hit) => hit.id), ["moon/tycho", "moon/aristarchus", "A/b-c"]);
  assert.deepEqual(read.map((hit) => hit.source.ref), [6163, 6173, undefined], "a feature's Gazetteer id is the step from the one before");
  assert.deepEqual(read[1]?.name, { en: "Aristarchus", ja: "Aristarchus" });
  assert.deepEqual([read[2]?.source.id, read[2]?.source.read, read[2]?.date, read[2]?.approximate, read[2]?.body], ["nssdca", "2026-01-02", "2025-01-01", true, "A"]);
});

test("the lists are lazy: a page that imports the loader does not carry a body's list, and each list is a chunk of its own with a size within the budget", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string, splitting: boolean) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, splitting, format: "esm", minify: true, outdir: "out", write: false, logLevel: "silent", platform: "browser", target: "es2020" });
    return result.outputFiles.map((file) => ({ path: file.path, text: file.text, gzip: gzipSync(file.contents, { level: 9 }).length }));
  };
  const lazy = await bundle(`import { loadPlaceSearch } from "./src/places/search.ts"; loadPlaceSearch("moon").then(console.log);`, true);
  const entry = lazy.find((file) => !/\/chunk-/.test(file.path)) as (typeof lazy)[number];
  assert.ok(!entry.text.includes("Mare Tranquillitatis") && !entry.text.includes("Olympus Mons"), "the entry holds no list");
  assert.ok(entry.gzip < 8_000, `the loader is ${entry.gzip} bytes gzipped`);
  assert.equal(lazy.filter((file) => file.text.includes("Mare Tranquillitatis")).length, 1, "the Moon's list is one chunk");
  const solo = async (body: string) => (await bundle(`export * from "./src/places/search/${body}.ts";`, false))[0] as (typeof lazy)[number];
  const moon = await solo("moon");
  const satellitesChunk = await solo("moon-satellites");
  const mars = await solo("mars");
  console.log(`search lists gzipped: moon ${moon.gzip}, moon-satellites ${satellitesChunk.gzip}, mars ${mars.gzip}`);
  assert.ok(moon.gzip < 48_000 && mars.gzip < 45_000 && satellitesChunk.gzip < 105_000);
  assert.ok(!moon.text.includes("Tycho A"), "the plain Moon list holds no lettered crater");
  const places = await bundle(`export * from "./src/places.ts";`, true);
  assert.ok(!(places.find((file) => !/\/chunk-/.test(file.path)) as (typeof lazy)[number]).text.includes("Tranquillitatis"), "/places holds no table");
});
