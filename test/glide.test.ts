// How the camera leaves a body (MODULES-912): the names of the transitions, the slow launch that makes the departure seen, the turn of `look-back`, and what `auto` picks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseTransition, DEFAULT_LAUNCH_MS, DEFAULT_TURN_MS, glideDuration, glideProgress, readMs, readTransition, swingDuration, swingProgress, TRANSITIONS, travelProgress, turnProgress } from "../src/space/index.ts";

test("five named transitions, read in any case, and anything else is the fallback", () => {
  assert.deepEqual([...TRANSITIONS], ["turn-travel", "direct", "look-back", "auto", "cut"]);
  for (const name of TRANSITIONS) assert.equal(readTransition(name), name);
  assert.equal(readTransition("Look-Back"), "look-back");
  assert.equal(readTransition("  AUTO "), "auto");
  assert.equal(readTransition("sideways"), "turn-travel");
  assert.equal(readTransition("sideways", "direct"), "direct");
  assert.equal(readTransition(null), "turn-travel");
  assert.equal(readTransition(undefined, "auto"), "auto");
  assert.equal(readTransition(7), "turn-travel");
});

test("auto goes straight when the destination is in view and turns then travels when it is not; the others are what they say", () => {
  assert.equal(chooseTransition("auto", true), "direct");
  assert.equal(chooseTransition("auto", false), "turn-travel");
  assert.equal(chooseTransition("turn-travel", true), "turn-travel");
  assert.equal(chooseTransition("direct", false), "direct");
  assert.equal(chooseTransition("look-back", true), "look-back");
  assert.equal(chooseTransition("cut", true), "cut");
});

test("the times are numbers from 0 to ten seconds, and a text that is not a number is the fallback", () => {
  assert.equal(readMs("800", 500), 800);
  assert.equal(readMs(250, 500), 250);
  assert.equal(readMs(-5, 500), 0);
  assert.equal(readMs(99_999, 500), 10_000);
  assert.equal(readMs("slow", 500), 500);
  assert.equal(readMs("", 500), 500);
  assert.equal(readMs(Number.NaN, 500), 500);
  assert.equal(DEFAULT_LAUNCH_MS, 500);
  assert.equal(DEFAULT_TURN_MS, 700);
});

test("the first frames of a glide: it starts at rest, covers only about a fifth of the way in the launch time, and only then speeds up; it ends at the destination", () => {
  for (const launch of [200, 500, 900, 1500]) {
    assert.equal(glideProgress(0, launch), 0);
    const at = glideProgress(launch, launch);
    assert.ok(at > 0.18 && at < 0.23, `launch ${launch}: ${at} of the way after the launch time`);
    // the first half of the launch covers well under a tenth
    assert.ok(glideProgress(launch / 2, launch) < 0.08, `launch ${launch}: ${glideProgress(launch / 2, launch)} after half of it`);
    assert.equal(glideProgress(glideDuration(launch), launch), 1);
    assert.equal(glideProgress(glideDuration(launch) * 3, launch), 1);
    // it never goes back, and the speed rises over the launch
    let last = 0;
    let slowest = 0;
    for (let t = 0; t <= glideDuration(launch); t += glideDuration(launch) / 200) {
      const now = glideProgress(t, launch);
      assert.ok(now >= last);
      last = now;
    }
    for (let k = 0; k < 4; k += 1) {
      const a = glideProgress((k * launch) / 4, launch);
      const b = glideProgress(((k + 1) * launch) / 4, launch);
      assert.ok(b - a >= slowest - 1e-12, "faster every quarter of the launch");
      slowest = b - a;
    }
  }
  // a longer launch is a longer glide; no launch is a quick one
  assert.ok(glideDuration(1000) > glideDuration(500));
  assert.equal(glideDuration(0), 300);
  assert.ok(glideProgress(150, 0) > 0.4 && glideProgress(150, 0) < 0.6);
});

test("the turn of look-back: it keeps looking back until the last part of the trip, turns smoothly and faces the destination at the end", () => {
  const end = glideDuration(500);
  assert.equal(turnProgress(0, 500, 700), 0);
  assert.equal(turnProgress(end - 700 - 1, 500, 700), 0);
  assert.ok(Math.abs(turnProgress(end - 350, 500, 700) - 0.5) < 1e-9);
  assert.equal(turnProgress(end, 500, 700), 1);
  // a longer turn starts earlier, a turn longer than the trip fills the trip, and a turn of nothing is a cut at the end
  assert.ok(turnProgress(end / 2, 500, 1400) > turnProgress(end / 2, 500, 700));
  assert.ok(turnProgress(end / 2, 500, 99_999) > 0.4 && turnProgress(end / 2, 500, 99_999) < 0.6);
  assert.equal(turnProgress(end - 2, 500, 0), 0);
  assert.equal(turnProgress(end, 500, 0), 1);
});

test("turn then travel: the swing takes the turn time for a quarter turn and longer for more, never under 150 ms, and the travel leg is slow at both ends and fast in the middle", () => {
  assert.equal(swingDuration(700, 30), 700);
  assert.equal(swingDuration(700, 90), 700);
  assert.equal(swingDuration(700, 180), 1400);
  assert.equal(swingDuration(0, 180), 150);
  assert.equal(swingProgress(0, 700, 90), 0);
  assert.equal(swingProgress(700, 700, 90), 1);
  assert.ok(swingProgress(700, 700, 180) > 0.45 && swingProgress(700, 700, 180) < 0.55, "half way round a half turn after the quarter turn's time");
  assert.equal(travelProgress(0, 500), 0);
  assert.equal(travelProgress(glideDuration(500), 500), 1);
  const quarter = travelProgress(glideDuration(500) / 4, 500);
  const half = travelProgress(glideDuration(500) / 2, 500);
  assert.ok(quarter < 0.1, `a quarter of the time covers ${quarter.toFixed(3)} of the way: a slow start`);
  assert.ok(Math.abs(half - 0.5) < 1e-9, "half the time is half the way");
  assert.ok(travelProgress((glideDuration(500) * 3) / 4, 500) > 0.9, "a slow arrival");
});
