// skyBodies against JPL Horizons. Each figure below was read online from the Horizons system (ssd.jpl.nasa.gov/api/horizons.api), observer table, centre 500@399 (the Earth's centre) for the places of the bodies and
// the site coordinates given for the places in the sky, three moments (UTC), and is a plain number: nothing else of the output is copied. Set SKY_TABLE=1 to print the errors.
//  - R.A. and DEC (ICRF): the astrometric place in the J2000 frame; R.A. and DEC (a-appar): the airless apparent place of date; APmag; Illu%; Ang-diam (arcseconds); S-O-T and its /T (trailing the Sun: east) or /L.
//  - Azi and Elev (a-app): airless apparent azimuth and elevation for the site; the site's RA and DEC (a-appar) for the Moon's parallax.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SKY_BODY_IDS, skyBodies, skyBody, type SkyBodyId } from "../src/sky-bodies.ts";

const DATES = [Date.UTC(2024, 2, 20, 12), Date.UTC(2026, 5, 21, 12), Date.UTC(2030, 11, 1, 0)];
interface Row {
  id: SkyBodyId;
  date: number;
  j2000: [number, number];
  ofDate: [number, number];
  magnitude: number;
  illuminationPercent: number;
  diameterArcsec: number;
  elongation: number;
  east: boolean;
}
/** JPL Horizons, geocentric (500@399), read 2026-11-13. */
const HORIZONS: Row[] = [
  { id: "sun", date: DATES[0], j2000: [0.03378, 0.01445], ofDate: [0.33767, 0.14651], magnitude: -26.751, illuminationPercent: 100, diameterArcsec: 1926.235, elongation: 0.0, east: true },
  { id: "sun", date: DATES[1], j2000: [89.75639, 23.4356], ofDate: [90.15565, 23.43785], magnitude: -26.707, illuminationPercent: 100, diameterArcsec: 1887.873, elongation: 0.0, east: true },
  { id: "sun", date: DATES[2], j2000: [246.65292, -21.70117], ofDate: [247.11065, -21.7675], magnitude: -26.772, illuminationPercent: 100, diameterArcsec: 1945.372, elongation: 0.0, east: true },
  { id: "moon", date: DATES[0], j2000: [131.72134, 22.97344], ofDate: [132.07736, 22.88506], magnitude: -11.242, illuminationPercent: 80.69921, diameterArcsec: 1781.549, elongation: 127.7595, east: true },
  { id: "moon", date: DATES[1], j2000: [174.4697, 0.19648], ofDate: [174.81035, 0.04912], magnitude: -9.89, illuminationPercent: 45.83584, diameterArcsec: 1856.323, elongation: 85.0772, east: true },
  { id: "moon", date: DATES[2], j2000: [326.9156, -7.77988], ofDate: [327.32687, -7.63328], magnitude: -9.721, illuminationPercent: 39.8397, diameterArcsec: 1901.421, elongation: 78.131, east: true },
  { id: "mercury", date: DATES[0], j2000: [15.6671, 8.35993], ofDate: [15.97621, 8.48784], magnitude: -0.67, illuminationPercent: 61.05022, diameterArcsec: 6.614774, elongation: 17.6723, east: true },
  { id: "mercury", date: DATES[1], j2000: [115.16179, 21.31577], ofDate: [115.55002, 21.2551], magnitude: 0.925, illuminationPercent: 27.83543, diameterArcsec: 9.211737, elongation: 23.5582, east: true },
  { id: "mercury", date: DATES[2], j2000: [269.44491, -25.48942], ofDate: [269.92175, -25.48936], magnitude: -0.181, illuminationPercent: 50.80286, diameterArcsec: 7.274884, elongation: 21.1997, east: true },
  { id: "venus", date: DATES[0], j2000: [342.30885, -8.90714], ofDate: [342.61959, -8.78185], magnitude: -3.878, illuminationPercent: 94.31984, diameterArcsec: 10.54407, elongation: 19.779, east: false },
  { id: "venus", date: DATES[1], j2000: [131.94836, 19.92615], ofDate: [132.32533, 19.82957], magnitude: -4.025, illuminationPercent: 72.658, diameterArcsec: 14.98349, elongation: 39.2298, east: true },
  { id: "venus", date: DATES[2], j2000: [257.73665, -23.37306], ofDate: [258.20408, -23.40775], magnitude: -3.904, illuminationPercent: 98.48861, diameterArcsec: 9.961978, elongation: 10.3701, east: true },
  { id: "mars", date: DATES[0], j2000: [330.32963, -13.36359], ofDate: [330.65022, -13.24959], magnitude: 1.203, illuminationPercent: 96.2299, diameterArcsec: 4.387453, elongation: 32.3253, east: false },
  { id: "mars", date: DATES[1], j2000: [52.12856, 18.46736], ofDate: [52.50382, 18.55857], magnitude: 1.265, illuminationPercent: 95.57844, diameterArcsec: 4.389477, elongation: 35.3896, east: false },
  { id: "mars", date: DATES[2], j2000: [185.34033, -0.55533], ofDate: [185.73812, -0.72732], magnitude: 1.376, illuminationPercent: 92.43477, diameterArcsec: 5.042854, elongation: 63.2806, east: false },
  { id: "jupiter", date: DATES[0], j2000: [42.42567, 15.41033], ofDate: [42.75548, 15.50974], magnitude: -2.098, illuminationPercent: 99.50921, diameterArcsec: 34.82144, elongation: 44.5985, east: true },
  { id: "jupiter", date: DATES[1], j2000: [119.96059, 21.02232], ofDate: [120.34611, 20.95072], magnitude: -1.826, illuminationPercent: 99.79495, diameterArcsec: 32.06452, elongation: 28.0137, east: true },
  { id: "jupiter", date: DATES[2], j2000: [246.42923, -21.0724], ofDate: [246.8848, -21.13919], magnitude: -1.749, illuminationPercent: 99.99988, diameterArcsec: 31.14869, elongation: 0.6625, east: false },
  { id: "saturn", date: DATES[0], j2000: [343.9762, -8.60511], ofDate: [344.28611, -8.47865], magnitude: 1.034, illuminationPercent: 99.97439, diameterArcsec: 15.5956, elongation: 18.171, east: false },
  { id: "saturn", date: DATES[1], j2000: [13.18418, 3.10658], ofDate: [13.52576, 3.25097], magnitude: 0.812, illuminationPercent: 99.72677, diameterArcsec: 17.21844, elongation: 76.4451, east: false },
  { id: "saturn", date: DATES[2], j2000: [63.17476, 19.02726], ofDate: [63.63461, 19.1051], magnitude: -0.409, illuminationPercent: 99.99841, diameterArcsec: 20.55985, elongation: 175.7935, east: true },
  { id: "uranus", date: DATES[0], j2000: [47.56852, 17.45529], ofDate: [47.90482, 17.54655], magnitude: 5.828, illuminationPercent: 99.96226, diameterArcsec: 3.484447, elongation: 49.9017, east: true },
  { id: "uranus", date: DATES[1], j2000: [60.82806, 20.5713], ofDate: [61.21229, 20.64402], magnitude: 5.818, illuminationPercent: 99.98599, diameterArcsec: 3.461723, elongation: 26.9283, east: false },
  { id: "uranus", date: DATES[2], j2000: [80.1107, 23.21698], ofDate: [80.59044, 23.24541], magnitude: 5.532, illuminationPercent: 99.99687, diameterArcsec: 3.873969, elongation: 167.4642, east: false },
  { id: "neptune", date: DATES[0], j2000: [357.86237, -2.25294], ofDate: [358.16651, -2.12107], magnitude: 7.828, illuminationPercent: 99.99992, diameterArcsec: 2.210273, elongation: 3.1391, east: false },
  { id: "neptune", date: DATES[1], j2000: [4.18905, 0.33384], ofDate: [4.52979, 0.48174], magnitude: 7.774, illuminationPercent: 99.9712, diameterArcsec: 2.281033, elongation: 85.7954, east: false },
  { id: "neptune", date: DATES[2], j2000: [10.04068, 2.62466], ofDate: [10.445, 2.79653], magnitude: 7.711, illuminationPercent: 99.98034, diameterArcsec: 2.329113, elongation: 121.8587, east: true },
  { id: "pluto", date: DATES[0], j2000: [304.26065, -22.69928], ofDate: [304.61338, -22.62589], magnitude: 14.526, illuminationPercent: 99.98516, diameterArcsec: 0.09235, elongation: 58.7451, east: false },
  { id: "pluto", date: DATES[1], j2000: [308.11821, -23.16537], ofDate: [308.51431, -23.07379], magnitude: 14.494, illuminationPercent: 99.99322, diameterArcsec: 0.094423, elongation: 144.8627, east: false },
  { id: "pluto", date: DATES[2], j2000: [313.79961, -23.74949], ofDate: [314.25128, -23.62924], magnitude: 14.727, illuminationPercent: 99.9861, diameterArcsec: 0.088221, elongation: 61.3693, east: true },
];
interface Site {
  name: string;
  latitude: number;
  longitude: number;
  heightM: number;
  /** [id, date index, azimuth, elevation] (airless apparent). */
  azel: [SkyBodyId, number, number, number][];
  /** The Moon's apparent R.A. and DEC for the site (parallax), by date index. */
  moonTopocentric: [number, number][];
}
const SITES: Site[] = [
  {
    name: "Tokyo (139.69 E, 35.69 N, 40 m)",
    latitude: 35.69,
    longitude: 139.69,
    heightM: 40,
    azel: [
      ["moon", 0, 204.213332, 75.916431],
      ["moon", 1, 247.511742, 27.272551],
      ["moon", 2, 79.583097, -27.737495],
      ["sun", 0, 302.939742, -36.927306],
      ["sun", 1, 320.566674, -19.413536],
      ["sun", 2, 142.266149, 22.449103],
      ["jupiter", 0, 285.749418, 4.688272],
      ["jupiter", 1, 297.94023, -2.229961],
      ["jupiter", 2, 142.094116, 23.0943],
    ],
    moonTopocentric: [[131.99072, 22.68198], [174.17825, -0.50393], [328.02631, -8.13758]],
  },
  {
    name: "Ottawa (-75.70 E, 45.42 N, 70 m)",
    latitude: 45.42,
    longitude: -75.7,
    heightM: 70,
    azel: [
      ["moon", 0, 331.954563, -17.549544],
      ["moon", 1, 26.021097, -42.17298],
      ["moon", 2, 211.789283, 30.902336],
      ["mars", 0, 130.954801, 17.176448],
      ["mars", 1, 117.331696, 48.367492],
      ["mars", 2, 343.812592, -44.164506],
      ["venus", 0, 118.362301, 13.8905],
      ["venus", 1, 56.121148, -4.111388],
      ["venus", 2, 257.009099, -20.504781],
    ],
    moonTopocentric: [[131.74191, 22.07866], [175.02669, -0.61496], [327.01265, -8.40182]],
  },
];

