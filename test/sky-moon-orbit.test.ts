// /sky moonLibration(), lunarApsides() and lunarNodes() against JPL Horizons (observer ephemerides of the Moon, geocentric, https://ssd.jpl.nasa.gov/api/horizons.api), each page read on 2026-11-17 and typed in by hand below; nothing was saved or downloaded.
//   libration: COMMAND 301, CENTER 500@399, QUANTITIES 14,20, 1 d step from 2026-11-07 12:00 UT: the sub-observer longitude and latitude (the libration) and the range in au.
//   perigee:   the same, QUANTITIES 20, 5 min step around 2026-11-25 21:00 UT; apogee: 10 min step around 2026-11-13 18:00 UT: the apsis is where the range rate is zero.
//   node:      QUANTITIES 31, 10 min step around 2026-11-17 11:50 UT: the Moon's ecliptic latitude, zero at the node.
import assert from "node:assert/strict";
import { test } from "node:test";
import { lunarApsides, lunarNodes, moonLibration } from "../src/sky.ts";

const AU_KM = 149_597_870.7;

/** 2026-11-07 12:00 UT plus n days: sub-observer longitude, latitude (degrees), range (au). */
const LIBRATION: Array<[number, number, number]> = [
  [5.074933, 5.583774, 0.00262113186853], [4.552593, 6.206621, 0.00264273889541], [3.860975, 6.523376, 0.00266296517060], [2.996085, 6.532149, 0.00268104059005],
  [1.96123, 6.245059, 0.00269594151328], [0.772496, 5.685275, 0.00270647094457], [359.46224, 4.883706, 0.00271138586917], [358.080375, 3.876125, 0.00270955233968],
  [356.693692, 2.701345, 0.00270011020043], [355.383562, 1.400793, 0.00268263263736], [354.24219, 0.019531, 0.00265726826818], [353.367159, -1.391509, 0.00262485307610],
  [352.853653, -2.772654, 0.00258697514252], [352.783552, -4.053097, 0.00254596765342],
];

test("the Moon's libration over 14 days is within 0.03 degrees of Horizons in longitude, 0.05 in latitude and within 80 km in distance (the engine's Moon runs up to 51 km short of Horizons over the fortnight, smoothly), and the worst misses are reported", () => {
  let lon = 0, lat = 0, km = 0;
  LIBRATION.forEach(([hLon, hLat, hRange], day) => {
    const mine = moonLibration(Date.UTC(2026, 10, 7 + day, 12));
    const dLon = Math.abs((((mine.longitude - hLon) % 360) + 540) % 360 - 180);
    const dLat = Math.abs(mine.latitude - hLat);
    const dKm = Math.abs(mine.distanceKm - hRange * AU_KM);
    lon = Math.max(lon, dLon); lat = Math.max(lat, dLat); km = Math.max(km, dKm);
    assert.ok(dLon < 0.03 && dLat < 0.05 && dKm < 80, `day ${day}: longitude ${dLon.toFixed(3)}, latitude ${dLat.toFixed(3)}, distance ${dKm.toFixed(1)} km`);
    assert.ok(mine.angularDiameter > 0.48 && mine.angularDiameter < 0.57);
  });
  console.log(`libration: worst ${lon.toFixed(3)} deg in longitude, ${lat.toFixed(3)} deg in latitude, ${km.toFixed(1)} km in distance over 14 days`);
});

test("the perigee of 25 November and the apogee of 13 November 2026 are within 10 minutes of where Horizons' range rate crosses zero and within 100 km of its range (the minimum is flat: the measured misses are 6 to 7 minutes)", () => {
  // Horizons' rows: [minutes after the first row, range rate km/s]; the zero is found by linear interpolation between the two rows that straddle it.
  const perigee = Date.UTC(2026, 10, 25, 21, 5) + (5 * 0.0000461 / (0.0000461 + 0.0000258)) * 60_000;
  const apogee = Date.UTC(2026, 10, 13, 17, 50) + (10 * 0.0000633 / (0.0000633 + 0.0000211)) * 60_000;
  const found = lunarApsides(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1));
  assert.deepEqual(found.map((apsis) => apsis.kind), ["apogee", "perigee"]);
  const [a, p] = found;
  const missA = (a!.time.getTime() - apogee) / 60_000, missP = (p!.time.getTime() - perigee) / 60_000;
  assert.ok(Math.abs(missA) < 10 && Math.abs(missP) < 10, `apogee ${missA.toFixed(1)} min, perigee ${missP.toFixed(1)} min from Horizons`);
  assert.ok(Math.abs(a!.distanceKm - 0.00271159969977 * AU_KM) < 100 && Math.abs(p!.distanceKm - 0.00240201305374 * AU_KM) < 100, `${a!.distanceKm} and ${p!.distanceKm} km`);
  console.log(`lunar apsides: apogee ${missA.toFixed(1)} min and perigee ${missP.toFixed(1)} min from Horizons' range-rate zero; ${(a!.distanceKm - 0.00271159969977 * AU_KM).toFixed(1)} and ${(p!.distanceKm - 0.00240201305374 * AU_KM).toFixed(1)} km in range`);
});

test("the ascending node of 17 November 2026 is within a minute of where Horizons' ecliptic latitude of the Moon crosses zero, and the nodes alternate", () => {
  const node = Date.UTC(2026, 10, 17, 11, 40) + (10 * 0.0061236 / (0.0061236 + 0.0013436)) * 60_000;
  const found = lunarNodes(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 15));
  assert.deepEqual(found.map((one) => one.kind), ["descending", "ascending", "descending", "ascending"]);
  const miss = (found[1]!.time.getTime() - node) / 1000;
  assert.ok(Math.abs(miss) < 60, `the node is ${miss.toFixed(1)} s from Horizons`);
  console.log(`lunar node: ${miss.toFixed(1)} s from Horizons' zero ecliptic latitude`);
});

test("the intervals include the start and exclude the end, a Date and its milliseconds agree, and bad bounds throw", () => {
  const all = lunarApsides(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 20));
  const at = all[1]!.time.getTime();
  assert.equal(lunarApsides(at, at + 1000).length, 1);
  assert.equal(lunarApsides(at - 86_400_000, at - 1000).length, 0, "an end a second before it excludes it (the search settles to about 0.1 s, so the end itself is exact only to that)");
  assert.equal(lunarApsides(at - 86_400_000, at + 1000).length, 1);
  assert.equal(lunarApsides(at + 1000, at + 86_400_000).length, 0);
  const nodes = lunarNodes(Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 20));
  const node = nodes[1]!.time.getTime();
  assert.equal(lunarNodes(node, node + 1000).length, 1);
  assert.equal(lunarNodes(node - 86_400_000, node - 1000).length, 0);
  assert.equal(lunarNodes(node - 86_400_000, node + 1000).length, 1);
  assert.equal(lunarNodes(node + 1000, node + 86_400_000).length, 0);
  assert.deepEqual(lunarNodes(new Date(node), new Date(node + 1000)), lunarNodes(node, node + 1000));
  assert.deepEqual(moonLibration(new Date(at)), moonLibration(at));
  assert.throws(() => lunarApsides(at, at - 1), RangeError);
  assert.throws(() => lunarNodes(at, Number.NaN), (e: Error) => e instanceof RangeError && /to/.test(e.message));
  assert.throws(() => moonLibration(Number.POSITIVE_INFINITY), RangeError);
});
