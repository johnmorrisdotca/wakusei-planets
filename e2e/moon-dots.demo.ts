// The planet's edge and a column of dots sized by diameter. The moons are dots, not pictures. Off CI, WebKit skips the page.
import "./load.ts";
import { expect, test } from "@playwright/test";

test("Jupiter's edge and sixteen dots, nearest first, Ganymede the largest", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "the planet's edge draws in Chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/wakusei-planets/dots.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("body")).toHaveAttribute("data-planet", "jupiter");
  const names = page.locator("#dots .dot-name");
  await expect(names).toHaveCount(16);
  await expect(names.first()).toContainText("Metis");
  await expect(names.nth(6)).toContainText("Ganymede");
  await expect(names.last()).toContainText("Sinope");
  await expect(page.locator("#dots wakusei-body")).toHaveCount(0);
  await expect(page.locator("#edge-planet wakusei-body")).toHaveCount(1);
  const ganymede = await page.locator('[data-moon="ganymede"] .dot').evaluate((el) => el.getBoundingClientRect().width);
  const metis = await page.locator('[data-moon="metis"] .dot').evaluate((el) => el.getBoundingClientRect().width);
  expect(ganymede).toBeGreaterThan(metis);
  if (browserName === "chromium") {
    await page.locator("#edge-planet").scrollIntoViewIfNeeded();
    await expect(page.locator("#edge-planet wakusei-body")).toHaveAttribute("data-state", /still|live|line/, { timeout: 30_000 });
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the column does not scroll sideways at 390 pixels", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "the planet's edge draws in Chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wakusei-planets/dots.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
