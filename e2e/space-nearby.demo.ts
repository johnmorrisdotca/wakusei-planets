import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { quiet } from "./space-ui.ts";
import "./load.ts";

const DEMO = "/wakusei-planets/space.html?t=2020-12-01T12:00Z&play=off&belts=0";
const pairOf = (page: Page): Promise<string[]> => page.locator("#space").evaluate((el) => Reflect.get(el, "highlightedBodies"));

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "chromium", "software WebGL in Chromium");
});

test("nearby has the right units, highlights the pair and follows a different body", async ({ page }) => {
  await page.goto(DEMO);
  const panel = page.getByRole("tabpanel", { name: "Nearby" });
  await panel.scrollIntoViewIfNeeded();
  await expect(panel.locator("#nearby-target")).toHaveText("Near Earth");
  await expect(panel.getByRole("button", { name: "Angle in Earth's sky" })).toBeDisabled();
  await expect(panel.locator("#nearby-note")).toContainText("Sky angles are measured from Earth. Distances at ");
  await expect(panel.locator("#nearby-note")).not.toContainText("..");
  const moon = panel.locator("#nearby-results button").first();
  await expect(moon).toContainText(/Moon.*km/);
  await moon.click();
  await expect.poll(() => pairOf(page)).toEqual(["earth", "moon"]);
  await expect(page.locator("#caption")).toHaveText("Highlighted Earth and Moon.");

  await page.locator("#gotos [data-goto=sun]").click();
  await expect(panel.locator("#nearby-target")).toHaveText("Near Sun");
  const sky = panel.getByRole("button", { name: "Angle in Earth's sky" });
  await sky.click();
  await expect(sky).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("#nearby-results li")).toHaveCount(5);
  await expect(panel.locator("#nearby-results button").first()).toContainText(/°/);
  await expect.poll(() => pairOf(page)).toEqual([]);
});

test("keyboard switches tabs and a close approach holds the clock at its own date", async ({ page }) => {
  await page.goto(DEMO);
  const first = page.getByRole("tab", { name: "Nearby" });
  await first.focus();
  await first.press("ArrowRight");
  const next = page.getByRole("tab", { name: "Next close approaches" });
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute("aria-selected", "true");
  const event = page.getByRole("button", { name: /Jupiter and Saturn/ });
  await expect(event.locator("time")).toHaveAttribute("datetime", /^2020-12-21T18:25:/);
  await expect(event.locator("time + span")).toHaveText("0.1°");
  const cards = page.locator("#approaches-results button");
  expect(await cards.evaluateAll((buttons) => buttons.every((button) => {
    const date = button.querySelector("time")!;
    const angle = date.nextElementSibling!;
    const text = document.createRange();
    text.selectNodeContents(date);
    return text.getClientRects().length === 1 && angle.getBoundingClientRect().top >= date.getBoundingClientRect().bottom
      && button.scrollWidth <= button.clientWidth;
  }))).toBe(true);
  await event.press("Enter");
  await expect(next).toBeFocused();
  await expect.poll(() => pairOf(page)).toEqual(["jupiter", "saturn"]);
  await expect(page.locator("#caption")).toHaveText("Highlighted Jupiter and Saturn.");
  await expect.poll(() => page.locator("#space").evaluate((el) => new Date(Reflect.get(el, "time")).toISOString())).toMatch(/^2020-12-21T18:25:/);
  expect(await page.locator("#space").evaluate((el) => Reflect.get(el, "speed"))).toBe(0);
  await page.locator("#sky").scrollIntoViewIfNeeded();
  for (const id of ["jupiter", "saturn"]) {
    const label = page.locator(`#space .sp-label[data-body="${id}"]`);
    await expect(label).toBeVisible();
    await expect(label).not.toHaveAttribute("data-far");
  }
  await next.press("Home");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-selected", "true");
});

test("nearby keeps its date during playback and refreshes when the clock pauses", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desk", "one viewport checks the clock");
  await page.goto(`${DEMO}&speed=86400`);
  const note = page.locator("#nearby-note");
  await note.scrollIntoViewIfNeeded();
  await expect(page.locator("#nearby-results li")).toHaveCount(5);
  const initial = await note.textContent();
  const readTime = (): Promise<number> => page.locator("#space").evaluate((el) => Reflect.get(el, "time"));
  const start = await readTime();
  const play = page.locator('#replay [data-act="play"]');
  await play.dispatchEvent("click");
  await expect.poll(readTime).toBeGreaterThan(start + 43_200_000);
  await expect(note).toHaveText(initial!);
  await play.dispatchEvent("click");
  await expect(note).not.toHaveText(initial!);
});

test("the Japanese panel fits on the phone and using it leaves a held view idle", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-phone", "the phone viewport is checked here");
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${DEMO}&lang=ja`);
  const first = page.getByRole("tab", { name: "近くにある天体" });
  await first.scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name: "近くにある天体" });
  await expect(panel.locator("#nearby-target")).toHaveText("地球の近く");
  await expect(panel.locator("#nearby-results li")).toHaveCount(5);
  expect(await panel.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(await panel.evaluate((el) => el.clientWidth));
  await panel.locator("#nearby-results button").first().click();
  await expect.poll(() => pairOf(page)).toEqual(["earth", "moon"]);
  await page.locator("#sky").scrollIntoViewIfNeeded();
  await expect(page.locator("#space")).toHaveAttribute("data-state", "live");
  await quiet(page);
  const before = await readCounts(page);
  await page.waitForTimeout(1200);
  const after = await readCounts(page);
  expect(after.contexts).toBe(1);
  expect(after.draws).toBe(before.draws);
  expect(after.rafRequests).toBe(before.rafRequests);
});
