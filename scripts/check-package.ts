// Check the built package the way a consumer would: the entry files are there, and importing the built index draws every body.
import { existsSync, readdirSync, statSync } from "node:fs";

const entries = ["coordinates", "index", "element", "scene/look", "scene/painter", "door/index", "data-door", "space/index", "space/element", "bodies/all", "bodies/sun", "bodies/jupiter", "bodies/saturn", "bodies/moons-jupiter", "roadster", "data/roadster", "comets", "data/comets", "places", "places/moon", "places/mars", "asteroids", "data/asteroids", "approaches", "data/approaches"];
for (const entry of entries) for (const ext of ["js", "d.ts"]) if (!existsSync(new URL(`../dist/${entry}.${ext}`, import.meta.url))) throw new Error(`missing dist/${entry}.${ext}`);

const mod = await import(new URL("../dist/index.js", import.meta.url).href);
let bytes = 0;
for (const id of mod.BODY_IDS as string[]) {
  const svg = mod.lineSvg(id, { size: 200 });
  if (typeof svg !== "string" || !svg.startsWith("<svg")) throw new Error(`lineSvg(${id}) did not return SVG`);
  bytes += svg.length;
}
const moon = mod.apparent("moon", Date.UTC(2026, 10, 24, 14));
if (moon.illumination < 0.95) throw new Error("the Moon is not full on 2026-11-24");
const saturn = mod.ringStrip(mod.BODIES.saturn, 128);
if (saturn === null || saturn.width !== 128) throw new Error("ringStrip is off");
console.log(`package ok: ${mod.BODY_IDS.length} bodies drawn (${(bytes / 1024).toFixed(0)} KB of SVG), full Moon found`);

// The painted looks' pictures in the package: the two smaller widths of every painted body, within the size budget (the sharpest widths are not shipped: they come from the repository).
const look = await import(new URL("../dist/scene/look.js", import.meta.url).href);
await import(new URL("../dist/bodies/all.js", import.meta.url).href);
let pictures = 0;
let pictureBytes = 0;
for (const id of mod.BODY_IDS as string[]) {
  const painted = look.lookOf(id)?.painted;
  if (painted === undefined) continue;
  for (const width of painted.widths as number[]) {
    const file = new URL(`../dist/textures/${painted.map}-${width}.webp`, import.meta.url);
    if (painted.far !== undefined && width >= painted.far) {
      if (existsSync(file)) throw new Error(`${painted.map}-${width}.webp is in the package: it must come from the repository`);
      if (!existsSync(new URL(`../textures/${painted.map}-${width}.webp`, import.meta.url))) throw new Error(`textures/${painted.map}-${width}.webp is missing`);
    } else {
      if (!existsSync(file)) throw new Error(`missing dist/textures/${painted.map}-${width}.webp`);
      pictureBytes += statSync(file).size;
      pictures += 1;
    }
  }
  const rings = painted.rings;
  if (rings !== undefined) {
    const file = new URL(`../dist/textures/${rings.map}-${rings.width}.webp`, import.meta.url);
    if (!existsSync(file)) throw new Error(`missing dist/textures/${rings.map}-${rings.width}.webp`);
    pictureBytes += statSync(file).size;
    pictures += 1;
  }
}
if (existsSync(new URL("../dist/textures/", import.meta.url)) && readdirSync(new URL("../dist/textures/", import.meta.url)).length !== pictures) throw new Error("dist/textures holds a picture no painted look names");
if (pictureBytes > 2.1 * 1024 * 1024) throw new Error(`the pictures are ${(pictureBytes / 1048576).toFixed(2)} MB, over the 2.1 MB budget`);
console.log(`painted ok: ${pictures} pictures, ${(pictureBytes / 1048576).toFixed(2)} MB in the package`);

// Check the public sub-path through package resolution, as a consumer does.
const coordinateEntry = "@johnmorrisdotca/wakusei-planets/coordinates";
const coordinates = await import(coordinateEntry);
const vector = coordinates.sphericalToCartesian({ origin: "heliocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric", longitude: 0, latitude: 0, distanceAu: 1 });
if (vector.xAu !== 1 || vector.yAu !== 0 || vector.zAu !== 0) throw new Error("coordinates package entry failed");
const names = ["cartesianToSpherical", "eclipticToEquatorial", "equatorialToEcliptic", "equatorialToHorizontal", "meanObliquity", "sphericalToCartesian"];
if (JSON.stringify(Object.keys(coordinates).sort()) !== JSON.stringify(names)) throw new Error("coordinates public API changed");

