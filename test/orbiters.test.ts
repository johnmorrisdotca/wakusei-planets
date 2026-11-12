import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ORBITER_FITS } from "../src/data/orbiters.ts";
import { BODIES } from "../src/facts.ts";
import { ORBITER_DIM_SHARE, ORBITER_FACTS, ORBITER_IDS, orbiterCentre, orbiterDim, orbiterElements, orbiterGround, orbiterGroundTrack, orbiterNextPass, orbiterFacts, orbiterNumbers, orbiterPath, orbiterPosition, orbiterSpeed, orbiterStatus, type OrbiterId } from "../src/orbiters.ts";

interface Point {
  /** Where the point is from: inside the fit's window, or in the days after it. */
  span: "fit" | "predicted";
  /** The moment as a UTC calendar date, as Horizons was asked for it (TIME_TYPE UT): Horizons does the time-scale change, not the package. */
  utc: string;
  position: [number, number, number];
  velocity: [number, number, number];
}
const fixture = JSON.parse(readFileSync(new URL("./data/orbiters-horizons.json", import.meta.url), "utf8")) as Record<string, Point[]>;
const length = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);

test("thirteen orbiters, six round the Moon and seven round Mars, each with its facts", () => {
  assert.equal(ORBITER_IDS.length, 13);
  assert.equal(ORBITER_IDS.filter((id) => orbiterCentre(id) === "moon").length, 6);
  assert.equal(ORBITER_IDS.filter((id) => orbiterCentre(id) === "mars").length, 7);
  for (const id of ORBITER_IDS) {
    const facts = orbiterFacts(id);
    assert.equal(facts.centre, orbiterCentre(id), id);
    assert.ok(facts.name.en.length > 0 && facts.name.ja.length > 0 && facts.about.en.length > 20 && facts.about.ja.length > 10, `${id} is named and described in both languages`);
    assert.ok(/^\d{4}-\d{2}(-\d{2})?/.test(facts.launch.date), `${id} has a launch date`);
    assert.equal(ORBITER_FACTS[id], facts);
  }
  assert.throws(() => orbiterCentre("iss" as OrbiterId), /no orbiter called iss/);
});

test("at a known UTC instant LRO and MRO are where Horizons put them, not 69 seconds of their motion away (UTC read as TDB would miss by 110 and 235 km)", () => {
  // Horizons, asked at the UTC calendar dates with TIME_TYPE UT on 2026-11-11 (Moon- and Mars-centred, ecliptic J2000, km): the answer is typed here, apart from the fixture file
  const lro = Date.UTC(2026, 10, 8, 3, 17, 0);
  const lroHorizons = [317.4522531231513, 341.1387337978168, 1746.994989878749];
  const here = orbiterPosition("lro", lro);
  const miss = length([here[0] - lroHorizons[0]!, here[1] - lroHorizons[1]!, here[2] - lroHorizons[2]!]);
  assert.ok(miss < orbiterElements("lro")!.fitErrorKm.max * 1.05 + 1, `LRO is ${miss.toFixed(1)} km off`);
  // the same craft read 69.184 s later is about 110 km away from that point: the time scale matters at this size
  const later = orbiterPosition("lro", lro + 69_184);
  assert.ok(length([later[0] - lroHorizons[0]!, later[1] - lroHorizons[1]!, later[2] - lroHorizons[2]!]) > 90, "a minute later LRO is far from the point");
  // MRO moves about 3.4 km/s: from the saved Horizons points, asked at UTC calendar dates
  const mro = fixture["mro"]!.find((point) => point.span === "fit")!;
  const there = orbiterPosition("mro", Date.parse(mro.utc));
  const mroMiss = length([there[0] - mro.position[0], there[1] - mro.position[1], there[2] - mro.position[2]]);
  assert.ok(mroMiss < orbiterElements("mro")!.fitErrorKm.max * 1.05 + 1, `MRO is ${mroMiss.toFixed(1)} km off`);
  const wrong = orbiterPosition("mro", Date.parse(mro.utc) + 69_184);
  assert.ok(length([wrong[0] - mro.position[0], wrong[1] - mro.position[1], wrong[2] - mro.position[2]]) > 150, "69 s of MRO's motion is over 150 km");
});

