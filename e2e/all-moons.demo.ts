// Mercury through Pluto, catalogue counts, a few moons drawn. Estimated moons keep the star. Off CI, WebKit skips the page.
import "./load.ts";
import { expect, test } from "@playwright/test";
import { ALL_MOON_READ } from "../src/all-moons.ts";
import { estimatedRock } from "../src/scene/estimated-rock.ts";

test("every world is listed, Saturn has the most, and an estimated moon keeps its star", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "the moons draw in Chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/wakusei-planets/all.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator(".all-row")).toHaveCount(9);
  await expect(page.locator('[data-host="mercury"] .all-count')).toHaveText("None");
  await expect(page.locator('[data-host="mercury"] .all-moon')).toHaveCount(0);
  await expect(page.locator('[data-host="saturn"]')).toHaveAttribute("data-most", "true");
  await expect(page.locator('[data-host="saturn"] .all-count')).toContainText("293");
  await expect(page.locator('[data-moon="io"] wakusei-body')).toHaveAttribute("body", "io");
  await expect(page.locator('[data-moon="kerberos"] figcaption')).toHaveText("Kerberos");
  await expect(page.locator("#all-legend")).toHaveText(estimatedRock("himalia")!.legend.en);
  await expect(page.locator("#all-source")).toContainText(ALL_MOON_READ);
  if (browserName === "chromium") {
    await page.locator('[data-host="jupiter"] .all-planet').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-host="jupiter"] .all-planet wakusei-body')).toHaveAttribute("data-state", /still|live|line/, { timeout: 30_000 });
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the poster does not scroll sideways at 390 pixels", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "the moons draw in Chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wakusei-planets/all.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