// The stars through package resolution: the table loads and a known star is where the catalogue puts it.
const starsEntry = "@johnmorrisdotca/wakusei-planets/stars";
const starTable = await import(starsEntry);
const sirius = starTable.starByName("Sirius");
if (starTable.stars().length !== 5080 || sirius?.hr !== 2491 || Math.abs(sirius.declination + 16.7161) > 0.001) throw new Error("stars package entry failed");

// The nearest bodies and the closest approaches through package resolution: the great conjunction of 2020 is where Horizons puts it.
const nearestEntry = "@johnmorrisdotca/wakusei-planets/nearest";
const near = await import(nearestEntry);
const greatConjunction = near.closestApproach("jupiter", "saturn", { from: Date.UTC(2020, 11, 1), to: Date.UTC(2021, 0, 1) });
if (greatConjunction.time.toISOString().slice(0, 13) !== "2020-12-21T18" || Math.abs(greatConjunction.angle - 0.102) > 0.002 || near.nearest("moon", { count: 1, date: 0 }).length !== 1) throw new Error("nearest package entry failed");
if (JSON.stringify(Object.keys(near).sort()) !== JSON.stringify(["closestApproach", "conjunctions", "distance", "distanceRange", "nearest", "within"])) throw new Error("nearest public API changed");

// The colouring sheets through package resolution: a sheet for each body and the lineup, with their three facts and the paper's room.
const sheetsEntry = "@johnmorrisdotca/wakusei-planets/sheets";
const sheets = await import(sheetsEntry);
if (sheets.KIDS_SHEETS.length !== 19 || !sheets.kidsSvg("saturn", { ...sheets.kidsRoom("a4"), lang: "en" }).includes("Colour me!") || sheets.kidsFacts("jupiter", "en").length !== 3) throw new Error("sheets package entry failed");

// The sun and moon times through package resolution too, both conventions.
const suncalcEntry = "@johnmorrisdotca/wakusei-planets/suncalc";
const sunTimes = await import(suncalcEntry);
const legacyEntry = "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
const oldTimes = await import(legacyEntry);
const london = sunTimes.getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1, 0, 60);
if (!(london.sunrise instanceof Date) || london.sunrise.getTime() >= london.sunset.getTime()) throw new Error("suncalc package entry failed");
const polar = oldTimes.getTimes(new Date(Date.UTC(2026, 5, 21, 12)), 69.65, 18.96);
if (!Number.isNaN(polar.sunrise.getTime())) throw new Error("suncalc legacy package entry failed");

// The data door through package resolution: the package's own credits, and a source of small bodies.
const doorEntry = "@johnmorrisdotca/wakusei-planets/door";
const door = await import(doorEntry);
if (door.OWN_SOURCES.map((one: { id: string }) => one.id).join() !== "wakusei-pictures,wakusei-tiles,wakusei-orbits") throw new Error("the data door's own sources are wrong");
if (door.creditLine([door.ownCredit("wakusei-tiles", 1)], "en") !== "Finer map tiles: maps by NASA, USGS and JPL (public domain), cut by Wakusei Planets (Public domain).") throw new Error("the data door's credit line is wrong");
if (door.tilesSource("/tiles").info.id !== "wakusei-tiles" || door.createSourceBook().sources.length !== 0) throw new Error("the data door cannot make a source or a book");

// The Roadster through package resolution: the table loads with the entry point, the car is where Horizons puts it on 2020-10-07 (0.0495 au from Mars), and a date outside the span throws.
const roadsterEntry = "@johnmorrisdotca/wakusei-planets/roadster";
const roadster = await import(roadsterEntry);
const flyby = roadster.roadsterApproaches("mars").find((a: { date: number }) => Math.abs(a.date - Date.UTC(2020, 9, 7, 6, 28)) < 3_600_000);
if (flyby === undefined || Math.abs(flyby.distanceKm / 149597870.7 - 0.0495) > 0.0005 || roadster.roadsterEvents()[0].kind !== "launch") throw new Error("roadster package entry failed");
let outside = false;
try {
  roadster.roadsterPosition(Date.UTC(2040, 0, 1));
} catch (error) {
  outside = error instanceof RangeError;
}
if (!outside) throw new Error("roadster does not refuse a date outside its span");

