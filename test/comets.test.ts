// The comets against JPL Horizons (test/data/comets-horizons.json, fetched by scripts/make-comet-data.py --horizons): the Sun-centred position of twelve comets at seven dates within a year of each one's epoch, and of Halley and
// Hale-Bopp at their perihelia of 1986 and 1997, against two-body motion on the elements; the maths on its own (the closed, near-parabolic and open orbits agree with energy and with the elements); the set (counts, names,
// showers, the table's shape); the orbit line; the door for a new comet; the errors a bad input gives; and that the table is a chunk of its own, which none of the package's other entry points carry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { build } from "esbuild";
import { COMET_TABLE } from "../src/data/comets.ts";
import { COMET_ACCURACY, cometDistance, cometFromElements, cometOrbit, cometPerihelia, cometPosition, cometTrust, findComet, listComets } from "../src/comets.ts";
import { MINOR_IDS } from "../src/facts.ts";
import { heliocentric } from "../src/ephemeris.ts";
import { ttMinusUtc } from "../src/time.ts";
import { length, sub, type Vec3 } from "../src/vec.ts";

interface Fixture {
  comets: Record<string, { command: string; rows: { jd: number; x: number; y: number; z: number }[] }>;
}
const fixture = JSON.parse(readFileSync(new URL("./data/comets-horizons.json", import.meta.url), "utf8")) as Fixture;

const DAY = 86_400_000;
/** A Julian date in TDB (taken as terrestrial time) as the UTC milliseconds the functions take. */
const utcOf = (jd: number): number => {
  const tt = (jd - 2_440_587.5) * DAY;
  return tt - ttMinusUtc(tt) * 1000;
};

// The tolerances are what was measured, with room: within a year of the epoch the worst miss of the twelve comets was 5.2e-3 au ('Oumuamua, 300 days before its epoch, 2.0 per mille of its distance 5 au) and every other
// one was under 2.5e-3 au, except ISON, which passed 0.012 au from the Sun inside the year (1.3e-2 au, 5 per mille). The perihelia 18 and 25 years from the elements' epoch are off by 0.035 au (Halley, 1986) and
// 0.065 au (Hale-Bopp, 1997), because the planets' pull has bent the orbit since.
const WITHIN_YEAR_AU = 6e-3;
const WITHIN_YEAR_SHARE = 2e-3;
const LOOSER: Record<string, [number, number]> = { ison: [0.02, 0.01] };
const HALLEY_1986_AU = 0.05;
const HALE_BOPP_1997_AU = 0.1;

test("twelve comets are within a year of the epoch against Horizons within the stated tolerance", () => {
  const ids = Object.keys(fixture.comets);
  assert.equal(ids.length, 12, "twelve comets in the fixture: eight closed orbits, a near-parabolic pair and two open ones");
  const worst: string[] = [];
  for (const id of ids) {
    const comet = findComet(id)!;
    let worstAu = 0;
    let worstShare = 0;
    let used = 0;
    for (const row of fixture.comets[id]!.rows) {
      if (Math.abs(row.jd - comet.epoch) > 365) continue;
      used += 1;
      const p = cometPosition(comet, utcOf(row.jd));
      const miss = length(sub(p, [row.x, row.y, row.z]));
      const share = miss / length([row.x, row.y, row.z]);
      worstAu = Math.max(worstAu, miss);
      worstShare = Math.max(worstShare, share);
      assert.ok(miss < (LOOSER[id]?.[0] ?? WITHIN_YEAR_AU), `${id} at ${row.jd - comet.epoch} days from its epoch is ${miss} au from Horizons`);
      assert.ok(share < (LOOSER[id]?.[1] ?? WITHIN_YEAR_SHARE), `${id} at ${row.jd - comet.epoch} days from its epoch is ${share} of its distance from Horizons`);
    }
    assert.equal(used, 7, `${id} has seven dates within a year`);
    worst.push(`${id} ${worstAu.toExponential(1)} au`);
  }
  console.log(`worst miss against Horizons within a year of the epoch: ${worst.join(", ")}`);
});

