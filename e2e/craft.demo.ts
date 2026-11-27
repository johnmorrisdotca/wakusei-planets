// The spacecraft page: pick a craft, the place changes with the date, and Japanese words show.
import "./load.ts";
import { expect, test } from "@playwright/test";
import { SPACECRAFT_IDS, type SpacecraftId } from "../src/spacecraft-facts.ts";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

test("a craft's place changes with the date, and Japanese words show", async ({ page }) => {
  const requested = new Set<SpacecraftId>();
  page.on("request", (request) => {
    const file = new URL(request.url()).pathname.split("/").at(-1) ?? "";
    const id = SPACECRAFT_IDS.find((craft) => file.startsWith(`${craft}-`) && file.endsWith(".js"));
    if (id !== undefined) requested.add(id);
  });
  await page.goto("/wakusei-planets/craft.html?lang=en");
  const where = page.locator("#where");
  await expect(where).toContainText("au", { timeout: 30_000 });
  await expect(page.locator("#events")).toContainText("Entered interstellar space");
  await expect(page.locator("#chart .flight-path")).toHaveAttribute("d", /^M[^M]+M[^M]+$/);
  await expect(page.locator("#chart [data-orbit]")).toHaveCount(2);
  await expect(page.locator("#chart .craft-label text")).toHaveText(["Sun", "Jupiter 1979", "Saturn 1980", "Outbound"]);
  await expect(page.locator("#chart .craft-outbound")).toBeVisible();
  const whole = page.getByRole("button", { name: "Whole path" });
  await whole.click();
  await expect(whole).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#chart .craft-outbound")).toHaveCount(0);
  await whole.click();
  await expect(page.locator("#chart .craft-outbound")).toBeVisible();
  expect([...requested]).toEqual(["voyager1"]);
  await page.getByRole("button", { name: "Cassini" }).click();
  await expect(where).toContainText("Cassini");
  await expect(page.locator("#events")).toContainText("Huygens landed on Titan");
  expect([...requested]).toEqual(["voyager1", "cassini"]);
  await page.locator("#play").click();
  const first = await where.textContent();
  await page.locator("#when").fill("2010-06-01T12:00");
  await page.locator("#when").dispatchEvent("input");
  await expect.poll(() => where.textContent()).not.toBe(first);

  await page.getByRole("button", { name: "Starman" }).click();
  await expect(where).toContainText("Starman");
  await expect(where).toContainText("au");
  await expect(page.locator("#chart .flight-path")).toHaveAttribute("d", /^M[^M]+$/);
  expect([...requested]).toEqual(["voyager1", "cassini", "roadster"]);

  await page.goto("/wakusei-planets/craft.html?lang=ja");
  await expect(page.locator("#facts")).toContainText("ボイジャー", { timeout: 30_000 });
  await expect(page.locator("#chart .craft-label text")).toHaveText(["太陽", "木星 1979年", "土星 1980年", "外側へ"]);
  await expect(page.locator("[data-say='cr_events']")).toHaveText("航海");
});
