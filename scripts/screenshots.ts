// The README and docs pictures: `pnpm screenshots` builds the demo, serves it on 8302 and saves docs/images/*.png. The shaded looks are drawn in software, one browser at a time.
// The family's thumbnail, dark thumbnail and icon come last (scripts/family-thumbnail.mjs); `pnpm screenshots --thumbnail` takes only those three.
import { spawn } from "node:child_process";
import { SOFTWARE_GL_ARGS } from "@johnmorrisdotca/kazoku-ui/testing";
import { chromium, type Browser, type Page } from "@playwright/test";
import { captureDrawing, composeThumbnails } from "./family-thumbnail.mjs";

const port = 8302;
const server = spawn(process.execPath, ["scripts/dev.ts"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
const out = (name: string) => new URL(`../docs/images/${name}.png`, import.meta.url).pathname;

// The family's thumbnail: the planets in their shaded realistic look, side by side and not to scale, Saturn with its rings
// in the middle, on the family's paper and its black cloth; the icon is Saturn alone. The bodies only, never the page.
const THUMBNAIL_BODIES: [string, number][] = [
  ["mars", 150],
  ["earth", 210],
  ["saturn", 430],
  ["jupiter", 290],
  ["neptune", 190],
];
async function stage(page: Page, bodies: [string, number][]): Promise<Buffer> {
  await page.goto(`http://127.0.0.1:${port}/wakusei-planets/?look=line`);
  await page.waitForFunction(() => customElements.get("wakusei-body"));
  await page.evaluate((bodies) => {
    const row = document.createElement("div");
    row.id = "thumbnail-stage";
    row.style.cssText = "display:flex;align-items:center;gap:12px;padding:8px;width:max-content";
    for (const [body, size] of bodies) {
      const one = document.createElement("wakusei-body");
      for (const [name, value] of Object.entries({ body, look: "realistic", size: String(size), live: "off", labels: "off" })) one.setAttribute(name, value);
      one.style.cssText = `display:block;width:${size}px;height:${size}px;background:transparent`;
      row.append(one);
    }
    document.body.replaceChildren(row);
  }, bodies);
  await page.waitForFunction(() => [...document.querySelectorAll("#thumbnail-stage wakusei-body")].every((one) => /^(still|live)$/.test(one.getAttribute("data-state") ?? "")), undefined, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  return captureDrawing(page, "#thumbnail-stage");
}
async function thumbnails(browser: Browser): Promise<void> {
  const taken: Record<string, Buffer> = {};
  for (const [kind, scheme] of [["light", "light"], ["dark", "dark"], ["icon", "light"]] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "reduce" });
    const page = await context.newPage();
    taken[kind] = await stage(page, kind === "icon" ? [["saturn", 460]] : THUMBNAIL_BODIES);
    if (kind === "icon") for (const picture of await composeThumbnails({ page, light: taken["light"]!, dark: taken["dark"]!, icon: taken["icon"]!, label: "Wakusei Planets 惑星" })) console.log(picture.file, `${Math.round(picture.bytes / 1024)} KB`);
    await context.close();
  }
}

try {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const onlyThumbnail = process.argv.includes("--thumbnail");
  const browser = await chromium.launch({ args: ["--headless=new", ...SOFTWARE_GL_ARGS, "--disable-gpu-compositing"] });
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
    if (onlyThumbnail) break;
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
  if (only === undefined || only.includes("thumbnail")) await thumbnails(browser);
  await browser.close();
} finally {
  server.kill();
}