test("the perihelia of Halley in 1986 and Hale-Bopp in 1997, far from the elements' epochs, are within what the drift allows", () => {
  const halley = findComet("halley")!;
  const hale = findComet("hale-bopp")!;
  const at = (id: string, tp: number) => fixture.comets[id]!.rows.find((row) => Math.abs(row.jd - tp) < 1e-5)!;
  const h = at("halley", halley.tp);
  const b = at("hale-bopp", hale.tp);
  assert.ok(h !== undefined && b !== undefined);
  // the osculating orbit of 1968 has its perihelion on 1986-02-08 11:22; the comet's real one was 1986-02-09 (the elements' orbit is a day early); Hale-Bopp's real was 1997-04-01, the elements' 1997-03-29
  assert.equal(new Date(utcOf(halley.tp)).toISOString().slice(0, 10), "1986-02-08");
  assert.equal(new Date(utcOf(hale.tp)).toISOString().slice(0, 10), "1997-03-29");
  const missH = length(sub(cometPosition(halley, utcOf(halley.tp)), [h.x, h.y, h.z]));
  const missB = length(sub(cometPosition(hale, utcOf(hale.tp)), [b.x, b.y, b.z]));
  console.log(`perihelion miss against Horizons: Halley 1986 ${missH.toFixed(4)} au (${((missH / length([h.x, h.y, h.z])) * 100).toFixed(1)} per cent of its distance), Hale-Bopp 1997 ${missB.toFixed(4)} au (${((missB / length([b.x, b.y, b.z])) * 100).toFixed(1)} per cent)`);
  assert.ok(missH < HALLEY_1986_AU, `Halley 1986 ${missH} au`);
  assert.ok(missB < HALE_BOPP_1997_AU, `Hale-Bopp 1997 ${missB} au`);
  // and the time the two-body orbit puts them at perihelion is the time of the elements: the distance is the perihelion distance
  assert.ok(Math.abs(length(cometPosition(halley, utcOf(halley.tp))) - halley.q) < 1e-9);
  assert.ok(Math.abs(length(cometPosition(hale, utcOf(hale.tp))) - hale.q) < 1e-9);
});

test("Halley's elements here are the plain orbit of the 1968 solution, within a year of its epoch close to the package's own table", () => {
  const halley = findComet("halley")!;
  assert.ok(MINOR_IDS.includes(halley.id as (typeof MINOR_IDS)[number]), "the id is the one the space view uses");
  for (const days of [-300, 0, 300]) {
    const ms = utcOf(halley.epoch + days);
    const miss = length(sub(cometPosition(halley, ms), heliocentric("halley", ms)));
    assert.ok(miss < 1e-5, `Halley ${days} days from its epoch is ${miss} au from the package's table`);
  }
});

