// How many places the space view's Earth carries at 60 frames a second: the time its places step takes (reading the list, leaving out the layers that are off, laying every place in the list and moving the 32 markers) at 100, 1,000 and 5,000
// places, against the 16.7 ms a frame has at 60 a second. The step runs inside the draw the view makes anyway, and with no places it adds none. Chromium, drawing in software; the times are the page's own (`performance.now`), not the draw's.
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

/** `count` places spread over the globe (a Fibonacci spiral), each named, a quarter of them in the layer `b`. */
const listOf = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const lat = (Math.asin(1 - (2 * (i + 0.5)) / count) * 180) / Math.PI;
    const lon = ((i * 137.508) % 360) - 180;
    return { id: `p${i}`, lon, lat, label: `Place ${i}`, kind: i === 0 ? "here" : "favourite", layer: i % 4 === 0 ? "b" : "a" };
  });
const shownCount = (page: Page): Promise<number> => page.locator(SPACE).evaluate((el) => (Reflect.get(el, "earthPlacesShown") as { marks: unknown[] }).marks.length);

/** The time of one lay of the places, from a switch of the look (which lays them at once, from the last draw's Earth): the median and the slowest tenth of 120 switches, in milliseconds. */
const laid = (page: Page): Promise<{ median: number; p90: number }> =>
  page.locator(SPACE).evaluate((el) => {
    const looks = ["pin", "beam"];
    const times: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      const start = performance.now();
      el.setAttribute("earth-places-look", looks[i % 2]!);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return { median: times[60]!, p90: times[108]! };
  });

const BUDGET_MS = 1000 / 60;

for (const count of [100, 1000, 5000]) {
  test(`${count} places: laying them takes a fraction of a 60 frames a second frame`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
    await callOn(page, "setAttribute", "center", "10,20");
    await callOn(page, "setAttribute", "earth-places", JSON.stringify(listOf(count)));
    await expect.poll(() => shownCount(page), { timeout: 60_000 }).toBe(32);
    const all = await laid(page);
    await callOn(page, "setAttribute", "earth-place-layers", JSON.stringify({ b: false }));
    await expect.poll(async () => (await page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlacesShown") as { hidden: number })).hidden).toBe(Math.ceil(count / 4));
    const layered = await laid(page);
    const line = `${count} places: ${all.median.toFixed(2)} ms median, ${all.p90.toFixed(2)} ms slowest tenth; layer b off (a quarter left out): ${layered.median.toFixed(2)} ms median, ${layered.p90.toFixed(2)} ms slowest tenth; a frame at 60 a second is ${BUDGET_MS.toFixed(1)} ms`;
    testInfo.annotations.push({ type: "measured", description: line });
    console.log(line);
    // the cap is 1,000: the step takes under a third of a 60 frames a second frame there, even with the CPU slowed to a quarter (it takes about a twentieth at full speed); the 5,000 the list is cut to must fit in half a frame at full speed
    if (count === 1000) expect(all.median, "1,000 places lay in under a third of a frame").toBeLessThan(BUDGET_MS / 3);
    if (count === 5000 && !process.env.CPU_THROTTLE) expect(all.median, "5,000 places lay in under half a frame").toBeLessThan(BUDGET_MS / 2);
  });
}
