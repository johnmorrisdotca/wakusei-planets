// The minor bodies on the body page: their own row of tiles, the choice in the address, a line drawing of each (no WebGL), Halley's long shape, and Vesta drawn from Dawn's map. Chromium for the 3D.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("the body page has a row of small bodies, each a click away, and the address keeps the choice", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  await page.locator('[data-testid="group-minor"]').first().click();
  await expect(page.locator("#tiles .tile")).toHaveCount(5);
  await page.locator('#tiles .tile[data-body="halley"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "halley");
  await expect(page).toHaveURL(/body=halley/);
  await expect(page.locator("#caption")).toContainText("Halley");
  await page.goto(`${URL}?look=line&body=pholus`);
  await expect(page.locator('[data-testid="group-minor"]').first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#main svg")).toBeVisible();
});

test("every small body draws as a line drawing", async ({ page }) => {
  for (const body of ["vesta", "pallas", "chiron", "pholus", "halley"]) {
    await page.goto(`${URL}?look=line&body=${body}`);
    await expect(page.locator("#main svg"), body).toBeVisible();
  }
});

test("Vesta in the painted and realistic looks draws from Dawn's map", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const asked: string[] = [];
  page.on("response", (response) => {
    if (/\/textures\/vesta-\d+\.webp$/.test(response.url()) && response.status() === 200) asked.push(response.url().split("/").pop()!);
  });
  for (const look of ["painted", "realistic"]) {
    asked.length = 0;
    await page.goto(`${URL}?body=vesta&look=${look}`);
    await page.locator("#main").hover();
    await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    await expect.poll(() => asked.includes("vesta-512.webp") || asked.includes("vesta-1024.webp"), { timeout: 10_000 }).toBe(true);
  }
});

test("a dated Halley is placed from its table, which the element fetches itself", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));
  await page.goto(`${URL}embed.html?body=halley&look=line&time=1986-02-09T12:00:00Z`);
  await expect(page.locator("wakusei-body svg")).toBeVisible({ timeout: 30_000 });
  // the table is a chunk of its own, fetched because the body is dated
  await expect.poll(() => asked.some((url) => /minor|chunk/.test(url.split("/").pop() ?? "")), { timeout: 10_000 }).toBe(true);
});