test("the universal Kepler solution holds for closed, near-parabolic, parabolic and open orbits: energy, perihelion and a symmetric path", () => {
  const cases = [
    cometFromElements({ designation: "t1", e: 0.0, q: 1.2, i: 10, node: 20, w: 30, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t2", e: 0.3, q: 0.9, i: 140, node: 220, w: 300, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t3", e: 0.97, q: 0.6, i: 80, node: 10, w: 100, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t4", e: 0.99999, q: 0.3, i: 50, node: 90, w: 10, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t5", e: 1, q: 0.5, i: 50, node: 90, w: 10, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t6", e: 1.00001, q: 0.5, i: 50, node: 90, w: 10, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t7", e: 1.2, q: 0.26, i: 122, node: 24, w: 242, tp: 2_460_000.5 }),
    cometFromElements({ designation: "t8", e: 3.4, q: 2, i: 44, node: 308, w: 209, tp: 2_460_000.5 }),
  ];
  const mu = 0.017_202_098_95 ** 2;
  for (const comet of cases) {
    const tp = utcOf(comet.tp);
    for (const days of [-2000, -400, -30, -1, 1, 5, 60, 400, 2000]) {
      const ms = tp + days * DAY;
      const p = cometPosition(comet, ms) as Vec3;
      const step = 0.002 * DAY;
      const before = cometPosition(comet, ms - step);
      const after = cometPosition(comet, ms + step);
      const v = [0, 1, 2].map((k) => (after[k]! - before[k]!) / 0.004) as unknown as Vec3;
      const r = length(p);
      const energy = (length(v) ** 2) / 2 - mu / r;
      const expected = comet.e === 1 ? 0 : -mu / (2 * (comet.q / (1 - comet.e)));
      assert.ok(Math.abs(energy - expected) < 1e-5 * (mu / r), `${comet.designation} at ${days} days: energy ${energy} against ${expected}`);
      assert.ok(r >= comet.q - 1e-9, `${comet.designation} is never nearer than perihelion`);
      const mirror = cometPosition(comet, tp - days * DAY);
      assert.ok(Math.abs(length(mirror) - r) < 1e-9 * Math.max(1, r), `${comet.designation} is as far from the Sun ${days} days before as after perihelion`);
    }
  }
});

test("a closed orbit repeats after its period and goes out to its far end", () => {
  const comet = cometFromElements({ designation: "t9", e: 0.8, q: 1, i: 20, node: 30, w: 40, tp: 2_460_000.5 });
  const period = comet.periodYears! * 365.25 * DAY;
  const tp = utcOf(comet.tp);
  const here = cometPosition(comet, tp + 100 * DAY);
  const later = cometPosition(comet, tp + 100 * DAY + 3 * period);
  assert.ok(length(sub(here, later)) < 1e-6);
  assert.ok(Math.abs(length(cometPosition(comet, tp + period / 2)) - 9) < 1e-6, "the far end is a (1 + e) = 9 au");
});

test("the set: counts by kind, names in English and Japanese, ids and designations unique, the elements in range", () => {
  const all = listComets();
  assert.equal(all.length, 34);
  assert.equal(listComets("periodic").length, 20);
  assert.equal(listComets("long-period").length, 11);
  assert.equal(listComets("interstellar").length, 3);
  assert.deepEqual(listComets("interstellar").map((c) => c.designation), ["1I", "2I", "3I"]);
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  assert.equal(new Set(all.map((c) => c.designation)).size, all.length);
  assert.equal(COMET_TABLE.length, all.length);
  for (const c of all) {
    assert.ok(c.name.en !== "" && /[ぁ-んァ-ヶ一-龠]/.test(c.name.ja), `${c.id} has a Japanese name`);
    assert.ok(c.id === c.id.toLowerCase() && /^[a-z0-9-]+$/.test(c.id));
    assert.ok(c.q > 0 && c.e >= 0 && c.i >= 0 && c.i <= 180 && c.node >= 0 && c.node < 360 && c.w >= 0 && c.w < 360, c.id);
    assert.ok(Number.isFinite(c.tp) && Number.isFinite(c.epoch), c.id);
    if (c.kind === "interstellar") assert.ok(c.e > 1 && c.a === null && c.periodYears === null, c.id);
    if (c.kind === "periodic") assert.ok(c.e < 1 && c.periodYears! < 200 && c.a !== null, c.id);
    if (c.kind === "long-period") assert.ok(c.e < 1 ? c.periodYears! >= 200 : c.e >= 1, c.id);
    if (c.e < 1) assert.ok(Math.abs(c.a! * (1 - c.e) - c.q) < 1e-9, `${c.id}: a (1 - e) is q`);
    assert.ok(c.condition === null || (c.condition >= 0 && c.condition <= 9), c.id);
  }
  for (const wanted of ["1P", "2P", "9P", "19P", "21P", "45P", "46P", "55P", "67P", "81P", "103P", "109P", "12P", "13P", "8P", "96P", "7P", "73P", "C/1995 O1", "C/1996 B2", "C/2020 F3", "C/2006 P1", "C/2011 W3", "C/2012 S1", "C/2022 E3", "C/2023 A3", "1I", "2I"]) {
    assert.ok(findComet(wanted) !== undefined, `${wanted} is in the set`);
  }
});

