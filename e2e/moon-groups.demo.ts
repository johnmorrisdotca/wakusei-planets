// Jupiter on top, then every moon in its group. Estimated moons are rocks, marked with the star. Off CI, WebKit skips the page.
import "./load.ts";
import { expect, test } from "@playwright/test";
import { catalogueMoonsOf } from "../src/moon-catalogue.ts";
import { estimatedRock } from "../src/scene/estimated-rock.ts";

test("Jupiter on top and every moon below, a rock marked with the star", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "the moons draw in Chromium");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/wakusei-planets/groups.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("body")).toHaveAttribute("data-planet", "jupiter");
  await expect(page.locator("#groups-legend")).toHaveText(estimatedRock("himalia")!.legend.en);
  await expect(page.locator("#group-planet wakusei-body")).toHaveAttribute("body", "jupiter");
  await expect(page.locator("#groups [data-moon]")).toHaveCount(catalogueMoonsOf("jupiter").length);
  await expect(page.locator('[data-moon="io"] wakusei-body')).not.toHaveAttribute("data-shape", "estimated");
  await expect(page.locator('[data-moon="himalia"] figcaption')).toContainText(estimatedRock("himalia")!.line.en);
  await expect(page.locator("#groups [data-moon]").first().locator("figcaption")).toContainText("1.");
  if (browserName === "chromium") {
    await page.locator("#group-planet").scrollIntoViewIfNeeded();
    await expect(page.locator("#group-planet wakusei-body")).toHaveAttribute("data-state", /still|live|line/, { timeout: 30_000 });
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("the groups do not scroll sideways at 390 pixels", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.env["CI"] === undefined, "the moons draw in Chromium");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wakusei-planets/groups.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});
