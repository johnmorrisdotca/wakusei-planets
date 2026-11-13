// The dwarf planets and the moons in the picker, in the line look (no WebGL): the groups of the row of bodies, the choice in the address, and the long shape of Haumea.
import { expect, test } from "@playwright/test";
import "./load.ts";

const URL = "/wakusei-planets/";

test("the picker has the planets, the dwarf planets and the well-known moons, each a click away, and the address keeps the choice", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  await expect(page.locator('#tiles .tile[data-body="mars"]')).toBeVisible();
  await page.locator('[data-testid="group-dwarfs"]:visible').click();
  await expect(page.locator("#tiles .tile")).toHaveCount(8);
  await page.locator('#tiles .tile[data-body="eris"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "eris");
  await expect(page).toHaveURL(/body=eris/);
  await expect(page.locator('#moon-row .tile[data-body="dysnomia"]')).toBeVisible();
  await page.locator('[data-testid="group-moons"]:visible').click();
  await expect(page.locator('#tiles .tile[data-body="titan"]')).toBeVisible();
  await page.locator('#tiles .tile[data-body="titan"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "titan");
  await expect(page.locator('[data-testid="group-moons"]:visible')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-testid="group-planets"]:visible').click();
  await expect(page.locator("#tiles .tile")).toHaveCount(10);
});

test("a dwarf planet opened from the address is drawn, and a body chosen from a group puts that group on show", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=haumea`);
  await expect(page.locator('[data-testid="group-dwarfs"]:visible')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#main svg")).toBeVisible();
  const box = await page.locator("#main svg ellipse").first().evaluate((el) => ({ rx: Number(el.getAttribute("rx")), ry: Number(el.getAttribute("ry")) }));
  expect(Math.max(box.rx, box.ry) / Math.min(box.rx, box.ry)).toBeGreaterThan(1.3);
  await expect(page.locator("#caption")).toContainText("Haumea");
});

test("the portrait builder has a group of dwarf planets, and the dwarf planets draw in the line look", async ({ page }) => {
  await page.goto(`${URL}portrait.html?scene=${encodeURIComponent("arrange:row~scale:readable~look:line~ceres_0_0_0.3_0~haumea_0_0_0.3_0")}`);
  await expect(page.locator('[data-testid="group-dwarfs"]')).toBeVisible();
  await page.locator('[data-testid="group-dwarfs"]').click();
  await expect(page.locator("#picker button")).toHaveCount(8);
  await expect(page.locator("#view")).toHaveAttribute("data-state", "line");
});