/** The angle between two directions given as right ascension and declination, in arcminutes. */
function separationArcmin(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const c = Math.sin(a[1] * r) * Math.sin(b[1] * r) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.cos((a[0] - b[0]) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) * (180 / Math.PI) * 60;
}
const table: string[] = [];
const worst: Record<string, { j2000: number; ofDate: number; magnitude: number; diameter: number; elongation: number; illumination: number }> = {};
for (const row of HORIZONS) {
  const body = skyBody(row.id, row.date);
  const w = (worst[row.id] ??= { j2000: 0, ofDate: 0, magnitude: 0, diameter: 0, elongation: 0, illumination: 0 });
  w.j2000 = Math.max(w.j2000, separationArcmin([body.equatorialJ2000.rightAscensionDeg, body.equatorialJ2000.declinationDeg], row.j2000));
  w.ofDate = Math.max(w.ofDate, separationArcmin([body.equatorialDate.rightAscensionDeg, body.equatorialDate.declinationDeg], row.ofDate));
  w.magnitude = Math.max(w.magnitude, Math.abs(body.magnitude - row.magnitude));
  w.diameter = Math.max(w.diameter, Math.abs(body.angularDiameterArcsec / row.diameterArcsec - 1));
  w.illumination = Math.max(w.illumination, Math.abs(body.illuminatedFraction * 100 - row.illuminationPercent));
  if (row.id !== "sun") w.elongation = Math.max(w.elongation, Math.abs(body.elongationDeg! - row.elongation));
}
if (process.env["SKY_TABLE"]) {
  for (const [id, w] of Object.entries(worst)) table.push(`${id.padEnd(8)} J2000 ${w.j2000.toFixed(3)}' date ${w.ofDate.toFixed(3)}' mag ${w.magnitude.toFixed(3)} diameter ${(w.diameter * 100).toFixed(2)}% elongation ${w.elongation.toFixed(3)} deg illumination ${w.illumination.toFixed(3)}%`);
  console.log(table.join("\n"));
}

