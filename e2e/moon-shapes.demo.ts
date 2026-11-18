// The small moons with a real shape model (MODULES-1601) are drawn with it: each of Phobos, Deimos, Nix, Hydra and Proteus reaches the live state in the realistic look with no error in the console, its shape chunk loads, and, when SHAPES_DIR is set, a picture of each is written there to look at. Chromium, in software.
import "./load.ts";
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

for (const body of ["phobos", "deimos", "nix", "hydra", "proteus"]) {
  test(`${body} is drawn with its real shape`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      // the finer tiles are built in CI and are not in a local site: their manifest is a 404 here
      if (message.type() === "error" && !message.location().url.endsWith("/tiles/manifest.json")) errors.push(`${message.text()} ${message.location().url}`);
    });
    await page.setViewportSize({ width: 640, height: 640 });
    await page.goto(`${URL}?body=${body}&look=realistic`);
    await page.locator("#main").hover();
    await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    await page.waitForTimeout(1500);
    const dir = process.env.SHAPES_DIR;
    if (dir !== undefined) {
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: `${dir}/${body}.png` });
    }
    expect(errors).toEqual([]);
  });
}
