// An arrival keeps a companion in the picture: Jupiter one of its moons, Mercury (coming from the Earth) some other body. Reduced motion cuts the glide; the side is still chosen. Read from the element's own places and the name it shows.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

const PAGE = "/wakusei-planets/space.html?t=2026-11-11T12:00:00Z&speed=0";

test("a move to Mercury keeps a companion, and a move to Jupiter keeps a moon", async ({ page }) => {
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { distance: number } }).stats.distance)).toBeGreaterThan(1);

  const arrived = (ids: string[]) => space.evaluate((el, names) => {
    const view = el as unknown as {
      body: string;
      placeOf: (id: string) => { x: number; y: number } | null;
      clientWidth: number;
      clientHeight: number;
      stats: { companion: string | null };
      shadowRoot: ShadowRoot;
    };
    const companion = view.stats.companion;
    const at = companion === null ? null : view.placeOf(companion);
    const inside = at !== null && at.x >= 0 && at.y >= 0 && at.x <= view.clientWidth && at.y <= view.clientHeight;
    const named = [...view.shadowRoot.querySelectorAll(".sp-label:not([hidden])")].some((node) => (node as HTMLElement).dataset["body"] === companion);
    return { body: view.body, companion, inside, named, wanted: companion !== null && names.includes(companion) };
  }, ids);

  const draws = () => space.evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws);
  const beforeMercury = await draws();
  await space.evaluate((el) => (el as unknown as { goTo: (id: string) => void }).goTo("mercury"));
  await expect.poll(draws).toBeGreaterThan(beforeMercury);
  await expect.poll(() => arrived(["earth", "venus", "sun"])).toMatchObject({ body: "mercury", wanted: true, inside: true, named: true });

  await space.evaluate((el) => (el as unknown as { goTo: (id: string) => void }).goTo("earth"));
  await expect.poll(() => space.evaluate((el) => (el as unknown as { body: string }).body)).toBe("earth");
  const beforeJupiter = await draws();
  await space.evaluate((el) => (el as unknown as { goTo: (id: string) => void }).goTo("jupiter"));
  await expect.poll(draws).toBeGreaterThan(beforeJupiter);
  await expect.poll(() => arrived(["io", "europa", "ganymede", "callisto"])).toMatchObject({ body: "jupiter", wanted: true, inside: true, named: true });
});
