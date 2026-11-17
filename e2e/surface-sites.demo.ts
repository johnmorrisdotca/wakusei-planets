// The standing view at the sites that have no height model yet, in a real browser (Chromium, drawn in software): nothing is fetched for the ground, the page says the ground is a flat stand-in, there are no
// made rocks, Mars's sky is butterscotch over a reddish ground, the Moon's is black, and the view draws nothing at rest. The pictures are drawn small with the shadows off (software takes seconds a picture). Nothing is
// downloaded from anywhere. Written to the rules of the test-rules page: what is counted is counted in the page.
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  // a slow machine: the page runs at a quarter of the speed
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
});

type Surface = HTMLElement & { stats: { state: string; draws: number; tiles?: unknown; rocks: number; renderer?: { draws: number; contexts: number } }; sky: { air: unknown; earthDisc: boolean } | undefined };

const open = async (page: Page, site: string, extra = ""): Promise<string[]> => {
  const tileRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/tiles/")) tileRequests.push(request.url());
  });
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  await page.evaluate(
    ([name, more]) => {
      document.querySelector("#surface")?.remove();
      const el = document.createElement("wakusei-surface");
      el.id = "test-surface";
      el.setAttribute("site", name!);
      el.setAttribute("shadows", "off");
      el.setAttribute("pitch", "12");
      for (const pair of more!.split(" ")) {
        const [k, v] = pair.split("=");
        if (k) el.setAttribute(k, v ?? "");
      }
      el.style.cssText = "width: 320px";
      document.querySelector("main")!.prepend(el);
    },
    [site, extra],
  );
  await expect(page.locator("#test-surface")).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  let held = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await page.locator("#test-surface").evaluate((el) => String((el as Surface).stats.renderer?.draws ?? 0));
        same = now === held && now !== "0" ? same + 1 : 0;
        held = now;
        return same;
      },
      { timeout: 180_000, intervals: [400] },
    )
    .toBeGreaterThanOrEqual(3);
  return tileRequests;
};

/** The mean colour of a strip of the picture, from a screenshot of the view: the top fifth (sky) and the bottom fifth (ground). */
const strips = async (page: Page): Promise<{ sky: number[]; ground: number[] }> => {
  const shot = (await page.locator("#test-surface").screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const g = canvas.getContext("2d")!;
    g.drawImage(bitmap, 0, 0);
    const mean = (y0: number, y1: number): number[] => {
      const px = g.getImageData(0, y0, bitmap.width, y1 - y0).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c += 1) sum[c]! += px[i + c]!;
      return sum.map((n) => n / (px.length / 4));
    };
    const h = bitmap.height;
    return { sky: mean(0, Math.floor(h / 5)), ground: mean(h - Math.floor(h / 5), h) };
  }, shot);
};

test("Perseverance: no tiles are asked for, the ground says it is flat, Mars's sky is butterscotch over a reddish ground, and nothing is drawn at rest", async ({ page }) => {
  const tiles = await open(page, "perseverance");
  const first = await page.locator("#test-surface").evaluate((el) => (el as Surface).stats.renderer!.draws);
  await page.waitForTimeout(1500);
  expect(await page.locator("#test-surface").evaluate((el) => (el as Surface).stats.renderer!.draws)).toBe(first);
  expect(tiles, "a flat stand-in fetches nothing").toEqual([]);
  expect(await page.locator("#test-surface").evaluate((el) => (el as Surface).stats.rocks), "no made rocks on a flat stand-in").toBe(0);
  expect(await page.locator("#test-surface").evaluate((el) => ((el as Surface).sky!.air !== null) && !(el as Surface).sky!.earthDisc)).toBe(true);
  const { sky, ground } = await strips(page);
  expect(sky[0]!, "a lit sky, not black").toBeGreaterThan(60);
  expect(sky[0]!, "red over blue in Mars's day sky").toBeGreaterThan(sky[2]! * 1.15);
  expect(ground[0]!, "a reddish ground").toBeGreaterThan(ground[2]! * 1.15);
  expect(await page.locator("#test-surface").evaluate((el) => el.getAttribute("aria-label"))).toContain("Perseverance");
});

test("Apollo 15: no tiles, a black sky, a grey ground, the Moon's own words", async ({ page }) => {
  const tiles = await open(page, "apollo-15");
  expect(tiles).toEqual([]);
  const { sky, ground } = await strips(page);
  expect(Math.max(...sky), "the Moon's sky is black").toBeLessThan(25);
  expect(Math.abs(ground[0]! - ground[2]!), "a grey ground").toBeLessThan(12);
  expect(await page.locator("#test-surface").evaluate((el) => el.getAttribute("aria-label"))).toContain("standing on the Moon");
});
