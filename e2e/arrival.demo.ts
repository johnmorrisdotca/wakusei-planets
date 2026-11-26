// An arrival keeps a companion in the picture: Jupiter one of its moons, Mercury (coming from the Earth) some other body. Reduced motion cuts the glide; the side is still chosen. Read from the element's own places and the name it shows.
import "./load.ts";
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

const PAGE = "/wakusei-planets/space.html?t=2026-11-11T12:00:00Z&speed=0";

test("a move to Mercury keeps a companion, and a move to Jupiter keeps a moon", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { distance: number } }).stats.distance), { timeout: 60_000, message: "the view has a distance" }).toBeGreaterThan(1);
  // a busy machine: every frame comes SLOW ms after it was asked for (MODULES-1588: at a host load of 45 a poll ran out of its 5 s while the frame it waited for was seconds away: every wait here has 60 s)
  await page.evaluate((slow) => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => raf((now) => void setTimeout(() => callback(now), slow));
  }, Number(process.env.SLOW ?? 1500));

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
  // the count is taken in the same call as the move: a draw between the two would be taken for the move's
  const beforeMercury = await space.evaluate((el) => {
    const view = el as unknown as { goTo: (id: string) => void; stats: { draws: number } };
    const draws = view.stats.draws;
    view.goTo("mercury");
    return draws;
  });
  await expect.poll(draws, { timeout: 60_000, message: "a frame draws the move to Mercury" }).toBeGreaterThan(beforeMercury);
  await expect.poll(() => arrived(["earth", "venus", "sun"]), { timeout: 60_000, message: "Mercury has a companion in the picture, named" }).toMatchObject({ body: "mercury", wanted: true, inside: true, named: true });

  await space.evaluate((el) => (el as unknown as { goTo: (id: string) => void }).goTo("earth"));
  await expect.poll(() => space.evaluate((el) => (el as unknown as { body: string }).body), { timeout: 60_000, message: "the camera is at the Earth" }).toBe("earth");
  // the count is taken in the same call as the move: a draw between the two would be taken for the move's
  const beforeJupiter = await space.evaluate((el) => {
    const view = el as unknown as { goTo: (id: string) => void; stats: { draws: number } };
    const draws = view.stats.draws;
    view.goTo("jupiter");
    return draws;
  });
  await expect.poll(draws, { timeout: 60_000, message: "a frame draws the move to Jupiter" }).toBeGreaterThan(beforeJupiter);
  await expect.poll(() => arrived(["io", "europa", "ganymede", "callisto"]), { timeout: 60_000, message: "Jupiter has a moon in the picture, named" }).toMatchObject({ body: "jupiter", wanted: true, inside: true, named: true });
});
