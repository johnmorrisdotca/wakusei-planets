// The README and docs pictures: `pnpm screenshots` builds the demo, serves it on 8302 and saves docs/images/*.png. The shaded looks are drawn in software, one browser at a time.
import { spawn } from "node:child_process";
import { SOFTWARE_GL_ARGS } from "@johnmorrisdotca/kazoku-ui/testing";
import { chromium } from "@playwright/test";

const port = 8302;
const server = spawn(process.execPath, ["scripts/dev.ts"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const out = (name: string) => new URL(`../docs/images/${name}.png`, import.meta.url).pathname;

try {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const browser = await chromium.launch({ args: [...SOFTWARE_GL_ARGS] });
  const shots: [string, { width: number; height: number }, string][] = [
    ["hero-desk", { width: 1280, height: 900 }, "?body=saturn&look=realistic"],
    ["line-desk", { width: 1280, height: 900 }, "?body=saturn&look=line"],
    ["line-phone", { width: 390, height: 844 }, "?body=jupiter&look=line"],
    ["moons-desk", { width: 1280, height: 900 }, "?body=jupiter&look=line&moons=1&t=2026-11-02T12:00:00.000Z"],
    ["realistic-phone", { width: 390, height: 844 }, "?body=mars&look=realistic"],
    ["lineup-desk", { width: 1280, height: 900 }, "?body=earth&look=painted&scale=1"],
  ];
  const only = process.env["ONLY"]?.split(",");
  for (const [name, viewport, query] of shots) {
    if (only !== undefined && !only.includes(name)) continue;
    const context = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/wakusei-planets/${query}`);
    if (name === "lineup-desk") {
      await page.locator("#lineup-section").scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.waitForFunction(() => document.querySelectorAll("#lineup wakusei-body[data-state=still]").length === document.querySelectorAll("#lineup wakusei-body").length, undefined, { timeout: 120_000 });
      await page.locator("#lineup-section").screenshot({ path: out(name) });
      await context.close();
      continue;
    }
    if (query.includes("look=realistic")) {
      await page.locator("#main").hover();
      await page.waitForSelector("#main[data-state=live]", { timeout: 90_000 });
      await page.waitForTimeout(1500);
    } else await page.waitForSelector("#main svg");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    if (name.startsWith("hero") || name.startsWith("moons")) await page.locator(".space-stage").screenshot({ path: out(name) });
    else await page.screenshot({ path: out(name) });
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
}
