// Pluto's south was never photographed. The shipped map paints it (MODULES-1798), so the bottom of the picture has texture and is about as bright as the mapped ground,
// and the detail does not stop in one step at the edge of the photographed ground (MODULES-993 made that edge a fade; a hard-edged dark half was the fault). A picture test
// on the shipped map itself, read the same way at each width. Chromium decodes the picture.
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "the picture is read once, Chromium only");
});

interface Gap {
  /** The most detail lost over 1.5 percent of the map's height, as a share of the most detail any row has: 1 is a straight edge, near 0 a slow fade. */
  step: number;
  /** The brightness of the bottom 15 percent of the map as a share of the mapped ground's (rows 20 to 50 percent). */
  tone: number;
  /** The detail in the bottom 15 percent, as a share of the most detail in the northern half. A plain tone is 0. */
  south: number;
}

async function gapOf(page: Page, body: string, width: number): Promise<Gap> {
  return page.evaluate(
    async ([name, w]) => {
      const bitmap = await createImageBitmap(await (await fetch(`textures/${name}-${w}.webp`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { data, width: cols, height: rows } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const grey = (x: number, y: number): number => (data[(y * cols + x) * 4]! + data[(y * cols + x) * 4 + 1]! + data[(y * cols + x) * 4 + 2]!) / 765;
      const detail: number[] = [];
      for (let y = 0; y < rows; y += 1) {
        let sum = 0;
        for (let x = 1; x < cols; x += 1) sum += Math.abs(grey(x, y) - grey(x - 1, y));
        detail.push(sum / (cols - 1));
      }
      const smooth = detail.map((_, y) => (detail[Math.max(0, y - 1)]! + detail[y]! + detail[Math.min(rows - 1, y + 1)]!) / 3);
      const peak = Math.max(...smooth.slice(0, rows >> 1));
      const span = Math.max(1, Math.floor(rows * 0.015));
      let step = 0;
      for (let y = rows >> 2; y < rows - span; y += 1) step = Math.max(step, (smooth[y]! - smooth[y + span]!) / peak);
      const mean = (from: number, to: number): number => {
        let sum = 0;
        for (let y = Math.floor(rows * from); y < Math.floor(rows * to); y += 1) for (let x = 0; x < cols; x += 1) sum += grey(x, y);
        return sum / (cols * (Math.floor(rows * to) - Math.floor(rows * from)));
      };
      const from = Math.floor(rows * 0.85);
      const south = smooth.slice(from).reduce((sum, value) => sum + value, 0) / (rows - from) / peak;
      return { step, tone: mean(0.85, 1) / mean(0.2, 0.5), south };
    },
    [body, width] as const,
  );
}

for (const width of [512, 1024, 2048]) {
  test(`Pluto's map at ${width}: the painted south keeps texture, and the detail does not stop in one step`, async ({ page }) => {
    await page.goto("/wakusei-planets/");
    const gap = await gapOf(page, "pluto", width);
    // read the same way on the shipped maps: step 0.16 to 0.20, tone 0.89, south 0.45 to 0.62
    expect(gap.step, `the detail lost over 1.5% of the height is ${gap.step.toFixed(2)} of the most`).toBeLessThan(0.35);
    expect(gap.tone, `the painted south is ${gap.tone.toFixed(2)} of the mapped ground's brightness`).toBeGreaterThan(0.6);
    expect(gap.tone).toBeLessThan(1.05);
    expect(gap.south, `the south's detail is ${gap.south.toFixed(2)} of the northern half's`).toBeGreaterThan(0.15);
  });
}
