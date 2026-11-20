import "./load.ts";
import { expect, test } from "@playwright/test";

test("every moon of Jupiter is a circle, and the page does not scroll sideways at 390", async ({ page }, info) => {
  test.skip(info.project.name.startsWith("webkit") && !process.env.CI, "WebKit is not run locally");
  await page.goto("/wakusei-planets/chart.html");
  const circles = page.locator("#chart circle[data-moon]");
  await expect(circles.first()).toBeVisible();
  const legend = await page.locator("#chart-legend li").allTextContents();
  const named = legend.reduce((sum, text) => sum + Number(text.match(/(\d+)\s*$/)?.[1] ?? 0), 0);
  await expect(circles).toHaveCount(named);
  const radii = await circles.evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute("data-moon"), r: Number(node.getAttribute("r")) })));
  const ganymede = radii.find((dot) => dot.id === "ganymede")!;
  expect(radii.every((dot) => dot.r <= ganymede.r + 0.01)).toBe(true);
  await expect(page.locator("#chart-legend")).toContainText("Himalia");
  await expect(page.locator("#chart-source")).toContainText("2026-11-18");
  await page.setViewportSize({ width: 390, height: 844 });
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
});
