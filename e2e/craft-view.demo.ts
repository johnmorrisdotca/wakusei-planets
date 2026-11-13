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

  // Voyager 1 is in view for about 30 degrees of yaw (in a view as tall as wide, 35 degrees of sight), so turn in steps of 10 and not one that can land on the edge of it
  let faced = false;
  for (let yaw = -180; yaw < 180 && !faced; yaw += 10) {
    // the draw count is read in the same breath as the turn: a draw that lands between a separate read and the turn (a tile or a table arriving on a slow runner) would end the wait on a picture of the view before the turn
    const turned = await space.evaluate((el, turn) => {
      const view = el as unknown as { stats: { draws: number }; controller: { state: unknown; set: (v: { yaw: number; zoom: number }, f?: boolean, r?: string) => void } };
      const [draws, was] = [view.stats.draws, JSON.stringify(view.controller.state)];
      view.controller.set({ yaw: turn, zoom: 0.4 }, true, "set");
      return { draws, changed: JSON.stringify(view.controller.state) !== was };
    }, yaw);
    // a turn that leaves the view as it was draws nothing, so wait for a draw only when the view changed
    if (turned.changed) await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws)).toBeGreaterThan(turned.draws);
    faced = await space.evaluate((el) => (el as unknown as { sight: () => { id: string; inView: boolean }[] }).sight().some((one) => one.id === "voyager1" && one.inView));
  }
  expect(faced).toBe(true);
  await expect.poll(() => space.evaluate((el) => {
    const button = el.shadowRoot?.querySelector('.sp-label[data-body="voyager1"]') as HTMLButtonElement | null;
    return button !== null && !button.hidden;
  })).toBe(true);
  const view = () => space.evaluate((el) => JSON.stringify({ state: (el as unknown as { controller: { state: unknown } }).controller.state, body: (el as unknown as { body: string }).body }));
  const viewBefore = await view();
  const clicked = space.evaluate((el) => new Promise((resolve) => {
    el.addEventListener("wakusei-body-click", (event) => resolve((event as CustomEvent<{ kind: string; id: string }>).detail), { once: true });
    (el.shadowRoot?.querySelector('.sp-label[data-body="voyager1"]') as HTMLButtonElement).click();
  }));
  await expect.poll(() => clicked).toMatchObject({ id: "voyager1", kind: "spacecraft" });
  expect(await view(), "a pick does not move the camera").toBe(viewBefore);

  await space.evaluate((el) => {
    (el as unknown as { time: number }).time = Date.UTC(1980, 0, 1);
  });
  await expect.poll(() => space.evaluate((el) => {
    const stats = (el as unknown as { stats: { spacecraft: { drawn: string[]; status: Record<string, string> } } }).stats.spacecraft;
    return { drawn: stats.drawn.slice().sort(), juno: stats.status.juno, voyager: stats.drawn.includes("voyager1") };
  })).toEqual({ drawn: ["pioneer10", "pioneer11", "voyager1", "voyager2"], juno: "outside", voyager: true });
});

test("a craft's name can be hovered and focused without a fault, and the Roadster is not drawn twice when its own switch is on", async ({ page }) => {
  const faults: string[] = [];
  page.on("pageerror", (error) => faults.push(error.message));
  await page.goto(`${PAGE}&starman=1`);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { spacecraft: { count: number } } }).stats.spacecraft.count), { timeout: 60_000 }).toBeGreaterThan(4);
  const drawn = await space.evaluate((el) => (el as unknown as { stats: { spacecraft: { drawn: string[]; status: Record<string, string> } } }).stats.spacecraft);
  expect(drawn.drawn).not.toContain("roadster");
  expect(drawn.status["roadster"]).toBeUndefined();
  await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { roadster: { shown: boolean } } }).stats.roadster.shown)).toBe(true);

  const focused = space.evaluate((el) => new Promise((resolve) => {
    el.addEventListener("wakusei-body-focus", (event) => resolve((event as CustomEvent<{ kind: string; id: string }>).detail), { once: true });
    const names = el.shadowRoot?.querySelectorAll<HTMLButtonElement>(".sp-label[data-body]") ?? [];
    const one = Array.from(names).find((button) => button.dataset["body"] === "voyager2" || button.dataset["body"] === "pioneer10" || button.dataset["body"] === "voyager1");
    one?.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    if (one === undefined) resolve(null);
  }));
  expect(await focused).toMatchObject({ kind: "spacecraft" });
  expect(faults).toEqual([]);
});