test("every craft with a path is where Horizons puts it, within the fit's own stated error, at the points held from its window", () => {
  let checked = 0;
  for (const id of ORBITER_IDS) {
    const elements = orbiterElements(id);
    const points = fixture[id];
    if (elements === undefined) {
      assert.ok(points === undefined || id === "capstone", `${id} has no path`);
      continue;
    }
    assert.ok(points !== undefined && points.filter((one) => one.span === "fit").length >= 4, `${id} has reference points`);
    for (const point of points.filter((one) => one.span === "fit")) {
      const ours = orbiterPosition(id, Date.parse(point.utc));
      const miss = length([ours[0] - point.position[0], ours[1] - point.position[1], ours[2] - point.position[2]]);
      // the test points are inside the fit's window: within the worst error measured there, with a little room for the rounding of the elements
      assert.ok(miss <= elements.fitErrorKm.max * 1.05 + 1, `${id} at ${point.utc}: ${miss.toFixed(1)} km off, the fit's worst is ${elements.fitErrorKm.max} km`);
      // the speed from the ellipse is the real speed to a few per cent on a tracked fit; a mean ellipse only (ARTEMIS, pulled about by the Earth) is rougher
      const speed = orbiterSpeed(id, Date.parse(point.utc));
      const real = length(point.velocity);
      assert.ok(Math.abs(speed - real) / real < (elements.basis === "tracked" ? 0.05 : 0.2), `${id}: speed ${speed.toFixed(3)} against Horizons' ${real.toFixed(3)} km/s`);
      checked += 1;
    }
  }
  assert.ok(checked >= 40, `${checked} points checked`);
});

test("past the fit's window each craft is where Horizons puts it within the predicted error the data states, which is the larger of the two", () => {
  let checked = 0;
  for (const id of ORBITER_IDS) {
    const elements = orbiterElements(id);
    if (elements === undefined) continue;
    const points = (fixture[id] ?? []).filter((one) => one.span === "predicted");
    if (elements.predictedErrorKm === null) {
      assert.equal(points.length, 0, `${id} has no predicted span`);
      continue;
    }
    assert.ok(points.length >= 4, `${id} has reference points past its window`);
    for (const point of points) {
      const ours = orbiterPosition(id, Date.parse(point.utc));
      const miss = length([ours[0] - point.position[0], ours[1] - point.position[1], ours[2] - point.position[2]]);
      assert.equal(orbiterStatus(id, Date.parse(point.utc)), elements.basis === "tracked" ? "predicted" : "modelled", `${id} at ${point.utc}`);
      assert.ok(miss <= elements.predictedErrorKm.max * 1.05 + 1, `${id} at ${point.utc}: ${miss.toFixed(1)} km off, the predicted worst is ${elements.predictedErrorKm.max} km`);
      checked += 1;
    }
    if (elements.basis === "tracked") assert.ok(elements.predictedErrorKm.max > elements.fitErrorKm.max, `${id}: carried on past the fit it is less exact than inside it`);
  }
  assert.ok(checked >= 30, `${checked} points checked`);
});

test("the orbits are the right size: a low lunar orbit about 100 km up, a low Mars orbit a few hundred km up, Hope far out, and ARTEMIS long and lopsided", () => {
  const when = Date.UTC(2026, 10, 11);
  const lro = orbiterNumbers("lro", when)!;
  assert.ok(lro.altitudeKm > 20 && lro.altitudeKm < 250, `LRO ${lro.altitudeKm.toFixed(0)} km up`);
  assert.ok(lro.periodDays * 24 * 60 > 100 && lro.periodDays * 24 * 60 < 130, `LRO goes round in ${(lro.periodDays * 24 * 60).toFixed(0)} minutes`);
  assert.ok(lro.inclinationDeg > 75 && lro.inclinationDeg < 105, "LRO is polar");
  const mro = orbiterNumbers("mro", when)!;
  assert.ok(mro.altitudeKm > 200 && mro.altitudeKm < 400, `MRO ${mro.altitudeKm.toFixed(0)} km up`);
  assert.ok(mro.periodDays * 24 * 60 > 105 && mro.periodDays * 24 * 60 < 120, "MRO's 112 minutes");
  const hope = orbiterElements("hope")!;
  assert.ok(hope.a > 30_000 && hope.e > 0.3 && hope.periodDays > 2 && hope.periodDays < 2.5, "Hope's high 55-hour orbit");
  const artemis = orbiterElements("artemis-p1")!;
  assert.ok(artemis.e > 0.7 && artemis.periodDays > 0.9 && artemis.periodDays < 1.2, "ARTEMIS P1's 26-hour lopsided orbit");
  assert.equal(orbiterNumbers("tianwen-1", when), undefined);
});

