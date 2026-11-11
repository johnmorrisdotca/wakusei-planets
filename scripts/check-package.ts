// Check the built package the way a consumer would: the entry files are there, and importing the built index draws every body.
import { existsSync, readdirSync, statSync } from "node:fs";

const entries = ["coordinates", "index", "element", "scene/look", "scene/painter", "door/index", "data-door", "space/index", "space/element", "plan/index", "plan/element", "bodies/all", "bodies/sun", "bodies/jupiter", "bodies/saturn", "bodies/moons-jupiter"];
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
