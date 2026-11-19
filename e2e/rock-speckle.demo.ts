// A procedural rock body (a sphere or a shape, with no map) is not covered in a lattice of dark dots (MODULES-1639): the relief took the difference between neighbouring pixels of the craters' height, and the rim of a crater a few
// pixels wide read as noise, in blocks of 2 by 2 pixels. The picture check counts the lit pixels that are darker than the mean of their eight neighbours by more than 0.08: about 15 to 21 per cent of them were on a hardware
// GPU (2 to 3 in software), and a body drawn from a picture (Phobos) has under half of one; the limit is 1. Miranda is left out: its own patches of colour make 2.5 per cent with no relief at all. Chromium, in software.
import "./load.ts";
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

/** The share of the lit pixels of the picture that are isolated dark dots. */
const dots = (page: import("@playwright/test").Page, png: Buffer): Promise<number> =>
  page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(img, 0, 0);
    const px = context.getImageData(0, 0, img.width, img.height).data;
    const lum = (x: number, y: number): number => (px[(y * img.width + x) * 4]! * 0.3 + px[(y * img.width + x) * 4 + 1]! * 0.59 + px[(y * img.width + x) * 4 + 2]! * 0.11) / 255;
    let lit = 0;
    let dark = 0;
    for (let y = 1; y < img.height - 1; y += 1) {
      for (let x = 1; x < img.width - 1; x += 1) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (dx !== 0 || dy !== 0) sum += lum(x + dx, y + dy);
        const mean = sum / 8;
        if (mean <= 0.2) continue;
        lit += 1;
        if (mean - lum(x, y) > 0.08) dark += 1;
      }
    }
    return dark / Math.max(1, lit);
  }, png.toString("base64"));

for (const body of ["nereid", "nix", "hydra", "janus", "amalthea", "epimetheus", "calypso", "phobos"]) {
  test(`${body} in the realistic look has no lattice of dark dots on its lit side`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto(`${URL}?body=${body}&look=realistic`);
    await page.locator("#main").hover();
    await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    await page.waitForTimeout(1500);
    const share = await dots(page, await page.locator("#main").screenshot());
    expect(share, `${(share * 100).toFixed(2)} per cent of the lit pixels are isolated dark dots`).toBeLessThan(0.01);
  });
}
