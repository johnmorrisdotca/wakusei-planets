// Deep-space craft in the space view: how many are drawn, Voyager 1 beyond the edge from the Earth, a press, and 1980.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

const PAGE = "/wakusei-planets/space.html?t=2026-11-12T12:00:00Z&speed=0&craft=all&scale=compressed";

test("deep-space craft are drawn, Voyager 1 is beyond the Earth's view, a press names it, and 1980 draws only the craft already launched", async ({ page }) => {
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { spacecraft: { count: number } } }).stats.spacecraft.count), { timeout: 60_000 }).toBeGreaterThan(4);
  await space.evaluate((el) => (el as unknown as { controller?: { set: (v: { zoom: number }, f?: boolean, r?: string) => void } }).controller?.set({ zoom: 3 }, true, "set"));

  const voyager = () => space.evaluate((el) => {
    const view = el as unknown as { sight: () => { id: string; kind: string; inView: boolean; edge?: string }[] };
    return view.sight().find((one) => one.id === "voyager1") ?? null;
  });
  await expect.poll(voyager).toMatchObject({ kind: "spacecraft", inView: false });
  const edge = await voyager();
  expect(edge?.edge === "left" || edge?.edge === "right" || edge?.edge === "top" || edge?.edge === "bottom").toBe(true);

  let faced = false;
  for (let yaw = -180; yaw < 180 && !faced; yaw += 30) {
    const draws = await space.evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws);
    await space.evaluate((el, turn) => (el as unknown as { controller?: { set: (v: { yaw: number; zoom: number }, f?: boolean, r?: string) => void } }).controller?.set({ yaw: turn, zoom: 0.4 }, true, "set"), yaw);
    await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws)).toBeGreaterThan(draws);
    faced = await space.evaluate((el) => (el as unknown as { sight: () => { id: string; inView: boolean }[] }).sight().some((one) => one.id === "voyager1" && one.inView));
  }
  expect(faced).toBe(true);
  await expect.poll(() => space.evaluate((el) => {
    const button = el.shadowRoot?.querySelector('.sp-label[data-body="voyager1"]') as HTMLButtonElement | null;
    return button !== null && !button.hidden;
  })).toBe(true);
  const clicked = space.evaluate((el) => new Promise((resolve) => {
    el.addEventListener("wakusei-body-click", (event) => resolve((event as CustomEvent<{ kind: string; id: string }>).detail), { once: true });
    (el.shadowRoot?.querySelector('.sp-label[data-body="voyager1"]') as HTMLButtonElement).click();
  }));
  await expect.poll(() => clicked).toMatchObject({ id: "voyager1", kind: "spacecraft" });

  await space.evaluate((el) => {
    (el as unknown as { time: number }).time = Date.UTC(1980, 0, 1);
  });
  await expect.poll(() => space.evaluate((el) => {
    const stats = (el as unknown as { stats: { spacecraft: { drawn: string[]; status: Record<string, string> } } }).stats.spacecraft;
    return { drawn: stats.drawn.slice().sort(), juno: stats.status.juno, voyager: stats.drawn.includes("voyager1") };
  })).toEqual({ drawn: ["pioneer10", "pioneer11", "voyager1", "voyager2"], juno: "outside", voyager: true });
});
