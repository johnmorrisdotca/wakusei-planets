// The space view's game clock keeps up with the page's clock, however few frames the machine draws (MODULES-797): a machine that draws 5 frames a second shows the same speed as one that draws 60.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createGameClock, type ClockSource } from "../src/space/clock.ts";

const DAY = 86_400_000;
const START = Date.UTC(2026, 10, 2, 14);

/** A page's clocks that a test moves by hand: `tick(ms)` is that much real time passing. */
function fakeSource(wallStart = START): ClockSource & { tick(ms: number): void } {
  let now = 1000;
  let wall = wallStart;
  return {
    now: () => now,
    wall: () => wall,
    tick(ms) {
      now += ms;
      wall += ms;
    },
  };
}

/** Run a clock for `seconds` of real time on a machine that draws `fps` frames a second, looking at it on every frame. */
function run(fps: number, seconds: number, speed: number): { moved: number } {
  const source = fakeSource();
  const clock = createGameClock(START, speed, source);
  for (let frame = 0; frame < fps * seconds; frame += 1) {
    source.tick(1000 / fps);
    clock.advance();
  }
  return { moved: clock.time - START };
}

test("at 86400 times real time a day passes each second, at 60, 30, 10, 5 and 2 frames a second", () => {
  for (const fps of [60, 30, 10, 5, 2]) {
    const { moved } = run(fps, 2, 86_400);
    assert.ok(Math.abs(moved / (2 * DAY) - 1) < 0.01, `${fps} frames a second moved ${(moved / DAY).toFixed(3)} days in 2 s, not 2`);
  }
});

test("a slow machine (5 frames a second) moves 2 days in 2 s within 1 percent, and the same backwards", () => {
  const forward = run(5, 2, 86_400).moved;
  const backward = run(5, 2, -86_400).moved;
  assert.ok(Math.abs(forward - 2 * DAY) < 0.01 * 2 * DAY, `${forward / DAY} days`);
  assert.ok(Math.abs(backward + 2 * DAY) < 0.01 * 2 * DAY, `${backward / DAY} days`);
});

test("it does not matter how many times it is looked at: one look after 2 s is the same as 10 looks", () => {
  const source = fakeSource();
  const clock = createGameClock(START, 3600, source);
  source.tick(2000);
  assert.equal(clock.advance(), START + 2 * 3600_000);
  const looked = createGameClock(START, 3600, source);
  for (let i = 0; i < 10; i += 1) {
    source.tick(200);
    looked.advance();
  }
  assert.equal(looked.time, START + 2 * 3600_000);
});

test("a long gap counts in full: a page that was hidden finds the moment the speed would have taken it to", () => {
  const source = fakeSource();
  const clock = createGameClock(START, 60, source);
  source.tick(10 * 60_000);
  assert.equal(clock.advance(), START + 10 * 60_000 * 60);
});

test("a hold keeps the moment it was held at, and a speed set later starts from there", () => {
  const source = fakeSource();
  const clock = createGameClock(START, 86_400, source);
  source.tick(500);
  clock.setSpeed(0);
  assert.equal(clock.time, START + DAY / 2, "the half second before the hold counts");
  source.tick(5000);
  assert.equal(clock.advance(), START + DAY / 2, "nothing moves while held");
  clock.setSpeed(3600);
  source.tick(1000);
  assert.equal(clock.advance(), START + DAY / 2 + 3600_000, "the hold's five seconds are not counted");
});

test("a speed change counts the time up to it at the old speed, and not a moment more", () => {
  const source = fakeSource();
  const clock = createGameClock(START, 1000, source);
  source.tick(300);
  clock.setSpeed(10);
  source.tick(1000);
  assert.equal(clock.advance(), START + 300 * 1000 + 1000 * 10);
});

test("setting the moment starts the count again from it", () => {
  const source = fakeSource();
  const clock = createGameClock(START, 86_400, source);
  source.tick(1000);
  const chosen = Date.UTC(2030, 0, 1);
  clock.set(chosen);
  assert.equal(clock.time, chosen);
  source.tick(250);
  assert.equal(clock.advance(), chosen + DAY / 4);
});

test("now at real time follows the wall clock, and now at another speed starts from it", () => {
  const source = fakeSource();
  const real = createGameClock("now", 1, source);
  assert.equal(real.time, START);
  source.tick(90_000);
  assert.equal(real.advance(), START + 90_000, "real time follows the wall clock");
  const fast = createGameClock("now", 60, source);
  source.tick(1000);
  assert.equal(fast.advance(), START + 90_000 + 60_000);
});

test("a speed that is not a number is real time, and a clock never runs on a page clock that goes back", () => {
  const source = fakeSource();
  const clock = createGameClock(START, Number.NaN, source);
  assert.equal(clock.speed, 1);
  const fixed = createGameClock(START, 1000, { now: () => 1000, wall: () => START });
  assert.equal(fixed.advance(500), START, "a look at an earlier moment moves nothing");
  assert.equal(fixed.advance(1500), START + 500_000, "and the count goes on from the latest look");
});
