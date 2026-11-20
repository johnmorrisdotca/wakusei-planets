// The moon page's hero: the planet's edge and the main moons in an arc. Painted spheres, so Chromium only (software WebGL).
import "./load.ts";
import { expect, test } from "@playwright/test";

test("Jupiter's hero keeps the Galileans in an arc, and a press names the moon", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desk" && info.project.name !== "chromium-phone", "painted spheres in Chromium");
  await page.goto("/wakusei-planets/jupiter.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  const buttons = page.locator("#hero-moons [data-moon]");
  await expect(buttons).toHaveCount(4, { timeout: 30_000 });
  const ids = await buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-moon")));
  expect(ids).toEqual(["callisto", "ganymede", "europa", "io"]);
  const tops = await buttons.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
  expect(tops[0]).toBeLessThan(tops[3]!);
  const hero = (await page.locator("#hero").boundingBox())!;
  expect(hero.width).toBeGreaterThan(300);
  expect(hero.x).toBeGreaterThanOrEqual(-1);
  expect(hero.x + hero.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await page.locator('#hero-moons [data-moon="io"]').click();
  await expect(page.locator("#hero-fact")).toContainText("Io");
  await expect(page.locator("#hero-fact")).toContainText("km");
  await expect(page.locator('#hero-moons [data-moon="io"]')).toHaveAttribute("aria-pressed", "true");
  const io = (await page.locator('#hero-moons [data-moon="io"] .hero-disc').boundingBox())!;
  const limb = (await page.locator("#hero-planet").boundingBox())!;
  expect(io.x + io.width, "Io stays clear of the planet").toBeLessThan(limb.x - 4);
  await expect(page.locator("#full-screen")).toHaveText("Full screen");
  const planet = page.locator("#hero-planet wakusei-body");
  await expect(planet).toHaveAttribute("data-state", /still|live|line/, { timeout: 30_000 });
});

test("Saturn's hero gives Titan the largest disc", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desk", "one desk check");
  await page.goto("/wakusei-planets/saturn.html");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator('#hero [data-moon="titan"]')).toBeVisible({ timeout: 30_000 });
  const widths = await page.locator("#hero .hero-disc").evaluateAll((nodes) => nodes.map((node) => ({ id: node.parentElement?.getAttribute("data-moon"), width: node.getBoundingClientRect().width })));
  const titan = widths.find((item) => item.id === "titan");
  expect(titan).toBeTruthy();
  expect(widths.every((item) => item.width <= titan!.width + 1)).toBe(true);
});
