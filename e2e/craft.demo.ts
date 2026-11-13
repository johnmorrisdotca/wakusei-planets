// The spacecraft page: pick a craft, the place changes with the date, and Japanese words show.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

test("a craft's place changes with the date, and Japanese words show", async ({ page }) => {
  await page.goto("/wakusei-planets/craft.html?lang=en");
  const where = page.locator("#where");
  await expect(where).toContainText("au", { timeout: 30_000 });
  await page.getByRole("button", { name: "Cassini" }).click();
  await expect(where).toContainText("Cassini");
  await page.locator("#play").click();
  const first = await where.textContent();
  await page.locator("#when").fill("2010-06-01T12:00");
  await page.locator("#when").dispatchEvent("input");
  await expect.poll(() => where.textContent()).not.toBe(first);

  await page.getByRole("button", { name: "Starman" }).click();
  await expect(where).toContainText("Starman");
  await expect(where).toContainText("au");

  await page.goto("/wakusei-planets/craft.html?lang=ja");
  await expect(page.locator("#facts")).toContainText("ボイジャー", { timeout: 30_000 });
  await expect(page.locator("[data-say='cr_events']")).toHaveText("航海");
});