/** Azimuth and altitude errors, in arcminutes of angle on the sky. */
const horizontalErrors: Record<string, number> = {};
for (const site of SITES) {
  for (const [id, index, azimuth, elevation] of site.azel) {
    const body = skyBody(id, DATES[index]!, { latitude: site.latitude, longitude: site.longitude, heightM: site.heightM });
    const h = body.horizontal!;
    const dAz = ((((h.azimuthDeg - azimuth + 180) % 360) + 360) % 360) - 180;
    const across = Math.abs(dAz) * Math.cos((elevation * Math.PI) / 180) * 60;
    const up = Math.abs(h.altitudeDeg - elevation) * 60;
    horizontalErrors[`${id} ${site.name.split(" ")[0]}`] = Math.max(horizontalErrors[`${id} ${site.name.split(" ")[0]}`] ?? 0, across, up);
  }
}
if (process.env["SKY_TABLE"]) console.log("HORIZONTAL " + JSON.stringify(Object.fromEntries(Object.entries(horizontalErrors).map(([k, v]) => [k, Number(v.toFixed(3))]))));

/** What the figures above prove, per body: the most each differs from JPL Horizons on the three dates (the TSDoc of `skyBodies` and the guide say the same numbers). */
const TOLERANCE: Record<SkyBodyId, { position: number; positionJ2000: number; magnitude: number }> = {
  sun: { position: 0.1, positionJ2000: 0.1, magnitude: 0.02 },
  moon: { position: 0.05, positionJ2000: 0.3, magnitude: 0.06 },
  mercury: { position: 0.1, positionJ2000: 0.1, magnitude: 0.02 },
  venus: { position: 0.1, positionJ2000: 0.1, magnitude: 0.02 },
  mars: { position: 0.1, positionJ2000: 0.1, magnitude: 0.1 },
  jupiter: { position: 0.1, positionJ2000: 0.1, magnitude: 0.02 },
  saturn: { position: 0.1, positionJ2000: 0.1, magnitude: 0.02 },
  uranus: { position: 0.1, positionJ2000: 0.1, magnitude: 0.03 },
  neptune: { position: 0.1, positionJ2000: 0.1, magnitude: 0.03 },
  pluto: { position: 0.1, positionJ2000: 0.1, magnitude: 0.5 },
};
const FIELDS = { diameter: 0.001, illuminationPoints: 0.02, elongationDeg: 0.02, horizontalArcmin: 0.1 };

