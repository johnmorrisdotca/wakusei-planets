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
