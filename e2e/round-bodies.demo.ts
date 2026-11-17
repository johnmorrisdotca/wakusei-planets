// A planet, a moon or the Sun always looks round, wherever it is in the picture and at any shape of window. A perspective camera stretches a sphere away from the middle of the picture (a disc near the edge is an ellipse
// along the line to the middle); the space view's field of view is 35 degrees from top to bottom, which in a wide window is 80 degrees across, so a body at its edge was a third as long again as it was wide. The bodies draw
// themselves round (`scene/round.ts`). Here the painter's own bodies are drawn in a scene of their own at the left, top, right and bottom and at the corners of a wide, a tall and a square window, and each drawn disc is measured
// from its pixels; then the space view itself is measured the same way. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Seen {
  width: number;
  height: number;
  axes: number;
  x: number;
  y: number;
  pixels: number;
}
interface Ask {
  width: number;
  height: number;
  body: string;
  at: [number, number];
  share: number;
  fov: number;
  what: "globe" | "all" | "glow";
}

const WINDOWS = [
  ["wide", 2012, 745],
  ["tall", 390, 844],
  ["square", 800, 800],
] as const;
const PLACES = [
  ["middle", 0, 0],
  ["left", -1, 0],
  ["right", 1, 0],
  ["top", 0, 1],
  ["bottom", 0, -1],
  ["top left", -1, 1],
  ["top right", 1, 1],
  ["bottom left", -1, -1],
  ["bottom right", 1, -1],
] as const;
// the Sun, a planet and a moon (neither is flattened: a round body is round)
const BODIES = ["sun", "mars", "moon"] as const;
const FOV = 35;
const SHARE = 0.1;
/** The long axis over the short axis, and the box's width over its height, both within 3% of 1. */
const SLACK = 0.03;

const harness = async (): Promise<string> => {
  const built = await build({ entryPoints: [new URL("./round-harness.ts", import.meta.url).pathname], bundle: true, write: false, format: "iife", platform: "browser", logLevel: "silent" });
  return built.outputFiles[0]!.text;
};

test("a body is round at the edges and the corners of a wide, a tall and a square window", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setContent("<!doctype html><body style='margin:0;background:#000'></body>");
  await page.addScriptTag({ content: await harness() });
  const rows: string[] = [];
  const worst = { axes: 1, box: 1, where: "" };
  for (const [shape, width, height] of WINDOWS) {
    for (const body of BODIES) {
      for (const [place, x, y] of PLACES) {
        const ask: Ask = { width, height, body, at: [x, y], share: SHARE, fov: FOV, what: "globe" };
        const seen = await page.evaluate((a) => (Reflect.get(globalThis, "roundHarness") as { draw(ask: Ask): Seen }).draw(a), ask);
        expect(seen.pixels, `${body} at ${place} of a ${shape} window is drawn`).toBeGreaterThan(200);
        const box = seen.width / seen.height;
        rows.push(`${shape} ${body} ${place}: ${seen.width}x${seen.height} box ${box.toFixed(3)} axes ${seen.axes.toFixed(3)}`);
        const off = Math.max(seen.axes - 1, Math.abs(box - 1));
        if (off > Math.max(worst.axes - 1, Math.abs(worst.box - 1))) {
          worst.axes = seen.axes;
          worst.box = box;
          worst.where = `${shape} ${body} ${place}`;
        }
      }
    }
  }
  console.log(rows.join("\n"));
  console.log(`worst: ${worst.where}: box ${worst.box.toFixed(3)}, axes ${worst.axes.toFixed(3)}`);
  expect(worst.axes, `the long axis over the short in the worst place (${worst.where})`).toBeLessThan(1 + SLACK);
  expect(Math.abs(worst.box - 1), `the box's width over its height in the worst place (${worst.where})`).toBeLessThan(SLACK);
});

test("the Sun's glow is round too", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setContent("<!doctype html><body style='margin:0;background:#000'></body>");
  await page.addScriptTag({ content: await harness() });
  for (const [shape, width, height] of WINDOWS) {
    for (const [place, x, y] of PLACES) {
      const ask: Ask = { width, height, body: "sun", at: [x, y], share: 0.07, fov: FOV, what: "all" };
      const seen = await page.evaluate((a) => (Reflect.get(globalThis, "roundHarness") as { draw(ask: Ask): Seen }).draw(a), ask);
      expect(seen.pixels, `the Sun's glow at ${place} of a ${shape} window is drawn`).toBeGreaterThan(500);
      expect(seen.axes, `the Sun's glow at ${place} of a ${shape} window: long axis over short`).toBeLessThan(1 + SLACK);
    }
  }
});

