// The demo page and the embed page, played in a browser at a phone's width and a desk's. They use the line look: the shaded looks are in freeze.demo.ts (Chromium, drawn in software).
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("the page has the family's header, ten bodies, and draws the chosen one", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=saturn`);
  await expect(page.locator("kazoku-language-picker")).toBeVisible();
  await expect(page.locator("kazoku-theme-switch")).toBeVisible();
  await expect(page.locator(".tile")).toHaveCount(10);
  await expect(page.locator("#main")).toHaveAttribute("body", "saturn");
  await expect(page.locator("#main svg")).toBeVisible();
  await expect(page.locator("#caption")).toContainText("Saturn");
});

test("picking a tile changes the big view and the address", async ({ page }) => {
  await page.goto(`${URL}?look=line`);
  await page.locator('.tile[data-body="mars"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "mars");
  await expect(page).toHaveURL(/body=mars/);
  await expect(page.locator('.tile[data-body="mars"]')).toHaveAttribute("aria-pressed", "true");
});

test("moons show for a planet that has them, and the date row opens", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  await page.locator("#moons").click();
  await expect(page.locator("#main")).toHaveAttribute("moons", "");
  await expect(page.locator("#time-row")).toBeVisible();
  await expect(page.locator("#main svg")).toContainText("Callisto");
  await page.locator('.tile[data-body="mercury"]').click();
  await expect(page.locator("#moons")).toBeHidden();
});

test("the Japanese page names the bodies in Japanese", async ({ page }) => {
  await page.goto(`${URL}?look=line&lang=ja`);
  await expect(page.locator('.tile[data-body="jupiter"]')).toContainText("木星");
});

test("every control is a finger wide and none is left in the browser's own style", async ({ page }) => {
  await page.goto(`${URL}?look=line`);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".controls button, .controls input, .tile")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 47.5) out.push(`${el.textContent?.trim() || el.id} is ${Math.round(r.height)} px high`);
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius);
      if (radius < 8) out.push(`${el.textContent?.trim() || el.id} is square-cornered: the browser's own style`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("the embed page draws what its address says", async ({ page }) => {
  await page.goto(`${URL}embed.html?body=uranus&look=line&time=2026-11-02T12:00Z`);
  const el = page.locator("wakusei-body");
  await expect(el).toHaveAttribute("body", "uranus");
  await expect(el.locator("svg")).toBeVisible();
  const box = await page.locator("#frame").boundingBox();
  expect(box!.width).toBeGreaterThan(100);
});
