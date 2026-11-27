import "./load.ts";
import { expect, test } from "@playwright/test";

test("the period plot groups comparable orbits and the practice orbit changes independently", async ({ page }) => {
  await page.goto("/wakusei-planets/plan.html");
  await page.getByRole("link", { name: "Kepler’s laws" }).click();
  const orbit = page.getByLabel("Orbiting body");
  await expect(orbit).toHaveValue("mercury");
  await expect(page.locator("#kp-plot .catalogue")).toHaveCount(149);
  await expect(orbit.locator("option:disabled")).toHaveCount(10);
  await expect(page.locator("#kp-sweep .near")).toBeVisible();
  await expect(page.locator("#kp-sweep .far")).toBeVisible();
  await expect(page.locator("#kp-sweep .empty-focus")).toBeVisible();
  await expect(page.locator("#kp-sweep .centre")).toBeVisible();
  await expect(page.getByText("Closest part · 12.5% of the ellipse")).toBeVisible();
  await expect(page.getByText("Farthest part · 12.5% of the ellipse")).toBeVisible();
  await expect(page.locator("#kp-plot .anchor")).toHaveText(["Mercury", "Earth", "Jupiter", "Neptune", "Pluto"]);
  await expect(page.getByRole("button", { name: "Play orbit" })).toBeDisabled();

  await page.getByLabel("Central body").selectOption("jupiter");
  await expect(page.locator("#kp-period")).toContainText("Io");
  await expect(page.locator("#kp-plot .catalogue")).toHaveCount(115);
  await expect(page.locator("#kp-plot")).toContainText("Semimajor axis (km)");

  await page.getByLabel("Central body").selectOption("sun");
  const near = await page.locator("#kp-sweep .near").getAttribute("d");
  await page.getByLabel("Try a practice orbit").check();
  await page.locator("#kp-size").evaluate((el: HTMLInputElement) => {
    el.value = "200";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#kp-practice-period")).toContainText("0.7742 au");
  await expect(page.locator("#kp-practice-period")).toContainText("248.8 days");
  await expect(page.locator("#kp-period")).toContainText("87.97 days");
  await expect(page.locator("#kp-sweep .near")).not.toHaveAttribute("d", near!);
  await page.locator("#kp-eccentricity").evaluate((el: HTMLInputElement) => {
    el.value = "0";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#kp-sweep")).toContainText("Centre and both foci");
  await expect(page.locator("#kp-practice-period")).toContainText("248.8 days");
});

test("the Japanese lesson fits on screen and the time scrubber works with reduced motion", async ({ page }) => {
  await page.goto("/wakusei-planets/kepler.html?lang=ja");
  await expect(page.getByRole("heading", { level: 1, name: "ケプラーの法則" })).toBeVisible();
  await expect(page.getByLabel("中心の天体")).toHaveValue("sun");
  const dot = page.locator("#kp-sweep .selected");
  const at = await dot.getAttribute("cx");
  await page.getByLabel("軌道に沿った時間").evaluate((el: HTMLInputElement) => {
    el.value = "500";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(dot).not.toHaveAttribute("cx", at!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("playback starts by request and stops on pause or reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/wakusei-planets/kepler.html");
  const time = page.getByLabel("Time along the orbit");
  const play = page.getByRole("button", { name: "Play orbit" });
  const pause = page.getByRole("button", { name: "Pause orbit" });
  await expect(time).toHaveValue("0");
  await play.click();
  await expect(time).not.toHaveValue("0");
  await pause.click();
  const stopped = await time.inputValue();
  await time.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(time).toHaveValue(stopped);

  await play.click();
  await expect(time).not.toHaveValue(stopped);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(play).toBeDisabled();
});