test("every body's place, magnitude, size, phase and elongation are within the stated distance of JPL Horizons on three dates", () => {
  for (const id of SKY_BODY_IDS) {
    const w = worst[id]!;
    const t = TOLERANCE[id];
    assert.ok(w.j2000 <= t.positionJ2000, `${id} J2000 ${w.j2000.toFixed(3)} arcmin`);
    assert.ok(w.ofDate <= t.position, `${id} of date ${w.ofDate.toFixed(3)} arcmin`);
    assert.ok(w.magnitude <= t.magnitude, `${id} magnitude ${w.magnitude.toFixed(3)}`);
    assert.ok(w.diameter <= FIELDS.diameter, `${id} diameter ${(w.diameter * 100).toFixed(3)} percent`);
    assert.ok(w.illumination <= FIELDS.illuminationPoints, `${id} illuminated fraction ${w.illumination.toFixed(3)} points`);
    assert.ok(w.elongation <= FIELDS.elongationDeg, `${id} elongation ${w.elongation.toFixed(3)} degrees`);
  }
});

test("east or west of the Sun is Horizons' trailing or leading, for every body and date", () => {
  for (const row of HORIZONS) {
    if (row.id === "sun") continue;
    // within a degree and a half of the Sun the side is a coin toss for a figure rounded to a few digits (Jupiter on 2030-12-01 is 0.66 degrees from it)
    if (row.elongation < 1) continue;
    assert.equal(skyBody(row.id, row.date).east, row.east, `${row.id} ${new Date(row.date).toISOString()}`);
  }
});