test("the meteor showers a comet feeds, only the well-established ones", () => {
  const showers = Object.fromEntries(listComets().filter((c) => c.showers.length > 0).map((c) => [c.designation, c.showers.map((s) => `${s.code} ${s.en}`)]));
  assert.deepEqual(showers, {
    "1P": ["ETA Eta Aquariids", "ORI Orionids"],
    "2P": ["TAU Taurids"],
    "8P": ["URS Ursids"],
    "21P": ["DRA Draconids"],
    "55P": ["LEO Leonids"],
    "109P": ["PER Perseids"],
  });
  for (const c of listComets()) for (const s of c.showers) assert.ok(/^[A-Z]{3}$/.test(s.code) && /[ぁ-んァ-ヶ一-龠]/.test(s.ja), `${c.id} ${s.code}`);
});

test("find a comet by id, designation or English name, any case; a stranger is undefined", () => {
  const halley = findComet("halley");
  assert.ok(halley !== undefined);
  assert.equal(findComet("1P"), halley);
  assert.equal(findComet("  HALLEY "), halley);
  assert.equal(findComet("c/1995 o1")?.id, "hale-bopp");
  assert.equal(findComet("Hale-Bopp")?.designation, "C/1995 O1");
  assert.equal(findComet("nonexistent"), undefined);
  assert.equal(findComet(7 as unknown as string), undefined);
});

