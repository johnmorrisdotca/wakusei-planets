// The page's clock, driven by the test. A rate or a time bound measured in wall time (draws in five seconds, days in a second) depends on how fast the machine is; on a busy one it passes or fails by luck. Here the page's clock (Date, timers, animation
// frames) is taken over before the page loads, left to run while the page loads (its network is real), then held: from then on time moves only when the test says so, and a count is a count of what happens in the seconds it moved.
import type { Page } from "@playwright/test";

/** The moment the page's clock starts at. */
export const CLOCK_START = new Date(Date.UTC(2026, 10, 2, 14));

/** Take over the page's clock. Before `page.goto`. */
export const takeClock = (page: Page): Promise<void> => page.clock.install({ time: CLOCK_START });

/** Hold the page's clock where it is: nothing runs, no timer and no frame, until `advance`. */
export async function holdClock(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
}

/** Let `ms` of the page's time pass, running every timer and frame that falls in it, in order. */
export const advance = (page: Page, ms: number): Promise<void> => page.clock.runFor(ms);