test("the status says where a path comes from: tracked inside the fit's window, predicted after it, modelled beyond or for a mean ellipse only, none for no path", () => {
  const lro = orbiterElements("lro")!;
  assert.equal(lro.basis, "tracked");
  assert.equal(orbiterStatus("lro", Date.parse(lro.validFrom) + 86_400_000), "tracked");
  assert.equal(orbiterStatus("lro", Date.parse(lro.fitUntil)), "tracked", "tracked to the last moment of the window");
  assert.equal(orbiterStatus("lro", Date.parse(lro.fitUntil) + 1000), "predicted");
  assert.equal(orbiterStatus("lro", Date.parse(lro.validUntil) - 86_400_000), "predicted");
  assert.equal(orbiterStatus("lro", Date.parse(lro.validUntil) + 86_400_000), "modelled");
  // predicted really appears, for every tracked craft, and its numbers state the error that goes with it
  for (const id of ORBITER_IDS) {
    const elements = orbiterElements(id);
    if (elements === undefined || elements.basis !== "tracked") continue;
    const inside = Date.parse(elements.fitUntil) - 3_600_000;
    const after = Date.parse(elements.fitUntil) + 86_400_000;
    assert.equal(orbiterStatus(id, inside), "tracked", id);
    assert.equal(orbiterStatus(id, after), "predicted", id);
    assert.equal(orbiterNumbers(id, inside)!.errorKm, elements.fitErrorKm.max, id);
    assert.equal(orbiterNumbers(id, after)!.errorKm, elements.predictedErrorKm!.max, id);
    assert.match(elements.retrieved, /^\d{4}-\d{2}-\d{2}$/, `${id} says when it was read`);
  }
  assert.equal(orbiterNumbers("artemis-p1", Date.parse(orbiterElements("artemis-p1")!.validFrom) + 86_400_000)!.errorKm, null, "a modelled path states no error");
  assert.equal(orbiterStatus("lro", Date.UTC(2020, 0, 1)), "modelled");
  assert.equal(orbiterStatus("artemis-p1", Date.parse(orbiterElements("artemis-p1")!.validFrom) + 86_400_000), "modelled");
  assert.equal(orbiterStatus("maven", Date.UTC(2026, 10, 11)), "modelled");
  assert.equal(orbiterStatus("capstone", Date.UTC(2026, 10, 11)), "none");
  assert.equal(orbiterStatus("tianwen-1", Date.UTC(2026, 10, 11)), "none");
  assert.throws(() => orbiterPosition("tianwen-1", Date.UTC(2026, 10, 11)), /no path/);
  assert.deepEqual(orbiterPath("capstone", Date.UTC(2026, 10, 11)), []);
  assert.equal(orbiterFacts("maven").status.state, "ended");
  assert.equal(orbiterFacts("capstone").status.state, "ended");
});

test("the path round one trip closes on itself, stays the ellipse's size, and passes through the craft's own place", () => {
  const when = Date.UTC(2026, 10, 11, 12);
  for (const id of ["lro", "mro", "hope", "mars-express"] as const) {
    const path = orbiterPath(id, when, 96);
    const elements = orbiterElements(id)!;
    assert.equal(path.length, 97);
    assert.ok(length([path[0]![0] - path[96]![0], path[0]![1] - path[96]![1], path[0]![2] - path[96]![2]]) < 1e-6, `${id}'s line closes`);
    const radii = path.map(length);
    assert.ok(Math.min(...radii) > elements.a * (1 - elements.e) - 1 && Math.max(...radii) < elements.a * (1 + elements.e) + 1, `${id}'s line is between periapsis and apoapsis`);
    const here = orbiterPosition(id, when);
    const nearest = Math.min(...path.map((p) => length([p[0] - here[0], p[1] - here[1], p[2] - here[2]])));
    assert.ok(nearest < 0.1 * elements.a, `${id} sits on its line (${nearest.toFixed(0)} km from the nearest point, of an orbit ${elements.a.toFixed(0)} km across)`);
  }
});