/** The disc of the body at a place in a screenshot of the space view: the bright pixels joined to its middle, measured as the harness measures (the long axis over the short, from the second moments). */
const discAt = (page: Page, png: string, x: number, y: number, floor: number): Promise<{ axes: number; width: number; height: number; pixels: number }> =>
  page.evaluate(
    async ([data, cx, cy, min]) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { width, height } = bitmap;
      const pixels = context.getImageData(0, 0, width, height).data;
      const lit = (i: number): boolean => pixels[i * 4]! + pixels[i * 4 + 1]! + pixels[i * 4 + 2]! > (min as number);
      const seen = new Uint8Array(width * height);
      const start = Math.round(cy as number) * width + Math.round(cx as number);
      const stack = [start];
      const found: number[] = [];
      while (stack.length > 0) {
        const at = stack.pop()!;
        if (at < 0 || at >= width * height || seen[at] === 1 || !lit(at)) continue;
        seen[at] = 1;
        found.push(at);
        const col = at % width;
        if (col > 0) stack.push(at - 1);
        if (col < width - 1) stack.push(at + 1);
        stack.push(at - width, at + width);
      }
      let sx = 0;
      let sy = 0;
      let left = width;
      let right = 0;
      let top = height;
      let bottom = 0;
      for (const at of found) {
        const col = at % width;
        const row = Math.floor(at / width);
        sx += col;
        sy += row;
        left = Math.min(left, col);
        right = Math.max(right, col);
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
      }
      const n = found.length;
      if (n === 0) return { axes: Number.NaN, width: 0, height: 0, pixels: 0 };
      let a = 0;
      let b = 0;
      let c = 0;
      for (const at of found) {
        const dx = (at % width) - sx / n;
        const dy = Math.floor(at / width) - sy / n;
        a += dx * dx;
        b += dx * dy;
        c += dy * dy;
      }
      const mean = (a + c) / 2;
      const spread = Math.sqrt(((a - c) / 2) ** 2 + b * b);
      return { axes: Math.sqrt((mean + spread) / Math.max(1e-9, mean - spread)), width: right - left + 1, height: bottom - top + 1, pixels: n };
    },
    [png, x, y, floor] as const,
  );

// The space view itself in two wide windows (a square or a tall one has little stretch to see), as the page draws it (the picture of the report: the Sun a wide ellipse at the left, the Moon stretched tall, the Earth on the diagonal): the Moon is looked at, the Earth is big at one side of it and
// Venus at the far edge. Lit from the camera and with nothing laid over the picture, the planets are measured from the pixels.
for (const [shape, width, height, zoom] of [
  ["wide", 2012, 745, 0.3],
  ["ultrawide", 2560, 800, 0.3],
] as const) {
  test(`the space view draws the Earth and the planets round in the ${shape} window (${width} by ${height})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height });
    await page.goto("/wakusei-planets/space-full.html?t=2026-11-20T17:19Z&speed=0&scale=compressed");
    const space = page.locator("wakusei-space");
    await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
    // nothing over the picture but the bodies (their places are read with the names on, so the names are only hidden)
    await page.addStyleTag({ content: ".top,.strip,kazoku-view-controls{display:none!important}" });
    await space.evaluate((el, z) => {
      const view = el as unknown as { frame: string; light: string; orbits: boolean; shadowRoot: ShadowRoot; goTo(body: string, options: { smooth: boolean; zoom: number }): boolean };
      const hide = document.createElement("style");
      hide.textContent = ".sp-label,.sp-ring,.sp-arrow,.sp-scale,.sp-note,.sp-region,.sp-oort{visibility:hidden!important}";
      view.shadowRoot.append(hide);
      view.frame = "stars";
      view.light = "lit";
      view.orbits = false;
      view.goTo("moon", { smooth: false, zoom: z });
    }, zoom);
    await expect.poll(() => space.evaluate((el) => (el as unknown as { body: string }).body), { timeout: 20_000 }).toBe("moon");
    await page.waitForTimeout(3000);
    const measured: string[] = [];
    for (const id of ["earth", "moon", "venus", "mars", "mercury"]) {
      const place = await space.evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
      // a disc that is whole in the window, big enough to measure
      if (place === null || place.r < 18 || place.x - place.r * 1.5 < 0 || place.x + place.r * 1.5 > width || place.y - place.r * 1.5 < 0 || place.y + place.r * 1.5 > height) continue;
      const png = (await page.screenshot({ scale: "css" })).toString("base64");
      const disc = await discAt(page, png, place.x, place.y, 45);
      measured.push(`${id} at ${Math.round(place.x)},${Math.round(place.y)} (r ${place.r.toFixed(0)}): ${disc.width}x${disc.height}, axes ${disc.axes.toFixed(3)}`);
      expect(disc.pixels, `${id} is found in the picture`).toBeGreaterThan(200);
      // its radius on the screen as reported is the drawn one (a body is drawn wider the farther out it is): to a tenth
      expect.soft(Math.abs(Math.sqrt(disc.pixels / Math.PI) / place.r - 1), `${id}: the radius the view reports against the disc's`).toBeLessThan(0.12);
      expect.soft(disc.axes, `${id}: long axis over short`).toBeLessThan(1 + SLACK);
    }
    console.log(`${shape}:\n${measured.join("\n")}`);
    expect(measured.length, "at least two bodies are measured").toBeGreaterThanOrEqual(2);
  });
}