// The comets through package resolution: the table loads with the entry point, Halley's perihelion distance is on the orbit, a comet made from elements flies, and a stranger throws.
const cometsEntry = "@johnmorrisdotca/wakusei-planets/comets";
const comets = await import(cometsEntry);
const halleyComet = comets.findComet("1P");
if (halleyComet === undefined || comets.listComets().length !== 34 || Math.abs(Math.hypot(...comets.cometPosition("halley", Date.UTC(1986, 1, 8, 11, 22))) - halleyComet.q) > 1e-3) throw new Error("comets package entry failed");
const madeComet = comets.cometFromElements({ designation: "C/2099 A1", e: 1.0004, q: 0.5, i: 20, node: 10, w: 20, perihelion: Date.UTC(2099, 5, 1) });
if (Math.abs(Math.hypot(...comets.cometPosition(madeComet, Date.UTC(2099, 5, 1))) - 0.5) > 1e-6) throw new Error("a comet from elements is not where its elements put it");
let strangeComet = false;
try {
  comets.cometPosition("no-such-comet", 0);
} catch (error) {
  strangeComet = error instanceof RangeError;
}
if (!strangeComet) throw new Error("comets does not refuse a comet it does not know");

// The places through package resolution: each table loads with its own entry point, Apollo 11 is at Tranquility Base, Perseverance in Jezero, and the helpers load a table on request and refuse a body they do not hold.
const placesEntry = "@johnmorrisdotca/wakusei-planets/places";
const places = await import(placesEntry);
const moonEntry = "@johnmorrisdotca/wakusei-planets/places/moon";
const marsEntry = "@johnmorrisdotca/wakusei-planets/places/mars";
const moonPlaces = (await import(moonEntry)).PLACES_MOON;
const marsPlaces = (await import(marsEntry)).PLACES_MARS;
const eagle = places.findPlace(moonPlaces, "Apollo 11 lunar module");
const percy = places.findPlace(marsPlaces, "Perseverance");
if (eagle === undefined || Math.abs(eagle.lat - 0.674) > 0.01 || Math.abs(eagle.lon - 23.473) > 0.01 || eagle.kind !== "crewed") throw new Error("places: Apollo 11 is not at Tranquility Base");
if (percy === undefined || Math.abs(percy.lat - 18.44) > 0.01 || Math.abs(percy.lon - 77.45) > 0.01) throw new Error("places: Perseverance is not in Jezero");
// every body of /places has its entry point in the package: the file, its types and an export that resolves, and each table says its own body
const placeEntries: Record<string, number> = {};
for (const body of places.PLACE_BODIES as string[]) {
  for (const ext of ["js", "d.ts"]) if (!existsSync(new URL(`../dist/places/${body}.${ext}`, import.meta.url))) throw new Error(`missing dist/places/${body}.${ext}`);
  const table = (await import(`@johnmorrisdotca/wakusei-planets/places/${body}`)) as Record<string, readonly { id: string }[]>;
  const list = table[`PLACES_${body.toUpperCase().replace("-", "_")}`];
  if (list === undefined || list.length === 0 || !list.every((place) => place.id.startsWith(`${body}/`))) throw new Error(`places: /places/${body} does not hold its own table`);
  placeEntries[body] = list.length;
}
if (placeEntries.venus === undefined || placeEntries.venus < 300 || placeEntries["67p"] !== 1) throw new Error("places: the Venus or 67P table is not what it should be");
if ((await places.loadPlaces("mars")).length !== marsPlaces.length || (await places.listPlaces("moon", "crewed")).length !== 6) throw new Error("places: the lookups do not load a table");
let noBody = false;
try {
  await places.loadPlaces("earth");
} catch (error) {
  noBody = error instanceof RangeError;
}
if (!noBody) throw new Error("places does not refuse a body it does not hold");

// The asteroids through package resolution: the table loads with the entry point, Eros is where its elements put it at their epoch (a distance from the Sun between perihelion and aphelion), and the counts hold.
const asteroidsEntry = "@johnmorrisdotca/wakusei-planets/asteroids";
const asteroids = await import(asteroidsEntry);
const eros = asteroids.findAsteroid("Eros");
const erosSun = Math.hypot(...(asteroids.asteroidPositionAu(eros, Date.UTC(2026, 5, 9)) as number[]));
if (asteroids.ASTEROIDS.length !== 104 || eros.number !== 433 || erosSun < eros.elements.q || erosSun > eros.elements.a * (1 + eros.elements.e)) throw new Error("asteroids package entry failed");

// The approaches through package resolution: the table loads with the entry point, Apophis passes the Earth on 2029-04-13 at about 0.000254 au, and the counts hold.
const approachesEntry = "@johnmorrisdotca/wakusei-planets/approaches";
const approaches = await import(approachesEntry);
const apophis = approaches.nextApproach("Apophis", Date.UTC(2026, 10, 11));
if (approaches.approachList().length !== 4183 || apophis === undefined || new Date(apophis.date).toISOString().slice(0, 10) !== "2029-04-13" || Math.abs(apophis.distanceAu - 0.000254091) > 1e-8) throw new Error("approaches package entry failed");
