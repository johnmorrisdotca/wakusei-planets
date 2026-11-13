// Names written on a body: fame first, then size, only the side facing the camera, and more of them as the body grows on the screen.
import assert from "node:assert/strict";
import { test } from "node:test";
import { marksToShow, placeRank, readSurfaceNames, surfacePoint, type SurfaceView } from "../src/place-marks.ts";
import { PLACES_MARS } from "../src/data/places-mars.ts";
import { PLACES_MOON } from "../src/data/places-moon.ts";

const view = (radiusPx: number, toward: [number, number, number]): SurfaceView => ({
  centre: [0, 0, 0], radius: 1, pole: [0, 1, 0], meridian: [0, 0, 1], scale: [1, 1, 1], toward,
  project: (p) => ({ x: 400 + p[0] * radiusPx, y: 400 - p[1] * radiusPx }),
  width: 800, height: 800, radiusPx,
});

const ids = (radiusPx: number, toward: [number, number, number] = [0, 0, 1]) => new Set(marksToShow(PLACES_MOON, [], view(radiusPx, toward), 1737.4, readSurfaceNames(null)).map((mark) => mark.place.id));

test("fame ranks ahead of size, and a larger feature ranks ahead of a smaller one", () => {
  const tycho = PLACES_MOON.find((place) => place.id === "moon/tycho")!;
  const imbrium = PLACES_MOON.find((place) => place.id === "moon/mare-imbrium")!;
  const plain = PLACES_MOON.find((place) => place.kind === "feature" && !("famous" in place && place.famous === true) && (place.feature?.diameterKm ?? 0) > tycho.feature!.diameterKm)!;
  assert.ok(placeRank(imbrium) < placeRank(tycho), "Mare Imbrium is larger than Tycho and both are famous");
  assert.ok(placeRank(tycho) < placeRank(plain), "a famous crater ranks ahead of a larger one that is not famous");
  assert.deepEqual(readSurfaceNames(null), { on: true, limit: null });
  assert.equal(readSurfaceNames("off").on, false);
  assert.equal(readSurfaceNames("8").limit, 8);
});

test("the Moon at fit shows Mare Imbrium and Tycho, a closer view shows a smaller crater, and the far side shows neither", () => {
  const fitted = ids(320);
  assert.ok(fitted.has("moon/mare-imbrium"), "Mare Imbrium is named at fit");
  assert.ok(fitted.has("moon/tycho"), "Tycho is named at fit");
  const close = ids(900);
  const extra = [...close].filter((id) => !fitted.has(id) && !("famous" in (PLACES_MOON.find((place) => place.id === id) ?? {}) && (PLACES_MOON.find((place) => place.id === id) as { famous?: true }).famous === true));
  assert.ok(extra.length > 0, "a closer view names a crater that is not famous");
  const far = ids(320, [0, 0, -1]);
  assert.equal(far.has("moon/mare-imbrium"), false);
  assert.equal(far.has("moon/tycho"), false);
});

test("Mars names Olympus Mons, Valles Marineris and Hellas on the side that faces the camera", () => {
  const shows = (id: string): boolean => {
    const place = PLACES_MARS.find((one) => one.id === id)!;
    const { normal } = surfacePoint(view(220, [0, 0, 1]), place.lat, place.lon);
    const toward: [number, number, number] = [normal[0], normal[1], normal[2]];
    return marksToShow(PLACES_MARS, [], view(220, toward), 3396.2, readSurfaceNames(null)).some((mark) => mark.place.id === id);
  };
  for (const id of ["mars/olympus-mons", "mars/valles-marineris", "mars/hellas-planitia"]) assert.ok(shows(id), id);
});

test("a name never lies over a dot that stays, nor over another name, and moves aside or gives way", () => {
  const radiusPx = 320;
  const v = view(radiusPx, [0, 0, 1]);
  const plain = marksToShow(PLACES_MOON, [], v, 1737.4, readSurfaceNames(null));
  assert.ok(plain.length > 2);
  const names = (list: typeof plain) => list.filter((mark) => mark.label === true);
  // a dot set right on the first name's spot: the name moves off it or is dropped, never lies over it
  const first = names(plain)[0]!;
  const dot = { x: first.x, y: first.y, halfWidth: 12, halfHeight: 12 };
  const after = names(marksToShow(PLACES_MOON, [], v, 1737.4, readSurfaceNames(null), [dot]));
  const again = after.find((mark) => mark.place.id === first.place.id);
  if (again !== undefined) assert.ok(Math.abs(again.x - dot.x) >= 12 + 3 || Math.abs(again.y - dot.y) >= 12 + 9, "moved clear of the dot");
  for (const mark of after) assert.ok(!(Math.abs(mark.x - dot.x) < 12 + 3 && Math.abs(mark.y - dot.y) < 12 + 9), `${mark.place.id} is over the dot`);
  // no two names overlap
  for (const a of names(plain)) {
    for (const b of names(plain)) {
      if (a === b) continue;
      const wa = Math.ceil(a.place.name.en.length * 3.7) + 5;
      const wb = Math.ceil(b.place.name.en.length * 3.7) + 5;
      assert.ok(Math.abs(a.x - b.x) >= wa + wb || Math.abs(a.y - b.y) >= 18, `${a.place.id} and ${b.place.id} overlap`);
    }
  }
  // a dot the page drew in the layers asked for is an obstacle too: a landing dot is never under a name
  const withDots = marksToShow(PLACES_MOON, ["landing"], v, 1737.4, readSurfaceNames(null));
  for (const landing of withDots.filter((mark) => mark.label !== true)) {
    for (const name of withDots.filter((mark) => mark.label === true)) {
      const w = Math.ceil(name.place.name.en.length * 3.7) + 5;
      assert.ok(!(Math.abs(name.x - landing.x) < w + 12 && Math.abs(name.y - landing.y) < 9 + 12), `${name.place.id} is over the dot of ${landing.place.id}`);
    }
  }
});

