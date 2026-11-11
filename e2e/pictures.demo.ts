// The painted look draws from the pictures the package ships: Saturn's rings from the Cassini strip (and the table's strip when the look is realistic), and a moon from its map. Chromium, in software.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("painted and realistic Saturn both ask for the Cassini ring strip", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const asked: string[] = [];
  page.on("response", (response) => {
    if (/saturn-ring-2048\.webp$/.test(response.url())) asked.push(`${response.status()}`);
  });
  await page.goto(`${URL}?body=saturn&look=painted`);
  await page.locator("#main").hover();
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(() => asked, { timeout: 10_000 }).toEqual(["200"]);
  asked.length = 0;
  await page.goto(`${URL}?body=saturn&look=realistic`);
  await page.locator("#main").hover();
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(() => asked, { timeout: 10_000 }).toEqual(["200"]);
});

test("a painted moon draws from its map", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const asked: string[] = [];
  page.on("response", (response) => {
    if (/\/textures\/moon-\d+\.webp$/.test(response.url()) && response.status() === 200) asked.push(response.url().split("/").pop()!);
  });
  await page.goto(`${URL}?body=moon&look=painted`);
  await page.locator("#main").hover();
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(() => asked.includes("moon-512.webp") || asked.includes("moon-1024.webp"), { timeout: 10_000 }).toBe(true);
});

test("a small dwarf planet in the realistic look is smooth: soft craters, no pixel-sized specks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  for (const size of [64, 80, 128]) {
    await page.setViewportSize({ width: size, height: size });
    for (const body of ["orcus", "quaoar", "makemake", "gonggong", "sedna"]) {
      await page.goto(`${URL}embed.html?scene=${encodeURIComponent(`look:realistic~bg:black~labels:0~orbits:0~${body}_0_0_0.3_0`)}`);
      await expect(page.locator("wakusei-portrait")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
      await page.waitForTimeout(800);
      // The frame's credit (frame-credit.ts) is text in the corner, not the dwarf planet: take it off so only the body is looked at.
      await page.getByTestId("frame-credit").evaluate((el) => el.remove());
      const png = (await page.screenshot()).toString("base64");
      // a speck is a lit pixel that differs from the middle one of its eight neighbours by more than a fifth of the brightness range
      const specks = await page.evaluate(async (data) => {
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
        let disc = 0;
        let bad = 0;
        for (let y = 2; y < img.height - 2; y += 1) {
          for (let x = 2; x < img.width - 2; x += 1) {
            const here = lum(x, y);
            const around: number[] = [];
            for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (dx || dy) around.push(lum(x + dx, y + dy));
            around.sort((a, b) => a - b);
            if (around[0]! < 0.05) continue;
            disc += 1;
            if (Math.abs(here - (around[3]! + around[4]!) / 2) > 0.2) bad += 1;
          }
        }
        return { disc, bad };
      }, png);
      expect(specks.disc, `${body} at ${size} px is drawn`).toBeGreaterThan(size * size * 0.15);
      expect(specks.bad / specks.disc, `${body} at ${size} px: specks in the disc`).toBeLessThan(0.004);
    }
  }
});

test("no surface picture has a black strip at its edges: the seam of every map is real surface on both sides", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "one browser is enough for a read of the pictures");
  await page.goto(URL);
  const names = await page.evaluate(async () => {
    const list = await (await fetch("textures/SOURCES.json")).json() as Record<string, unknown>;
    return Object.keys(list).filter((name) => name !== "saturn-ring");
  });
  expect(names.length).toBeGreaterThan(20);
  // the mean brightness of the first and last two columns and rows of each 512 picture: a black strip (Mimas's map once had 22 black columns at the seam, a dark band pole to pole on the globe) reads under 0.06
  const dark = await page.evaluate(async (bodies) => {
    const out: string[] = [];
    for (const body of bodies) {
      const img = new Image();
      img.src = `textures/${body}-512.webp`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(img, 0, 0);
      const data = context.getImageData(0, 0, img.width, img.height).data;
      const mean = (xs: number[], ys: number[]): number => {
        let sum = 0;
        for (const x of xs) for (const y of ys) sum += data[(y * img.width + x) * 4]! + data[(y * img.width + x) * 4 + 1]! + data[(y * img.width + x) * 4 + 2]!;
        return sum / (3 * 255 * xs.length * ys.length);
      };
      const all = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
      const edges = { left: mean([0, 1], all(img.height)), right: mean([img.width - 2, img.width - 1], all(img.height)), top: mean(all(img.width), [0, 1]), bottom: mean(all(img.width), [img.height - 2, img.height - 1]) };
      for (const [edge, value] of Object.entries(edges)) if (value < 0.06) out.push(`${body} ${edge} ${value.toFixed(3)}`);
    }
    return out;
  }, names);
  // the Sun's picture is a photograph of the disc turned onto the sphere, and the poles of some maps were never imaged (Triton's south, Charon's north): black there is honest, so only the seam (left and right) must be clean
  expect(dark.filter((line) => / (left|right) /.test(line)), "black columns at a seam").toEqual([]);
});