test("last and next perihelion of the periodic comets are JPL's dates, with their basis; outside the span they are repeated from the period and marked estimated", () => {
  const day = (ms: number | null) => new Date(ms!).toISOString().slice(0, 10);
  const now = Date.UTC(2026, 10, 11);
  // the dates the comets are known for: 1P Halley 1986-02-09 and the published prediction 2061-07-28, 109P 1992-12-12 and 2126-07-12, 67P 2021-11-02, 2P 2023-10-22, 19P 2022-02-01
  const known: [string, string, string][] = [["1P", "1986-02-09", "2061-07-28"], ["109P", "1992-12-12", "2126-07-12"], ["67P", "2021-11-02", "2028-04-09"], ["2P", "2023-10-22", "2027-02-10"], ["19P", "2022-02-01", "2028-12-11"], ["81P", "2022-12-15", "2029-05-14"]];
  for (const [id, last, next] of known) {
    const p = cometPerihelia(id, now);
    assert.equal(day(p.last), last, `${id} last`);
    assert.equal(day(p.next), next, `${id} next`);
    assert.equal(p.basis, "jpl");
    assert.equal(p.lastObserved, true, id);
  }
  // 21P and 46P: JPL's solution is older than the passages of 2025 and 2024, so their last is a prediction (the real 21P passage was 2025-03-29, JPL's date is 4 days earlier)
  assert.equal(cometPerihelia("21P", now).lastObserved, false);
  assert.ok(Math.abs(cometPerihelia("21P", now).last! - Date.UTC(2025, 2, 29)) < 5 * DAY);
  for (const c of listComets("periodic")) {
    assert.ok(c.perihelion !== undefined && c.perihelion.source.startsWith("JPL Horizons, small-body record 9000"), c.id);
    const { last, next, basis } = cometPerihelia(c, now);
    assert.ok(last! <= now && next! > now && basis === "jpl", c.id);
    assert.ok(Math.abs((next! - last!) / DAY / 365.25 - c.periodYears!) < c.periodYears! * 0.1 + 0.3, `${c.id} the gap is about the period`);
  }
  // after JPL's next date, or before its last, the passages are repeated from the period and said to be estimated
  const later = cometPerihelia("67P", Date.UTC(2040, 0, 1));
  assert.equal(later.basis, "estimated");
  assert.ok(later.last! < Date.UTC(2040, 0, 1) && later.next! > Date.UTC(2040, 0, 1) && later.lastObserved === false);
  assert.equal(cometPerihelia("1P", Date.UTC(1900, 0, 1)).basis, "estimated");
  // a comet of the set on an open orbit has JPL's one perihelion; one from elements has its own
  assert.equal(cometPerihelia("2I", now).next, null);
  assert.equal(cometPerihelia("2I", now).basis, "jpl");
  assert.equal(cometPerihelia("2I", Date.UTC(2000, 0, 1)).last, null);
  assert.ok(cometPerihelia("2I", Date.UTC(2000, 0, 1)).next! > 0);
  // a period over 10,000 years has one perihelion: repeating Hyakutake's 70,000 years would put its next in the year 99940
  const hyakutake = cometPerihelia("hyakutake", now);
  assert.ok(hyakutake.last !== null && hyakutake.last < Date.UTC(1997, 0, 1) && hyakutake.next === null, "Hyakutake's one perihelion is behind");
  assert.equal(cometPerihelia("hyakutake", Date.UTC(1990, 0, 1)).last, null);
  assert.ok(cometPerihelia("hyakutake", Date.UTC(1990, 0, 1)).next! < Date.UTC(1997, 0, 1));
  for (const comet of listComets()) if (comet.e < 1) assert.ok(new Date(cometPerihelia(comet, now).next ?? 0).getUTCFullYear() < 10_000, `${comet.id}'s next perihelion is not in a far year`);
  const made = cometFromElements({ designation: "X", e: 0.5, q: 1, i: 10, node: 0, w: 0, perihelion: Date.UTC(2030, 0, 1) });
  assert.equal(cometPerihelia(made, Date.UTC(2029, 0, 1)).basis, "elements");
  assert.equal(day(cometPerihelia(made, Date.UTC(2029, 0, 1)).next), "2030-01-01");
  assert.equal(cometPerihelia(made, Date.UTC(2040, 0, 1)).basis, "estimated");
});

test("the distance from the Sun and the Earth, and how far from the epoch a moment is", () => {
  const hale = findComet("hale-bopp")!;
  const ms = utcOf(hale.tp);
  const d = cometDistance(hale, ms);
  assert.ok(Math.abs(d.sunAu - hale.q) < 1e-9);
  assert.ok(Math.abs(d.earthAu - 1.315) < 0.03, `Hale-Bopp was 1.32 au from the Earth at its perihelion, got ${d.earthAu}`);
  for (const c of listComets()) {
    const t = cometDistance(c, utcOf(c.epoch));
    assert.ok(t.earthAu >= Math.abs(t.sunAu - 1.02) - 1e-9 && t.earthAu <= t.sunAu + 1.02, c.id);
  }
  const trust = cometTrust("neowise", utcOf(findComet("neowise")!.epoch + 100));
  assert.ok(Math.abs(trust.daysFromEpoch - 100) < 1e-6 && trust.withinYear);
  assert.equal(cometTrust("neowise", utcOf(findComet("neowise")!.epoch + 400)).withinYear, false);
  assert.equal(COMET_ACCURACY.trustedDays, 365);
  assert.ok(COMET_ACCURACY.note.length > 50 && COMET_ACCURACY.read === "2026-11-11");
});

