// The size budget does not fail on a different zlib: the same minified bytes gzip to 5667 B on one Node and 5987 B on another.
import assert from "node:assert/strict";
import test from "node:test";
import { overBudget } from "../scripts/check-size.mjs";

test("the same minified bundle passes whichever zlib gzipped it, and a bundle that grew still fails", () => {
  assert.deepEqual(overBudget({ "./a": 5987 }, { "./a": 5667 }, { "./a": 12514 }, { "./a": 12514 }), []);
  assert.equal(overBudget({ "./a": 6400 }, { "./a": 6000 }, { "./a": 14000 }, { "./a": 13000 }).length, 1);
  assert.equal(overBudget({ "./a": 5987 }, { "./a": 5667 }).length, 1, "a baseline with no minified size keeps the gzipped rule");
  assert.equal(overBudget({ "./a": 6500 }, {}, {}, {}).length, 1, "no baseline");
});
