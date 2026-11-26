// MODULES-1141: a name read on the frame that asked for the view can still be the placement from before it, or a name measured at no width. The page says when the placement is the one to read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { labelPlacementReady, type LabelReport } from "../src/space/labels.ts";

const placed: LabelReport = { shown: 3, settled: true, panX: 90, panY: -40, roll: 0, zoom: 2 };

test("a name is read only from the settled placement of the camera asked for", () => {
  const camera = { zoom: 2, panX: 90, panY: -40 };
  assert.equal(labelPlacementReady({ ...placed, settled: false }, camera), false);
  assert.equal(labelPlacementReady({ ...placed, panX: 0, panY: 0 }, camera), false);
  assert.equal(labelPlacementReady(placed, camera), true);
  assert.equal(labelPlacementReady({ ...placed, panX: 0, panY: 0, roll: 90 }, { zoom: 2, roll: 90 }), true);
});