test("the orbit line: a closed orbit closes and stays between perihelion and aphelion, an open one passes through perihelion and stops at the distance given", () => {
  const halley = findComet("halley")!;
  const line = cometOrbit(halley, 100);
  assert.equal(line.length, 101 * 3);
  assert.deepEqual([...line.slice(0, 3)], [...line.slice(300, 303)]);
  const far = halley.q * (1 + halley.e) / (1 - halley.e);
  let least = Infinity;
  let most = 0;
  for (let k = 0; k < 101; k += 1) {
    const r = Math.hypot(line[k * 3]!, line[k * 3 + 1]!, line[k * 3 + 2]!);
    least = Math.min(least, r);
    most = Math.max(most, r);
  }
  assert.ok(Math.abs(least - halley.q) < 1e-4 && Math.abs(most - far) < 1e-4 * far, `${least} ${most} ${far}`);
  const ison = findComet("ison")!;
  const open = cometOrbit(ison, 61, 10);
  assert.equal(open.length, 61 * 3);
  let nearest = Infinity;
  for (let k = 0; k < 61; k += 1) nearest = Math.min(nearest, Math.hypot(open[k * 3]!, open[k * 3 + 1]!, open[k * 3 + 2]!));
  assert.ok(Math.abs(nearest - ison.q) < 1e-6);
  assert.ok(Math.abs(Math.hypot(open[0]!, open[1]!, open[2]!) - 10) < 1e-3 && Math.abs(Math.hypot(open[180]!, open[181]!, open[182]!) - 10) < 1e-3);
  // a comet's drawn line passes through where the position function puts it
  const at = cometPosition(ison, utcOf(ison.tp));
  assert.ok(Math.abs(Math.hypot(...at) - ison.q) < 1e-9);
  // Hale-Bopp's ellipse reaches 355 au: with the default limit it is an arc, not a loop
  const hale = cometOrbit("hale-bopp", 50);
  assert.equal(hale.length, 50 * 3);
  assert.ok(Math.hypot(hale[0]!, hale[1]!, hale[2]!) <= 40 + 1e-3);
  assert.throws(() => cometOrbit("halley", 3), RangeError);
  assert.throws(() => cometOrbit("halley", 50, 0.1), RangeError);
});

test("a comet made from elements is used like one of the set", () => {
  const encke = findComet("encke")!;
  const made = cometFromElements({ designation: "2P", name: { en: "Encke", ja: "エンケ彗星" }, e: encke.e, q: encke.q, i: encke.i, node: encke.node + 360, w: encke.w, tp: encke.tp, epoch: encke.epoch });
  assert.equal(made.kind, "periodic");
  assert.equal(made.id, "2p");
  assert.equal(made.fullName, "2P (Encke)");
  assert.ok(Math.abs(made.node - encke.node) < 1e-9);
  assert.ok(Math.abs(made.periodYears! - encke.periodYears!) < 1e-4);
  const ms = utcOf(encke.epoch + 30);
  assert.ok(length(sub(cometPosition(made, ms), cometPosition(encke, ms))) < 1e-9);
  const byDate = cometFromElements({ designation: "C/2099 A1", e: 1.0004, q: 0.5, i: 20, node: 10, w: 20, perihelion: new Date(Date.UTC(2099, 5, 1)), kind: "long-period" });
  assert.ok(Math.abs(length(cometPosition(byDate, Date.UTC(2099, 5, 1))) - 0.5) < 1e-9);
  assert.equal(byDate.a, null);
  assert.equal(byDate.id, "c-2099-a1");
  assert.equal(byDate.name.ja, "");
  assert.ok(Math.abs(cometDistance(byDate, Date.UTC(2099, 5, 1)).sunAu - 0.5) < 1e-9);
  assert.ok(cometOrbit(byDate, 20).length === 60);
  assert.equal(cometPerihelia(byDate, Date.UTC(2090, 0, 1)).next !== null, true);
  assert.equal(findComet("c-2099-a1"), undefined, "the set is not changed by it");
  assert.equal(listComets().length, 34);
});

