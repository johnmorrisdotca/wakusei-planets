// The Sun's shaded looks (`realistic` and `painted` draw its map, `illustrated` its shader code) must draw the same as they did before the star look was added. The golden pictures in e2e/golden/ were drawn by the code before it (software WebGL, 200 px, no turn);
// each frame is compared pixel by pixel in the page and may differ only by the renderer's noise. `UPDATE_GOLDEN=1 pnpm test:demo:one --project=chromium-desk e2e/sun.demo.ts` draws them again.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const PAGE = "/wakusei-planets/";
const GOLDEN = `${import.meta.dirname}/golden`;
const SIZE = 200;
/** A pixel counts as different past this much in any channel (of 255); the frame fails if more than the share below differ, or the mean difference is past the mean. */
const PIXEL = 10;
const SHARE = 0.005;
const MEAN = 1.5;

for (const look of ["realistic", "painted", "illustrated"] as const) {
  test(`the Sun's ${look} look draws as it did before the star look`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
    await page.setViewportSize({ width: SIZE, height: SIZE });
    await page.goto(`${PAGE}embed.html?body=sun&look=${look}&turn=0&tilt=0&pitch=0&meridian=0&phase=0`);
    const sun = page.locator("wakusei-body");
    await expect(sun).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    if (look !== "illustrated") await expect.poll(() => sun.evaluate((el) => (el as unknown as { stats: { textureWidth: number } }).stats.textureWidth), { timeout: 60_000 }).toBeGreaterThanOrEqual(512);
    await page.waitForTimeout(1200);
    // The frame's credit sits in its corner (frame-credit.ts) and is not the Sun: take it off so the picture compared is the Sun's alone.
    await page.getByTestId("frame-credit").evaluate((el) => el.remove());
    const shot = await page.screenshot();
    const file = `${GOLDEN}/sun-${look}.png`;
    if (process.env.UPDATE_GOLDEN === "1") {
      mkdirSync(GOLDEN, { recursive: true });
      writeFileSync(file, shot);
      return;
    }
    const golden = readFileSync(file).toString("base64");
    const result = await page.evaluate(
      async ([now, then, pixel]) => {
        const read = async (data: string): Promise<Uint8ClampedArray> => {
          const img = new Image();
          img.src = `data:image/png;base64,${data}`;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(img, 0, 0);
          return context.getImageData(0, 0, img.width, img.height).data;
        };
        const a = await read(now as string);
        const b = await read(then as string);
        let differing = 0;
        let total = 0;
        let bright = 0;
        for (let i = 0; i < a.length; i += 4) {
          const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!));
          total += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
          if (d > (pixel as number)) differing += 1;
          if (a[i]! + a[i + 1]! + a[i + 2]! > 60) bright += 1;
        }
        return { pixels: a.length / 4, differing, mean: total / (a.length / 4) / 3, bright, sameSize: a.length === b.length };
      },
      [shot.toString("base64"), golden, PIXEL] as const,
    );
    expect(result.sameSize).toBe(true);
    expect(result.bright / result.pixels, "the Sun is drawn").toBeGreaterThan(0.1);
    expect(result.differing / result.pixels, `pixels that differ by more than ${PIXEL}`).toBeLessThan(SHARE);
    expect(result.mean, "mean difference per channel").toBeLessThan(MEAN);
  });
}
