import "./load.ts";
import { expect, test } from "@playwright/test";

// Five by five brightness samples from the original NASA/JPL composite on the mission grid.
// The four centres are the published IAU Gazetteer coordinates in src/data/places-venus.ts.
const FEATURES = [
  {
    name: "Maxwell Montes", lon: 3.3, lat: 65.2, width: 13, height: 9,
    brightness: [
      123, 136, 134, 129, 123,
      186, 181, 199, 192, 155,
      157, 184, 184, 186, 187,
      95, 172, 199, 196, 214,
      102, 101, 150, 159, 161,
    ],
  },
  {
    name: "Artemis Corona", lon: 135, lat: -35, width: 34, height: 27,
    brightness: [
      129, 133, 144, 108, 93,
      106, 114, 122, 117, 125,
      97, 107, 108, 107, 108,
      90, 115, 117, 107, 76,
      95, 84, 89, 83, 83,
    ],
  },
  {
    name: "Mead", lon: 57.2, lat: 12.5, width: 4.7, height: 4.7,
    brightness: [
      61, 64, 68, 46, 65,
      59, 84, 97, 74, 61,
      55, 82, 93, 94, 74,
      57, 73, 93, 84, 71,
      68, 63, 69, 65, 69,
    ],
  },
  {
    name: "Cleopatra", lon: 7.1, lat: 65.8, width: 3.2, height: 2.4,
    brightness: [
      190, 192, 198, 191, 162,
      193, 177, 168, 181, 174,
      189, 140, 115, 158, 189,
      195, 187, 177, 190, 197,
      192, 193, 203, 201, 201,
    ],
  },
] as const;

test("Venus's realistic map has its radar features at their published coordinates", async ({ page }) => {
  await page.goto("/wakusei-planets/textures/venus-2048.webp");
  const results = await page.evaluate(async (features) => {
    const texture = new Image();
    texture.src = location.href;
    await texture.decode();
    const canvas = document.createElement("canvas");
    canvas.width = texture.naturalWidth;
    canvas.height = texture.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(texture, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return features.map(({ name, lat, lon, width, height, brightness }) => {
      // Average the texture pixels in each cell. Canvas downsampling uses different filters in Chromium and WebKit.
      const xEdges = Array.from({ length: 6 }, (_, i) => Math.round((lon + 180 + width * (i / 5 - 0.5)) * canvas.width / 360));
      const yEdges = Array.from({ length: 6 }, (_, i) => Math.round((90 - lat + height * (i / 5 - 0.5)) * canvas.height / 180));
      const observed = brightness.map((_, i) => {
        const col = i % 5, row = Math.floor(i / 5);
        const left = xEdges[col]!, right = xEdges[col + 1]!;
        const top = yEdges[row]!, bottom = yEdges[row + 1]!;
        let sum = 0;
        for (let y = top; y < bottom; y += 1) {
          for (let x = left; x < right; x += 1) {
            const offset = (y * canvas.width + x) * 4;
            sum += pixels[offset]! + pixels[offset + 1]! + pixels[offset + 2]!;
          }
        }
        return sum / ((right - left) * (bottom - top) * 3);
      });
      const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
      const observedMean = mean(observed);
      const referenceMean = mean(brightness);
      const a = observed.map((value) => value - observedMean);
      const b = brightness.map((value) => value - referenceMean);
      const cross = a.reduce((sum, value, i) => sum + value * b[i]!, 0);
      return { name, correlation: cross / (Math.hypot(...a) * Math.hypot(...b)) };
    });
  }, FEATURES);
  for (const { name, correlation } of results) expect(correlation, name).toBeGreaterThan(0.85);
});
