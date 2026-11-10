// The space view's game clock: the moment shown, kept by the page's own clock between one look and the next. Pure, no DOM: the element gives it `performance.now()`, a test gives it a clock of its own.

/** A game clock's two sources of time: the page's monotonic clock (`performance.now()`) and the wall clock (`Date.now()`), both in milliseconds. */
export interface ClockSource {
  /** The page's monotonic clock, from which the time that has passed is taken. */
  now(): number;
  /** The wall clock, for a clock that follows the real time (`"now"` at speed 1). */
  wall(): number;
}

/** The game clock `createGameClock` returns. */
export interface GameClock {
  /** The moment shown as of the last look, in milliseconds since 1970. */
  readonly time: number;
  /** Game seconds for each real second: 1 is real time, 0 holds, negative runs backwards. */
  readonly speed: number;
  /** Bring the moment up to the page's clock at `now` and return it: the time that really passed since the last look, at the speed it ran at, however few frames were drawn in between. */
  advance(now?: number): number;
  /** Set the moment shown: milliseconds since 1970, or `"now"` to follow the wall clock. */
  set(time: number | "now", now?: number): void;
  /** Change the speed. The time up to this moment is worked out at the old speed first, so a hold keeps the moment the reader saw last. */
  setSpeed(speed: number, now?: number): void;
}

/**
 * A game clock that advances by the time that really passed between two looks, never by a frame's step: at 86,400 times real time it moves a day for every real second on any machine, however
 * slowly it draws. It has no cap of its own: a page that was out of sight, or a machine that slept, finds the moment where the speed would have taken it. Time that does not pass is not counted:
 * a hold (`speed` 0) keeps the moment it had, and `set` starts the count again from the moment it is given.
 *
 * @param start - The moment to start from, in milliseconds since 1970, or `"now"` to follow the wall clock.
 * @param speed - Game seconds for each real second.
 * @param source - The page's clocks; the browser's by default (a test passes its own, such as a slowed one).
 * @returns The clock.
 */
export function createGameClock(start: number | "now", speed: number, source: ClockSource = { now: () => performance.now(), wall: () => Date.now() }): GameClock {
  let mode: number | "now" = start;
  let time = start === "now" ? source.wall() : start;
  let rate = Number.isFinite(speed) ? speed : 1;
  let last = source.now();
  const advance = (now: number): number => {
    if (rate === 1 && mode === "now") time = source.wall();
    else time += Math.max(0, now - last) * rate;
    last = Math.max(last, now);
    return time;
  };
  return {
    get time() {
      return time;
    },
    get speed() {
      return rate;
    },
    advance: (now = source.now()) => advance(now),
    set(value, now = source.now()) {
      mode = value;
      time = value === "now" ? source.wall() : value;
      last = now;
    },
    setSpeed(value, now = source.now()) {
      if (rate !== 0) advance(now);
      rate = Number.isFinite(value) ? value : 1;
      last = now;
    },
  };
}