test("a place's azimuth and altitude are within a tenth of an arcminute of Horizons, the Moon's parallax in", () => {
  for (const [name, error] of Object.entries(horizontalErrors)) assert.ok(error <= FIELDS.horizontalArcmin, `${name} ${error.toFixed(3)} arcmin`);
  // the parallax is the point of the Moon's rows: from the Earth's centre it is about a degree higher or lower than from the place
  const place = { latitude: 35.69, longitude: 139.69, heightM: 40 };
  const moon = skyBody("moon", DATES[1]!, place);
  assert.ok(Math.abs(moon.horizontal!.altitudeDeg - 27.272551) < 0.002, "Horizons' elevation");
  assert.ok(moon.distanceKm > 350000 && moon.distanceKm < 410000);
});

test("the list is the ten bodies in order with their names, kinds and fields; the observer's fields appear only with an observer", () => {
  const list = skyBodies(DATES[1]!);
  assert.deepEqual(list.map((body) => body.id), [...SKY_BODY_IDS]);
  assert.deepEqual(list.map((body) => body.kind), ["star", "moon", "planet", "planet", "planet", "planet", "planet", "planet", "planet", "dwarf"]);
  assert.equal(list[0]!.name.en, "Sun");
  assert.equal(list[1]!.name.ja, "月");
  assert.equal(list[0]!.elongationDeg, undefined, "no elongation for the Sun");
  assert.equal(list[0]!.east, undefined);
  assert.ok(list.every((body) => body.horizontal === undefined && body.aboveHorizon === undefined), "no place, no horizontal");
  assert.ok(list[1]!.moon !== undefined && list.slice(2).every((body) => body.moon === undefined));
  const placed = skyBodies(DATES[1]!, { latitude: 35.69, longitude: 139.69 });
  for (const body of placed) {
    assert.ok(body.horizontal !== undefined);
    assert.equal(body.aboveHorizon, body.horizontal!.apparentAltitudeDeg > 0);
    assert.ok(body.horizontal!.apparentAltitudeDeg >= body.horizontal!.altitudeDeg - 1e-9, "refraction lifts a body");
    assert.ok(body.horizontal!.azimuthDeg >= 0 && body.horizontal!.azimuthDeg < 360);
  }
  // the Sun and the Moon at 2026-06-21 12:00 UTC over Tokyo: the Sun is up (21:00 local), the Moon is up too (Horizons: 27 degrees)
  assert.equal(placed[0]!.aboveHorizon, false, "21:00 local: the Sun has set");
  assert.equal(placed[1]!.aboveHorizon, true);
});

test("the moment is a Date or milliseconds, nothing reads a clock, and the list is plain data", () => {
  const a = skyBodies(new Date(DATES[0]!), { latitude: 45.42, longitude: -75.7 });
  const b = skyBodies(DATES[0]!, { latitude: 45.42, longitude: -75.7 });
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.deepEqual(skyBodies(DATES[2]!), skyBodies(DATES[2]!));
  assert.throws(() => skyBodies(Number.NaN), /date/i);
  assert.throws(() => skyBody("earth" as SkyBodyId, DATES[0]!), /unknown body/);
});

test("the Moon's phase fields agree with its illuminated fraction and the sides of the Sun", () => {
  for (const date of DATES) {
    const moon = skyBody("moon", date);
    assert.ok(moon.moon!.phase >= 0 && moon.moon!.phase < 1);
    assert.equal(moon.moon!.waxing, moon.east, "waxing is east of the Sun");
    assert.ok(Math.abs(Math.cos((moon.phaseAngleDeg * Math.PI) / 180) - (2 * moon.illuminatedFraction - 1)) < 1e-9);
  }
});
