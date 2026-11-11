// Starman in the space view (MODULES-974): off by default and its table not fetched; on, the car is drawn where the table puts it, in the same mapping as the planets, with its name in the page's
// language, and nothing outside its record. Chromium, drawing in software; every wait is on what the page reports.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { eclipticToScene, frameAt, placeAround, placeSun } from "../src/space/index.ts";
import { roadsterPositionAu } from "../src/roadster.ts";
import { callOn, openSpace, setOn, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Car {
  shown: boolean;
  position: [number, number, number] | null;
  radiusPx: number;
}
const car = async (page: Page): Promise<Car> => ((await statsOf(page)) as unknown as { roadster: Car }).roadster;
const nameOf = (page: Page) => page.locator(SPACE).locator('.sp-label[data-body="roadster"]');

async function drawn(page: Page, act: () => Promise<unknown>): Promise<void> {
  const before = (await readCounts(page)).draws;
  await act();
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
}

test("off by default and its table not fetched; on, the car is where the table puts it, in both scales, named in the page's language, and gone outside its record", async ({ page }) => {
  test.setTimeout(240_000);
  const fetched: string[] = [];
  page.on("response", (response) => {
    if (/roadster/i.test(response.url())) fetched.push(response.url());
  });
  const when = Date.UTC(2026, 10, 2, 14);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&goto=solar-system");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "roadster"))).toBe(false);
  expect((await car(page)).shown).toBe(false);
  expect(fetched, "the table is not fetched while the car is off").toEqual([]);
  await setOn(page, "roadster", true);
  await expect.poll(async () => (await car(page)).shown, { timeout: 60_000 }).toBe(true);
  expect(fetched.length, "the table came with the car's module, once").toBeGreaterThanOrEqual(1);
  // where the package puts it, in Earth radii from the Earth's centre, in the true scale
  const seen = (await car(page)).position!;
  // the Sun as the view draws it (Earth radii from the Earth's centre), then the car round it in the same mapping as the planets
  const expected = placeAround("true", placeSun("true", frameAt(when).sun), eclipticToScene(roadsterPositionAu(when)));
  for (let i = 0; i < 3; i += 1) expect(Math.abs(seen[i]! - expected[i]!), `axis ${i}: ${seen[i]} against ${expected[i]}`).toBeLessThan(Math.max(1e-6, Math.abs(expected[i]!) * 1e-6));
  expect((await car(page)).radiusPx).toBeGreaterThan(1);
  await expect(nameOf(page)).toHaveText("Starman");
  await expect(nameOf(page)).toBeVisible();
  // the squeezed scale: the same mapping as the planets
  await drawn(page, () => setOn(page, "scale", "compressed"));
  const squeezed = (await car(page)).position!;
  const expectedSqueezed = placeAround("compressed", placeSun("compressed", frameAt(when).sun), eclipticToScene(roadsterPositionAu(when)));
  for (let i = 0; i < 3; i += 1) expect(Math.abs(squeezed[i]! - expectedSqueezed[i]!)).toBeLessThan(1e-3);
  // Japanese
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(nameOf(page)).toHaveText("スターマン");
  // before the launch there is no car
  await drawn(page, () => setOn(page, "time", Date.UTC(2017, 0, 1)));
  await expect.poll(async () => (await car(page)).shown, { timeout: 30_000 }).toBe(false);
  await expect(nameOf(page)).toBeHidden();
  // and off again
  await drawn(page, () => setOn(page, "time", when));
  await expect.poll(async () => (await car(page)).shown, { timeout: 30_000 }).toBe(true);
  await drawn(page, () => setOn(page, "roadster", false));
  expect((await car(page)).shown).toBe(false);
  await expect(nameOf(page)).toBeHidden();
  // a press on its name says so and moves the view nowhere
  await setOn(page, "roadster", true);
  await expect.poll(async () => (await car(page)).shown, { timeout: 60_000 }).toBe(true);
  const focus = await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"));
  await nameOf(page).dispatchEvent("click");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe(focus);
  void callOn;
});

test("the demo's Starman switch is kept in the address", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&goto=solar-system&starman=1");
  await expect.poll(async () => (await car(page)).shown, { timeout: 60_000 }).toBe(true);
  expect(await page.locator("#starman").getAttribute("aria-pressed")).toBe("true");
  await page.locator("#starman").dispatchEvent("click");
  await expect.poll(async () => (await car(page)).shown, { timeout: 30_000 }).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.get("starman"), { timeout: 10_000 }).toBeNull();
});
