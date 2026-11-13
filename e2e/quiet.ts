// Waits for a view to have finished drawing what it was asked for: its own draw count (`stats.draws`, on <wakusei-body> and <wakusei-space>) has held still for four reads in a row, 250 ms apart, which is longer than a frame on a slow
// runner; with `moons`, the moons out of sight have been let go too (a view at rest, not one whose clock runs). Everything that arrives late (a texture, a tile, a table) shows as a draw, so a count that holds still means it has all come. A view whose clock runs never holds still: hold the clock first.
import { expect, type Page } from "@playwright/test";

export async function quietElement(page: Page, selector: string, timeout = 60_000, { moons = false }: { moons?: boolean } = {}): Promise<void> {
  let held = 0;
  let last = -1;
  await expect
    .poll(
      async () => {
        const read = await page.locator(selector).evaluate((el) => {
          const stats = Reflect.get(el, "stats") as { draws?: number; pictures?: { pending: number }; bodies?: { held: number; moons: number } } | undefined;
          return { draws: Number(stats?.draws ?? -1), pending: Number(stats?.pictures?.pending ?? 0), letGo: stats?.bodies === undefined || stats.bodies.held === stats.bodies.moons };
        });
        // the pictures still being fetched will each draw a frame when they arrive (`stats.pictures.pending`): not at rest until none is
        const now = read.draws;
        held = now === last && now >= 0 && read.pending === 0 && (!moons || read.letGo) ? held + 1 : 0;
        last = now;
        return held;
      },
      { timeout, intervals: [250], message: `${selector} held still` },
    )
    .toBeGreaterThanOrEqual(4);
}