test("a bad input says what is wrong", () => {
  const good = { designation: "X", e: 0.5, q: 1, i: 10, node: 0, w: 0, tp: 2_460_000 };
  assert.throws(() => cometFromElements(null as never), TypeError);
  assert.throws(() => cometFromElements({ ...good, designation: "" }), TypeError);
  assert.throws(() => cometFromElements({ ...good, e: Number.NaN }), /e must be a finite number/);
  assert.throws(() => cometFromElements({ ...good, e: -0.1 }), RangeError);
  assert.throws(() => cometFromElements({ ...good, q: 0 }), RangeError);
  assert.throws(() => cometFromElements({ ...good, i: 181 }), RangeError);
  assert.throws(() => cometFromElements({ ...good, node: "1" as unknown as number }), TypeError);
  assert.throws(() => cometFromElements({ ...good, tp: undefined }), /tp/);
  assert.throws(() => cometFromElements({ ...good, perihelion: 1 }), /one of the two/);
  assert.throws(() => cometFromElements({ ...good, kind: "big" as "periodic" }), RangeError);
  assert.throws(() => cometFromElements({ designation: "X", e: 0.5, q: 1, i: 10, node: 0, w: 0, perihelion: new Date(Number.NaN) }), RangeError);
  for (const fn of [(w: number | Date) => cometPosition("halley", w), (w: number | Date) => cometDistance("halley", w), (w: number | Date) => cometPerihelia("halley", w), (w: number | Date) => cometTrust("halley", w)]) {
    assert.throws(() => fn(Number.NaN), RangeError);
    assert.throws(() => fn(new Date(Number.NaN)), RangeError);
    assert.throws(() => fn("2020-01-01" as unknown as number), TypeError);
    assert.doesNotThrow(() => fn(new Date(Date.UTC(2020, 0, 1))));
  }
  assert.throws(() => cometPosition("no-such-comet", 0), /no comet "no-such-comet"/);
  assert.throws(() => cometPosition(null as never, 0), TypeError);
  assert.throws(() => cometOrbit("nope"), RangeError);
  // far from the epoch is answered, not refused
  assert.ok(Number.isFinite(cometPosition("encke", Date.UTC(1900, 0, 1))[0]));
  assert.ok(Number.isFinite(cometPosition("2I", Date.UTC(2100, 0, 1))[0]));
});

test("the table is a chunk of its own: no other entry point of the package carries it", async () => {
  const root = new URL("..", import.meta.url).pathname;
  const bundle = async (contents: string) => {
    const result = await build({ stdin: { contents, resolveDir: root, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false, logLevel: "silent", platform: "browser", target: "es2020", external: ["three", "@johnmorrisdotca/kazoku-ui*"], loader: { ".css": "text", ".svg": "text", ".txt": "text" } });
    return result.outputFiles.map((file) => file.text).join("");
  };
  // two elements that appear only in the table
  const marks = ["Tsuchinshan-ATLAS", "1.000095368540586"];
  const comets = await bundle(`export * from "./src/comets.ts";`);
  for (const mark of marks) assert.ok(comets.includes(mark), `the /comets bundle holds the table (${mark})`);
  const entries = ["./src/index.ts", "./src/space/index.ts", "./src/spacecraft.ts", "./src/nearest.ts", "./src/element.ts", "./src/space/element.ts", "./src/roadster.ts", "./src/time.ts", "./src/stars.ts", "./src/suncalc.ts", "./src/coordinates.ts", "./src/data-door.ts", "./src/door/index.ts"];
  for (const entry of entries) {
    const text = await bundle(`import ${JSON.stringify(entry)};`);
    for (const mark of marks) assert.ok(!text.includes(mark), `${entry} does not carry the comet table`);
  }
  const raw = readFileSync(new URL("../src/data/comets.ts", import.meta.url));
  console.log(`comets: ${COMET_TABLE.length} records, table source ${raw.length} bytes raw, ${gzipSync(raw, { level: 9 }).length} bytes gzipped; whole /comets entry minified ${comets.length} bytes raw, ${gzipSync(comets, { level: 9 }).length} bytes gzipped`);
  assert.ok(gzipSync(raw, { level: 9 }).length < 12_000);
});
