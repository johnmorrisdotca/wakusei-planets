// The standing page's site row: choosing a site names it on Land, points the orbit view at that body, and says which rover will be driven. It does not come down; the descent is surface-land.demo.ts.
import { expect, test } from "@playwright/test";
import "./load.ts";

test("choosing a site names it on Land and says which rover that site drives", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "the site row is the page's own control");
  await page.goto("/wakusei-planets/surface.html");
  await expect(page.locator("#land")).toHaveText("Land at Apollo 17");
  await expect(page.locator("#drive")).toBeHidden();
  await expect(page.locator("[data-testid=site-apollo-17]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#detail-row")).toBeVisible();
  await expect(page.locator("#rover-credit")).toBeVisible();
  await expect(page.locator("#rover-note")).toBeHidden();

  await page.locator("[data-testid=site-perseverance]").click();
  await expect(page.locator("#land")).toHaveText("Land at Perseverance, Jezero");
  await expect(page.locator("[data-testid=site-perseverance]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-testid=site-apollo-17]")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#orbit")).toHaveJSProperty("body", "mars");
  await expect(page.locator("#detail-row")).toBeHidden();
  await expect(page.locator("#rover-credit")).toBeHidden();
  await expect(page.locator("#rover-note")).toContainText("NASA");
  await expect(page.locator("#drive")).toBeHidden();

  await page.locator("[data-testid=site-chang-e-4]").click();
  await expect(page.locator("#land")).toHaveText("Land at Chang'e 4 and Yutu-2, Von Kármán");
  await expect(page.locator("#orbit")).toHaveJSProperty("body", "moon");
  await expect(page.locator("#rover-note")).toContainText("Yutu-2");
  await expect(page.locator("#ground-words")).toContainText("flat stand-in");

  await page.locator("[data-testid=site-apollo-17]").click();
  await expect(page.locator("#land")).toHaveText("Land at Apollo 17");
  await expect(page.locator("#orbit")).toHaveJSProperty("body", "moon");
  await expect(page.locator("#rover-credit")).toBeVisible();
  await expect(page.locator("#detail-row")).toBeVisible();
  await expect(page.locator("#hint")).toHaveText("The Moon from orbit. Land at the Apollo 17 site to stand on it.");
});

test("Drive at Jezero asks for Perseverance's model, and Chang'e 4 stays on the drawn shapes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "the site row is the page's own control");
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    const log: string[] = [];
    Reflect.set(window, "__landed", log);
    document.addEventListener("wakusei-landed", (event) => log.push((event as CustomEvent<{ site: string }>).detail.site), true);
  });
  await page.goto("/wakusei-planets/surface.html");
  await expect(page.locator("#orbit")).toHaveAttribute("data-state", /live|ready/, { timeout: 120_000 }).catch(() => undefined);
  const landed = (): Promise<string[]> => page.evaluate(() => [...(Reflect.get(window, "__landed") as string[])]);

  await page.locator("[data-testid=site-perseverance]").click();
  await page.locator("#land").click();
  await expect.poll(landed, { timeout: 180_000, intervals: [500] }).toContain("perseverance");
  await expect(page.locator("#drive")).toBeVisible();
  await page.locator("#drive").click();
  await expect(page.locator("wakusei-surface")).toHaveAttribute("drive", "on");
  await expect(page.locator("wakusei-surface")).toHaveAttribute("drive-model", "models/perseverance.glb");

  await page.locator("#leave").click();
  await expect(page.locator("#land")).toBeVisible();
  await page.locator("[data-testid=site-chang-e-4]").click();
  await page.locator("#land").click();
  await expect.poll(landed, { timeout: 180_000, intervals: [500] }).toContain("chang-e-4");
  await page.locator("#drive").click();
  await expect(page.locator("wakusei-surface")).toHaveAttribute("drive", "on");
  await expect(page.locator("wakusei-surface")).not.toHaveAttribute("drive-model");
});
