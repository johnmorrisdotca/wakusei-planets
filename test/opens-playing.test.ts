// A bare page opens with the clock running. A dated link, a speed, or reduced motion stays still.
import assert from "node:assert/strict";
import { test } from "node:test";
import { opensPlaying } from "../demo/opens-playing.ts";

const bare = { play: null, time: null, speed: null };

test("a bare page opens playing, and a named date, speed or reduced motion stays still", () => {
  assert.equal(opensPlaying(bare, false), true);
  assert.equal(opensPlaying(bare, true), false);
  assert.equal(opensPlaying({ play: "on", time: "2026-01-01T00:00:00Z", speed: "86400" }, true), true);
  assert.equal(opensPlaying({ play: null, time: "2026-01-01T00:00:00Z", speed: null }, false), false);
  assert.equal(opensPlaying({ play: null, time: null, speed: "86400" }, false), false);
  assert.equal(opensPlaying({ play: "off", time: null, speed: null }, false), false);
});
