// The moon-count grid: nine painted planets, the catalogue's counts, and the leader marked. The spheres draw WebGL, so off CI WebKit skips the page.
import "./load.ts";
import { expect, test } from "@playwright/test";
import { moonCounts } from "../src/moon-catalogue.ts";
import { MOON_COUNT_IDS, MOON_COUNT_READ } from "../src/moon-counts.ts";

test("nine planets, catalogue counts, Saturn marked as the most", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "painted spheres draw in Chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/wakusei-planets/counts.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#counts [data-host]")).toHaveCount(MOON_COUNT_IDS.length);
  const saturn = moonCounts().saturn!.total;
  await expect(page.locator('[data-host="saturn"] .count-n')).toContainText(String(saturn));
  await expect(page.locator('[data-host="mercury"] .count-n')).toHaveText("No moons");
  await expect(page.locator('[data-host="venus"] .count-n')).toHaveText("No moons");
  await expect(page.locator('[data-most="true"]')).toHaveAttribute("data-host", "saturn");
  await expect(page.locator('[data-host="saturn"]')).toHaveAttribute("href", "saturn.html");
  await expect(page.locator('[data-host="mercury"]')).toHaveAttribute("href", "index.html?body=mercury");
  await expect(page.locator("#counts-source")).toContainText(MOON_COUNT_READ);
  await expect(page.locator("#counts wakusei-body")).toHaveCount(9);
  if (browserName === "chromium") {
    await page.locator('[data-host="saturn"]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-host="saturn"] wakusei-body')).toHaveAttribute("data-state", /still|live|line/, { timeout: 30_000 });
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the grid does not scroll sideways at 390 pixels", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "painted spheres draw in Chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wakusei-planets/counts.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