test("Tycho, a famous crater, is named once the Moon is big enough for a dozen names, whatever its tilt: a name nudges to find room and does not give way to a larger crater beside it", () => {
  const rad = Math.PI / 180;
  const tycho = PLACES_MOON.find((place) => place.id === "moon/tycho")!;
  for (const tilt of [0, 5, 7, 9, 12]) {
    for (const radiusPx of [240, 280, 320, 400]) {
      const size = Math.round(radiusPx * 2 + 70);
      // the view looks at Sinus Medii (0, 0); the pole leans toward the camera by `tilt` degrees, as a libration does
      const pole: [number, number, number] = [0, Math.cos(tilt * rad), Math.sin(tilt * rad)];
      const view: SurfaceView = {
        centre: [0, 0, 0], radius: 1, pole, meridian: [0, -Math.sin(tilt * rad), Math.cos(tilt * rad)], scale: [1, 1, 1], toward: [0, 0, 1],
        project: (p) => ({ x: size / 2 + p[0] * radiusPx, y: size / 2 - p[1] * radiusPx }), width: size, height: size, radiusPx,
      };
      const marks = marksToShow(PLACES_MOON, [], view, 1737.4, readSurfaceNames(null));
      assert.ok(marks.some((mark) => mark.place.id === tycho.id), `Tycho is named at ${radiusPx} px with the pole leaning ${tilt} degrees`);
    }
  }
});

test("names are few on a small Moon: none below 70 px, at most a twentieth of the radius, none wider than the disc, and they fade in above the floor", () => {
  const rad = Math.PI / 180;
  const make = (radiusPx: number): SurfaceView => {
    const size = Math.round(radiusPx * 2 + 70);
    return { centre: [0, 0, 0], radius: 1, pole: [0, 1, 0], meridian: [0, 0, 1], scale: [1, 1, 1], toward: [0, 0, 1], project: (p) => ({ x: size / 2 + p[0] * radiusPx, y: size / 2 - p[1] * radiusPx }), width: size, height: size, radiusPx };
  };
  void rad;
  // the radii measured on a phone: 38, 49, 61, 76 and 106 px
  for (const [radiusPx, most] of [[38, 0], [49, 0], [61, 0], [69, 0], [76, 3], [106, 5]] as const) {
    const names = marksToShow(PLACES_MOON, [], make(radiusPx), 1737.4, readSurfaceNames(null)).filter((mark) => mark.label === true);
    assert.ok(names.length <= most, `${names.length} names at ${radiusPx} px, at most ${most}`);
    for (const mark of names) assert.ok((Math.ceil(mark.place.name.en.length * 3.7) + 5) <= radiusPx, `${mark.place.name.en} is wider than a disc of ${radiusPx} px`);
  }
  // 76 px is inside the band above the floor: they come in at part strength; 90 px and over at full
  const faded = marksToShow(PLACES_MOON, [], make(76), 1737.4, readSurfaceNames(null)).filter((mark) => mark.label === true);
  assert.ok(faded.length > 0 && faded.every((mark) => (mark.fade ?? 1) <= 0.31), "at 76 px they are only coming in");
  const full = marksToShow(PLACES_MOON, [], make(200), 1737.4, readSurfaceNames(null)).filter((mark) => mark.label === true);
  assert.ok(full.length > 5 && full.some((mark) => (mark.fade ?? 0) > 0.9), "at 200 px they are written at full strength");
});

test("the names a reader knows come first: on the Moon the four great seas, then Tycho and Copernicus; on Mars Olympus Mons, Valles Marineris, Hellas, the Tharsis volcanoes and Gale", () => {
  const top = (list: typeof PLACES_MOON, count: number) => list.filter((place) => place.kind === "feature").sort((a, b) => placeRank(a) - placeRank(b)).slice(0, count).map((place) => place.name.en);
  assert.deepEqual(top(PLACES_MOON, 6), ["Mare Imbrium", "Mare Tranquillitatis", "Oceanus Procellarum", "Mare Serenitatis", "Tycho", "Copernicus"]);
  assert.deepEqual(top(PLACES_MARS, 7), ["Olympus Mons", "Valles Marineris", "Hellas Planitia", "Arsia Mons", "Ascraeus Mons", "Pavonis Mons", "Gale"]);
  // six names on a phone's Moon (133 px) are not six seas: Tycho and Copernicus are among them
  const size = 133 * 2 + 40;
  const view: SurfaceView = { centre: [0, 0, 0], radius: 1, pole: [0, 1, 0], meridian: [0, 0, 1], scale: [1, 1, 1], toward: [0, 0, 1], project: (p) => ({ x: size / 2 + p[0] * 133, y: size / 2 - p[1] * 133 }), width: size, height: size, radiusPx: 133 };
  const written = marksToShow(PLACES_MOON, [], view, 1737.4, readSurfaceNames(null)).map((mark) => mark.place.name.en);
  assert.equal(written.length, 6);
  assert.ok(written.includes("Tycho") && written.includes("Copernicus"), `Tycho and Copernicus among ${written.join(", ")}`);
});
