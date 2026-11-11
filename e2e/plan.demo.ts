// The plan page in a real browser: two insets (the solar system and one planet's moons from above), the choices in rows of clicks, a press on a dot, the keyboard, light and dark, Japanese, and that a plan draws only when an input changes
// and not while it is out of sight. The plans are SVG, so there is no WebGL here and nothing to freeze.
import { expect, test, type Locator, type Page } from "@playwright/test";

type Plan = HTMLElement & { draws: number; plan: { marked?: string; time: number; system: string; spacing: string; extent: number; dots: { id: string; x: number; y: number; marked: boolean }[] } | undefined };

const sun = (page: Page): Locator => page.locator("wakusei-plan#plan-sun");
const moons = (page: Page): Locator => page.locator("wakusei-plan#plan-moons");
const draws = (plan: Locator): Promise<number> => plan.evaluate((el) => (el as Plan).draws);
const marked = (plan: Locator): Promise<string | undefined> => plan.evaluate((el) => (el as Plan).plan?.marked);
const open = async (page: Page, query = "?date=2026-11-11", both = true): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/plan.html${query}`);
  await expect(sun(page)).toHaveAttribute("data-state", "ready");
  // a plan below the first screen is not drawn until it is seen
  if (both) await expect(moons(page)).toHaveAttribute("data-state", "ready");
  return errors;
};
/** Two animation frames: whatever the page was going to do about a change has been done. */
const settled = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
const dot = (plan: Locator, id: string): Locator => plan.locator(`g[data-id="${id}"]`);
/** The dot's own mark, which a press lands on (the group's box also holds its name and its wider hit area, and a neighbour's hit area can lie over the middle of it). */
const shape = (plan: Locator, id: string): Locator => dot(plan, id).locator("circle:not(.hit):not(.ring), rect").first();
const search = (page: Page): Promise<string> => page.evaluate(() => location.search);

test("the page: two insets of a size to sit beside another, choices in rows of clicks, no fold-open sections, nothing scrolls sideways", async ({ page }, info) => {
  const errors = await open(page);
  for (const plan of [sun(page), moons(page)]) {
    const box = (await plan.boundingBox())!;
    expect(box.width).toBeGreaterThan(195);
    expect(box.width).toBeLessThanOrEqual(281);
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  }
  expect(await page.locator("details, summary").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // the solar system: the Sun, nine planets, a marked Mars; the moons of Jupiter
  expect(await sun(page).locator("g[data-id]").count()).toBe(10);
  expect(await marked(sun(page))).toBe("mars");
  await expect(dot(sun(page), "mars")).toHaveAttribute("data-marked", "");
  expect(await moons(page).locator("g[data-id]").count()).toBe(5);
  expect(await marked(moons(page))).toBe("io");
  await expect(page.locator("#cap-sun")).toHaveText("The solar system from above, Mars marked");
  await expect(page.locator("#cap-moons")).toHaveText("Jupiter's moons from above its north pole, Io marked");
  await page.locator(".plan-pair").screenshot({ path: info.outputPath("plan-light.png") });
  info.annotations.push({ type: "picture", description: info.outputPath("plan-light.png") });
  expect(errors).toEqual([]);
});

test("a press on a dot marks it and sends the body's id; a planet with moons also shows them beside it", async ({ page }) => {
  await open(page);
  await sun(page).evaluate((el) => {
    Reflect.set(window, "__picks", []);
    el.addEventListener("wakusei-plan-pick", (event) => (Reflect.get(window, "__picks") as unknown[]).push((event as CustomEvent).detail));
  });
  await shape(sun(page), "saturn").click();
  expect(await page.evaluate(() => Reflect.get(window, "__picks"))).toEqual([{ id: "saturn", kind: "planet" }]);
  await expect.poll(() => marked(sun(page))).toBe("saturn");
  await expect.poll(() => moons(page).evaluate((el) => (el as Plan).plan?.system)).toBe("saturn");
  expect(await marked(moons(page))).toBe("saturn");
  await shape(moons(page), "titan").click();
  await expect.poll(() => marked(moons(page))).toBe("titan");
  // the address is written a moment after the choice
  await expect.poll(() => search(page)).toContain("moon=titan");
  // a row of clicks does the same
  await page.locator('#sun-marks button[data-id="venus"]').click();
  await expect.poll(() => marked(sun(page))).toBe("venus");
});

test("the keyboard: a dot takes the focus, Enter marks it, and the focus stays on it when the plan is drawn again", async ({ page }) => {
  await open(page);
  await dot(sun(page), "venus").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => marked(sun(page))).toBe("venus");
  await expect.poll(() => sun(page).evaluate((el) => el.shadowRoot?.activeElement?.getAttribute("data-id"))).toBe("venus");
});

test("a plan draws only when an input changes: not when nothing changes, not when the same value is written, not while it is out of sight", async ({ page }) => {
  // tall enough that the page does not scroll, so the plans stay in view until the test moves them away
  await page.setViewportSize({ width: 1280, height: 1500 });
  await open(page);
  const first = await draws(sun(page));
  await settled(page);
  await settled(page);
  expect(await draws(sun(page))).toBe(first);
  // the same choice again changes nothing
  await page.locator('#spacings button[data-spacing="squeezed"]').click();
  await settled(page);
  expect(await draws(sun(page))).toBe(first);
  // one change, one draw, in each plan
  const moonsFirst = await draws(moons(page));
  await page.locator('#spacings button[data-spacing="true"]').click();
  await expect(page.locator('#spacings button[data-spacing="true"]')).toHaveAttribute("aria-pressed", "true");
  const where = await page.evaluate(() => ({ scrollY, top: document.querySelector("wakusei-plan")!.getBoundingClientRect().top, spacing: document.querySelector("wakusei-plan")!.getAttribute("spacing") }));
  await expect.poll(() => draws(sun(page)), { message: `after the click: ${JSON.stringify(where)}` }).toBe(first + 1);
  expect(await draws(moons(page))).toBe(moonsFirst + 1);
  expect(await sun(page).evaluate((el) => (el as Plan).plan?.spacing)).toBe("true");
  // out of sight: a change is not drawn until the plan is seen again
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.id = "spacer";
    spacer.style.height = "5000px";
    document.querySelector("main")!.prepend(spacer);
    window.scrollTo(0, 1000);
  });
  await settled(page);
  const before = await draws(sun(page));
  await sun(page).evaluate((el) => el.setAttribute("time", "2027-01-01T00:00Z"));
  await settled(page);
  await settled(page);
  expect(await draws(sun(page))).toBe(before);
  await sun(page).scrollIntoViewIfNeeded();
  await expect.poll(() => draws(sun(page))).toBe(before + 1);
  expect(await sun(page).evaluate((el) => (el as Plan).plan?.time)).toBe(Date.UTC(2027, 0, 1));
});

test("squeezed and to scale: to scale crowds the inner planets, squeezed spreads them, and the line at the foot says which", async ({ page }) => {
  await open(page);
  const radius = (id: string): Promise<number> => sun(page).evaluate((el, who) => { const d = (el as Plan).plan!.dots.find((one) => one.id === who)!; return Math.hypot(d.x, d.y); }, id);
  const squeezed = await radius("mercury");
  expect(squeezed).toBeGreaterThan(0.2);
  await expect(sun(page).locator("text.sc")).toHaveText("Squeezed (log) to 50 au");
  await page.locator('#spacings button[data-spacing="true"]').click();
  await expect(sun(page).locator("text.sc")).toHaveText("True scale to 50 au");
  expect(await radius("mercury")).toBeLessThan(0.01);
  expect(await radius("neptune")).toBeGreaterThan(0.5);
  await expect(moons(page).locator("text.sc")).toHaveText("True scale to 29 Jupiter radii");
});

test("the date moves the dots, in rows of clicks and in the box, and Today goes back", async ({ page }) => {
  await open(page);
  const where = (): Promise<string> => sun(page).evaluate((el) => { const d = (el as Plan).plan!.dots.find((one) => one.id === "mercury")!; return `${d.x.toFixed(4)},${d.y.toFixed(4)}`; });
  const start = await where();
  await page.locator("#steps button[data-step='30']").click();
  await expect.poll(where).not.toBe(start);
  await page.locator("#steps button[data-step='-30']").click();
  await expect.poll(where).toBe(start);
  await page.locator("#date").fill("2030-05-05");
  await expect.poll(() => sun(page).evaluate((el) => new Date((el as Plan).plan!.time).getFullYear())).toBe(2030);
  await expect.poll(() => search(page)).toContain("date=2030-05-05");
});

test("a craft or a small body can be marked: the plan stands out to hold it", async ({ page }) => {
  await open(page);
  await page.locator('#sun-marks button[data-id="sedna"]').click();
  await expect.poll(() => marked(sun(page))).toBe("sedna");
  expect(await sun(page).evaluate((el) => (el as Plan).plan?.extent)).toBe(100);
  await page.locator('#sun-marks button[data-id="voyager1"]').click();
  // the craft's path loads when it is first asked for; the plan draws again with the craft when it has
  await expect.poll(() => sun(page).evaluate((el) => (el as Plan).plan?.dots.some((one) => one.id === "voyager1"))).toBe(true);
  expect(await marked(sun(page))).toBe("voyager1");
  expect(await sun(page).evaluate((el) => (el as Plan).plan?.extent)).toBe(200);
  await expect(dot(sun(page), "voyager1")).toHaveAttribute("data-kind", "spacecraft");
});

test("light and dark follow the page, and Japanese follows the page's language", async ({ page }, info) => {
  await open(page);
  const colours = (): Promise<{ back: string; text: string; mark: string }> =>
    sun(page).evaluate((el) => ({
      back: getComputedStyle(el).backgroundColor,
      text: getComputedStyle(el.shadowRoot!.querySelector("text.t:not(.tm)")!).fill,
      mark: getComputedStyle(el.shadowRoot!.querySelector("circle.dm")!).fill,
    }));
  await page.evaluate(() => (document.documentElement.dataset["theme"] = "light"));
  const light = await colours();
  await page.evaluate(() => (document.documentElement.dataset["theme"] = "dark"));
  const dark = await colours();
  expect(dark.back).not.toBe(light.back);
  expect(dark.text).not.toBe(light.text);
  expect(dark.mark).not.toBe(light.mark);
  await page.locator(".plan-pair").screenshot({ path: info.outputPath("plan-dark.png") });
  info.annotations.push({ type: "picture", description: info.outputPath("plan-dark.png") });
  // the element's own theme attribute beats the page
  await sun(page).evaluate((el) => el.setAttribute("theme", "light"));
  expect((await colours()).back).toBe(light.back);
  // Japanese
  await page.evaluate(() => delete document.documentElement.dataset["theme"]);
  await page.goto("/wakusei-planets/plan.html?date=2026-11-11&lang=ja");
  await expect(sun(page)).toHaveAttribute("data-state", "ready");
  await expect(sun(page)).toHaveAttribute("lang", "ja");
  await expect(sun(page).locator("text.tm")).toHaveText("火星");
  await expect(sun(page).locator("text.sc")).toHaveText("対数で圧縮、縁は50 au");
  await expect(page.locator("#cap-sun")).toHaveText("真上から見た太陽系(火星に印)");
  await expect(moons(page).locator("text.tm")).toHaveText("イオ");
  await page.locator(".plan-pair").screenshot({ path: info.outputPath("plan-ja.png") });
  info.annotations.push({ type: "picture", description: info.outputPath("plan-ja.png") });
});

test("a phone: the two insets stack or sit side by side without going past the screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, "?date=2026-11-11", false);
  // the second plan is below the first screen on a phone: it is drawn when it is scrolled to
  await moons(page).scrollIntoViewIfNeeded();
  await expect(moons(page)).toHaveAttribute("data-state", "ready");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const plan of [sun(page), moons(page)]) {
    const box = (await plan.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
  }
});
