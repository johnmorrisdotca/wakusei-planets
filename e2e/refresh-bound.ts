// "At most one draw a screen refresh" for the freeze tests of the flat map and the flat system (MODULES-1740). A fixed bound (2 x 61 draws in a 2 s window) is a guess at the screen's refresh rate and at how long
// the window really is: the window the test asks for is a wait plus two round trips to the page and runs a little over its time, and on a hosted runner the refresh was 61 a second, so 123 draws in one
// honest run were over the bound of 122. Here the window is timed in the page itself and the animation-frame ticks of that same window are counted beside the element's draws, so the bound is the refresh
// rate of this page times this window: one draw a tick, and one more for the frame that straddles the start of the window.
import type { Locator } from "@playwright/test";

/** What a window of the page showed: the element's draws, the animation-frame ticks (the screen's refreshes as this page saw them) and how long the window was. */
export interface DrawsAgainstRefresh {
  draws: number;
  refreshes: number;
  windowMs: number;
}

/**
 * Whether the draws of a window are at most one a refresh: no more than the refreshes counted in the same window, and one more for the frame that straddles the start of it.
 * @param draws - The element's draws in the window.
 * @param refreshes - The animation-frame ticks in the same window.
 */
export const atMostOnePerRefresh = (draws: number, refreshes: number): boolean => draws <= refreshes + 1;

/**
 * The element's draws over `ms` milliseconds timed in the page, with the animation-frame ticks counted in the same window.
 * @param element - A locator of an element with a `stats.draws` count.
 * @param ms - The length of the window.
 */
export const drawsAgainstRefresh = (element: Locator, ms: number): Promise<DrawsAgainstRefresh> =>
  element.evaluate(async (el, length) => {
    const stats = (): number => (Reflect.get(el, "stats") as { draws: number }).draws;
    const start = performance.now();
    const first = stats();
    let refreshes = 0;
    let last = start;
    await new Promise<void>((done) => {
      const tick = (now: number): void => {
        refreshes += 1;
        last = now;
        if (now - start < length) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { draws: stats() - first, refreshes, windowMs: Math.round(last - start) };
  }, ms);
