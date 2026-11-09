// The family's replay bar and speed buttons in the demo: the orbits' time (Play, Back and multiples of real time) and a body's spin (0.5×, 1×, 2× of 14 degrees a second). The pages that run time ask for no-preference motion: the config's reduced motion is on, and the replay bar leaves Play off under it.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";
test.use({ reducedMotion: "no-preference" });
const press = (page: import("@playwright/test").Page, id: string, value: number) => page.locator(`#${id} button[data-v="${value}"]`);

test("the date row is the family's replay bar: Play, Back and the speeds 1×, 3600× and 86400×, kept in the body's rate and the address", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter&moons=1`);
  await expect(page.locator("#replay button[data-act]:visible")).toHaveText(["Play", "Back to the date"]);
  await expect(page.locator("#replay button[data-v]")).toHaveText(["1×", "3600×", "86400×"]);
  await expect(press(page, "replay", 3600)).toHaveAttribute("aria-pressed", "true");
  // paused: the clock is held whatever the speed
  await expect(page.locator("#main")).toHaveAttribute("rate", "0");
  await press(page, "replay", 86400).click();
  await expect(page).toHaveURL(/speed=86400/);
  await expect(page.locator("#main")).toHaveAttribute("rate", "0");
  await page.locator('#replay [data-act="play"]').click();
  await expect(page.locator("#main")).toHaveAttribute("rate", "86400");
  await expect(page).toHaveURL(/play=on/);
  await press(page, "replay", 3600).click();
  await expect(page.locator("#main")).toHaveAttribute("rate", "3600");
  await expect(page).not.toHaveURL(/speed=/);
  await page.locator('#replay [data-act="play"]').click();
  await expect(page.locator("#main")).toHaveAttribute("rate", "0");
  await expect(page).not.toHaveURL(/play=/);
  expect(await page.locator("[data-speed]").count()).toBe(0);
});

test("a page opened on a speed and Play starts there", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter&moons=1&play=on&speed=86400`);
  await expect(press(page, "replay", 86400)).toHaveAttribute("aria-pressed", "true");
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
