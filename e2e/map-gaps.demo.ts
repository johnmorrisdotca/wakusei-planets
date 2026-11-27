// Pluto's south was never photographed and its far side was seen only at low resolution. The shipped map paints them (MODULES-1798), so the bottom of the picture has texture and is about as bright as the mapped ground,
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
  /** The brightness of the requested polar band as a share of the mapped ground's (rows 20 to 50 percent). */
  tone: number;
  /** The detail in the requested polar band, as a share of the most detail in the opposite half. A plain tone is 0. */
  south: number;
}

async function gapOf(page: Page, body: string, width: number, side: "north" | "south" = "south", fromY = 0.25, band: readonly [number, number] = [0.85, 1]): Promise<Gap> {
  return page.evaluate(
    async ([name, w, pole, start, bandStart, bandEnd]) => {
      const bitmap = await createImageBitmap(await (await fetch(`textures/${name}-${w}.webp`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { data, width: cols, height: rows } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const sample = (x: number, y: number): number => {
        const row = pole === "north" ? rows - 1 - y : y;
        const i = (row * cols + x) * 4;
        return (data[i]! + data[i + 1]! + data[i + 2]!) / 765;
      };
      const detail: number[] = [];
      for (let y = 0; y < rows; y += 1) {
        let sum = 0;
        for (let x = 1; x < cols; x += 1) sum += Math.abs(sample(x, y) - sample(x - 1, y));
        detail.push(sum / (cols - 1));
      }
      const smooth = detail.map((_, y) => (detail[Math.max(0, y - 1)]! + detail[y]! + detail[Math.min(rows - 1, y + 1)]!) / 3);
      const peak = Math.max(...smooth.slice(0, rows >> 1));
      const span = Math.max(1, Math.floor(rows * 0.015));
      let step = 0;
      for (let y = Math.floor(rows * start); y < rows - span; y += 1) step = Math.max(step, (smooth[y]! - smooth[y + span]!) / peak);
      const mean = (from: number, to: number): number => {
        let sum = 0;
        for (let y = Math.floor(rows * from); y < Math.floor(rows * to); y += 1) for (let x = 0; x < cols; x += 1) sum += sample(x, y);
        return sum / (cols * (Math.floor(rows * to) - Math.floor(rows * from)));
      };
      const from = Math.floor(rows * bandStart);
      const to = Math.floor(rows * bandEnd);
      const south = smooth.slice(from, to).reduce((sum, value) => sum + value, 0) / (to - from) / peak;
      return { step, tone: mean(bandStart, bandEnd) / mean(0.2, 0.5), south };
    },
    [body, width, side, fromY, ...band] as const,
  );
}

for (const width of [512, 1024, 2048]) {
  test(`Pluto's map at ${width}: the painted south keeps texture, and the detail does not stop in one step`, async ({ page }) => {
    await page.goto("/wakusei-planets/");
    const gap = await gapOf(page, "pluto", width);
    // read the same way on the shipped maps: step 0.14 to 0.16, tone 0.91, south 0.29 to 0.52
    expect(gap.step, `the detail lost over 1.5% of the height is ${gap.step.toFixed(2)} of the most`).toBeLessThan(0.35);
    expect(gap.tone, `the painted south is ${gap.tone.toFixed(2)} of the mapped ground's brightness`).toBeGreaterThan(0.6);
    expect(gap.tone).toBeLessThan(1.05);
    expect(gap.south, `the south's detail is ${gap.south.toFixed(2)} of the northern half's`).toBeGreaterThan(0.15);
  });
}

// Vesta's north was in the dark at Dawn (MODULES-1196).
// The same reading as Pluto's, with the pole at the bottom of the measurement: a plain tone, not a dark cap, and no hard edge.
for (const [body, side, where, fromY] of [
  ["vesta", "north", "north", 0.7],
  // Triton and Charon were painted past the photographed ground. The unseen pole is the outer part of the picture (MODULES-1196).
  ["triton", "north", "north", 0.68],
  ["charon", "south", "south", 0.64],
] as const) {
  for (const width of [512, 1024, 2048]) {
    test(`${body}'s map at ${width}: the unseen ${where} is a plain tone with a soft edge`, async ({ page }) => {
      await page.goto("/wakusei-planets/");
      const gap = await gapOf(page, body, width, side, fromY);
      expect(gap.step, `the detail lost over 1.5% of the height is ${gap.step.toFixed(2)} of the most`).toBeLessThan(0.35);
      expect(gap.tone, `the unseen part is ${gap.tone.toFixed(2)} of the mapped ground's brightness`).toBeGreaterThan(0.6);
      expect(gap.tone).toBeLessThan(1.05);
      expect(gap.south, `the unseen part's detail is ${gap.south.toFixed(2)} of the mapped ground's`).toBeLessThan(0.2);
    });
  }
}


for (const width of [512, 1024, 2048]) {
  test(`Ceres's map at ${width}: Dawn detail reaches both polar regions`, async ({ page }) => {
    await page.goto("/wakusei-planets/");
    const north = await gapOf(page, "ceres", width, "north", 0.955, [0.955, 1]);
    expect(north.south, "the north pole retains Dawn detail").toBeGreaterThan(0.18);
    const south = await gapOf(page, "ceres", width, "south", 0.88, [0.88, 0.94]);
    expect(south.south, "the measured south stays textured").toBeGreaterThan(0.40);
    const shadow = await gapOf(page, "ceres", width, "south", 0.94, [0.98, 1]);
    expect(shadow.south, "the unmapped shadow has no invented terrain").toBeLessThan(0.09);
    expect(shadow.step, "the measured ground feathers into the shadow").toBeLessThan(0.40);
  });
}
