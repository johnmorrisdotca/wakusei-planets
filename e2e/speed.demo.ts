// The family's speed buttons in the demo: the orbits' time (multiples of real time) and a body's spin (0.5×, 1×, 2× of 14 degrees a second). The config's reduced motion is on, so the buttons stepping here is the reduced-motion check.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";
const press = (page: import("@playwright/test").Page, id: string, value: number) => page.locator(`#${id} button[data-v="${value}"]`);

test("the date row's speed is the family's buttons: 1×, 3600× and 86400×, kept in the body's rate and the address", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter&moons=1`);
  await expect(page.locator("#speeds button")).toHaveText(["1×", "3600×", "86400×"]);
  await expect(press(page, "speeds", 1)).toHaveAttribute("aria-pressed", "true");
  await press(page, "speeds", 3600).click();
  await expect(page.locator("#main")).toHaveAttribute("rate", "3600");
  await expect(page).toHaveURL(/speed=3600/);
  await press(page, "speeds", 86400).click();
  await expect(page.locator("#main")).toHaveAttribute("rate", "86400");
  await press(page, "speeds", 1).click();
  await expect(page).not.toHaveURL(/speed=/);
  expect(await page.locator("[data-speed]").count()).toBe(0);
});

test("a page opened on a speed starts there", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter&moons=1&speed=86400`);
  await expect(press(page, "speeds", 86400)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#main")).toHaveAttribute("rate", "86400");
});

test("Turn brings its own 0.5×, 1× and 2×; a body that spins the other way (Venus) turns the other way at the same speeds", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  await expect(page.locator("#spin-speed")).toBeHidden();
  await page.locator("#spin").click();
  await expect(page.locator("#spin-speed button")).toHaveText(["0.5×", "1×", "2×"]);
  await expect(page.locator("#main")).toHaveAttribute("turn", "14");
  await press(page, "spin-speed", 2).click();
  await expect(page.locator("#main")).toHaveAttribute("turn", "28");
  await expect(page).toHaveURL(/spinspeed=2/);
  await press(page, "spin-speed", 0.5).click();
  await expect(page.locator("#main")).toHaveAttribute("turn", "7");
  await page.locator('.tile[data-body="venus"]').click();
  await expect(page.locator("#main")).toHaveAttribute("turn", "-7");
  await page.locator("#spin").click();
  await expect(page.locator("#spin-speed")).toBeHidden();
});