test("the line of every orbit turns by a modest angle at each of its points, whatever the eccentricity", () => {
  const when = Date.UTC(2026, 10, 11, 12);
  for (const id of ORBITER_IDS) {
    const elements = orbiterElements(id);
    if (elements === undefined) continue;
    const path = orbiterPath(id, when, 96);
    let widest = 0;
    for (let k = 0; k < 96; k += 1) {
      const a = path[k]!;
      const b = path[k + 1]!;
      const angle = (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length(a) * length(b))))) * 180) / Math.PI;
      widest = Math.max(widest, angle);
    }
    assert.ok(widest < 20, `${id} (e ${elements.e.toFixed(2)}): the line goes round the body by at most ${widest.toFixed(1)} degrees between two points`);
  }
});

test("a page draws dim a modelled path, and a predicted one only when it misses Horizons by more than 2 per cent of its body's radius; a tracked path never", () => {
  const radius = { moon: 1737.4, mars: 3389.5 } as const;
  const inside = (id: OrbiterId, which: "tracked" | "predicted"): number => {
    const e = orbiterElements(id)!;
    const from = Date.parse(which === "tracked" ? e.validFrom : e.fitUntil);
    const to = Date.parse(which === "tracked" ? e.fitUntil : e.validUntil);
    return (from + to) / 2;
  };
  // tracked: never dim
  for (const id of ["lro", "mro", "hope"] as const) {
    assert.equal(orbiterStatus(id, inside(id, "tracked")), "tracked");
    assert.equal(orbiterDim(id, inside(id, "tracked")), false, `${id} tracked`);
  }
  // predicted: dim only past the share of the radius, by the worst error measured after the fit
  let small = 0;
  let large = 0;
  for (const id of ORBITER_IDS) {
    const e = orbiterElements(id);
    if (e === undefined || e.predictedErrorKm === null) continue;
    const when = inside(id, "predicted");
    if (orbiterStatus(id, when) !== "predicted") continue;
    const limit = ORBITER_DIM_SHARE * radius[orbiterCentre(id)];
    const over = e.predictedErrorKm.max > limit;
    assert.equal(orbiterDim(id, when), over, `${id}: predicted worst ${e.predictedErrorKm.max} km against ${limit.toFixed(1)} km`);
    if (over) large += 1;
    else small += 1;
  }
  assert.ok(small >= 1 && large >= 1, `both cases met: ${small} drawn full, ${large} dim`);
  assert.ok(Math.abs(ORBITER_DIM_SHARE * radius.moon - 35) < 1 && Math.abs(ORBITER_DIM_SHARE * radius.mars - 68) < 1);
  // past the days after the fit, and before the window: modelled, dim
  const lro = orbiterElements("lro")!;
  assert.equal(orbiterStatus("lro", Date.parse(lro.validUntil) + 3_600_000), "modelled");
  assert.equal(orbiterDim("lro", Date.parse(lro.validUntil) + 3_600_000), true);
  assert.equal(orbiterDim("lro", Date.parse(lro.validFrom) - 86_400_000), true);
  // a mean ellipse only, an ended mission, and no path at all
  assert.equal(orbiterDim("artemis-p1", inside("artemis-p1", "tracked")), true);
  assert.equal(orbiterDim("maven", Date.UTC(2026, 10, 12)), true);
  assert.equal(orbiterDim("tianwen-1", Date.UTC(2026, 10, 12)), true);
});

test("each craft has a short name, and the data file's pole and prime meridian are the package's own", () => {
  for (const id of ORBITER_IDS) {
    const facts = orbiterFacts(id);
    assert.ok(facts.short.en.length > 0 && facts.short.en.length <= 14 && facts.short.ja.length > 0, `${id} has a short name`);
    const fit = ORBITER_FITS[id] as unknown as { center: "moon" | "mars"; pole?: readonly number[]; prime?: readonly number[] };
    if (orbiterElements(id) === undefined) continue;
    const body = BODIES[fit.center];
    assert.deepEqual([...fit.pole!], [body.pole.ra, body.pole.dec], `${id}'s pole`);
    assert.deepEqual([...fit.prime!], [body.prime.w0, body.prime.rate], `${id}'s prime meridian`);
  }
});

test("the inclination is to the body's equator: MRO about 92.6 degrees, TGO about 74, Hope about 25, and TGO's fit in Mars's own frame is close enough to be tracked", () => {
  assert.ok(Math.abs(orbiterElements("mro")!.i - 92.6) < 1, `MRO ${orbiterElements("mro")!.i}`);
  assert.ok(Math.abs(orbiterElements("tgo")!.i - 74) < 3, `TGO ${orbiterElements("tgo")!.i}`);
  assert.ok(Math.abs(orbiterElements("hope")!.i - 25) < 3, `Hope ${orbiterElements("hope")!.i}`);
  const tgo = orbiterElements("tgo")!;
  assert.equal(tgo.basis, "tracked");
  assert.ok(tgo.fitErrorKm.max < 60, `TGO misses Horizons by ${tgo.fitErrorKm.max} km at worst`);
});

test("the ground point is under the craft, and a polar orbit's track reaches near both poles and crosses the equator further west each trip", () => {
  const e = orbiterElements("mro")!;
  const when = (Date.parse(e.validFrom) + Date.parse(e.fitUntil)) / 2;
  const below = orbiterGround("mro", when)!;
  const p = orbiterPosition("mro", when);
  const { ra, dec } = BODIES.mars.pole;
  const r = Math.PI / 180;
  const c = Math.cos(23.4392911 * r);
  const s = Math.sin(23.4392911 * r);
  const eq = [Math.cos(dec * r) * Math.cos(ra * r), Math.cos(dec * r) * Math.sin(ra * r), Math.sin(dec * r)] as const;
  const pole = [eq[0], eq[1] * c + eq[2] * s, -eq[1] * s + eq[2] * c] as const;
  const lat = Math.asin((p[0] * pole[0] + p[1] * pole[1] + p[2] * pole[2]) / Math.hypot(...p)) / r;
  assert.ok(Math.abs(lat - below.lat) < 1e-6, `${lat} against ${below.lat}`);
  assert.ok(below.lon >= -180 && below.lon <= 180);
  const trip = e.periodDays * 86_400_000;
  const track = orbiterGroundTrack("mro", when, when + trip, 240);
  assert.equal(track.length, 241);
  assert.ok(Math.max(...track.map((q) => q.lat)) > 80 && Math.min(...track.map((q) => q.lat)) < -80, "MRO passes near both poles");
  const crossing = (from: number): number => {
    const t = orbiterGroundTrack("mro", from, from + trip, 480);
    for (let k = 1; k < t.length; k += 1) if (t[k - 1]!.lat < 0 && t[k]!.lat >= 0) return t[k]!.lon;
    throw new Error("no crossing");
  };
  const drift = (((crossing(when) - crossing(when + trip)) % 360) + 360) % 360;
  assert.ok(drift > 24 && drift < 31, `the track moves ${drift.toFixed(1)} degrees west a trip`);
  assert.deepEqual(orbiterGroundTrack("tianwen-1", when, when + 1), []);
  assert.equal(orbiterGround("capstone", when), undefined);
});

test("the next pass over a place: above the elevation asked for between its rise and set, highest in between, and the same pass when asked while it is up", () => {
  const from = Date.parse(orbiterElements("mro")!.validFrom);
  // Jezero crater, where Perseverance landed, and the Apollo 11 landing site
  for (const [id, place] of [
    ["mro", { lat: 18.4446, lon: 77.4508 }],
    ["hope", { lat: 18.4446, lon: 77.4508 }],
    ["lro", { lat: 0.6742, lon: 23.4731 }],
  ] as const) {
    const pass = orbiterNextPass(id, place, from)!;
    assert.ok(pass !== undefined, `${id} passes over within 30 days`);
    assert.ok(pass.set > from && pass.rise < pass.highest && pass.highest < pass.set, `${id}'s pass is in order (a craft up already rose before the moment asked about)`);
    assert.ok(pass.elevationDeg >= 10 && pass.elevationDeg <= 90, `${id} at best ${pass.elevationDeg.toFixed(1)} degrees`);
    const again = orbiterNextPass(id, place, pass.highest)!;
    assert.ok(Math.abs(again.rise - pass.rise) < 5000 && Math.abs(again.set - pass.set) < 5000, `${id}: asked while up, the same pass`);
    const sooner = orbiterNextPass(id, place, from, { minElevationDeg: 0 })!;
    assert.ok(sooner.rise <= pass.rise, "a lower limit finds the pass no later");
    assert.equal(pass.status, orbiterStatus(id, pass.highest));
  }
  assert.equal(orbiterNextPass("lro", { lat: 0, lon: 0 }, from, { minElevationDeg: 89.99, withinDays: 0.5 }), undefined);
  assert.equal(orbiterNextPass("tianwen-1", { lat: 0, lon: 0 }, from), undefined);
});
