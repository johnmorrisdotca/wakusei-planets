import "./load.ts";
import { expect, test } from "@playwright/test";

const models = [
  ["mesa-red-dwarf", 1, "Convective interior"],
  ["mesa-massive-zams", 2, "Convective core"],
  ["mesa-giant-tip", 5, "Hydrogen-burning shell"],
  ["mesa-hot-white-dwarf", 3, "Carbon–oxygen core"],
] as const;

test("each named stellar model opens a sourced cut in the star demo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "photographs the software 3D renderer");
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/wakusei-planets/star.html");
  const star = page.locator("#star");
  const controls = page.locator("#stellar-cutaway-row");
  const legend = star.locator("#cutaway");
  await expect(controls).toBeHidden();
  for (const [id, layerCount, layer] of models) {
    await page.locator(`#interior-models [data-preset="${id}"]`).click();
    await controls.locator('[data-cut="quarter"]').click();
    await star.hover();
    await expect(star).toHaveAttribute("data-shells", String(layerCount), { timeout: 60_000 });
    await expect(legend.locator("li[data-layer]")).toHaveCount(layerCount);
    await expect(legend).toContainText(layer);
    await expect(legend.getByRole("link", { name: "Source model" })).toHaveAttribute("href", /MESAHub\/mesa\/blob\/24\.08\.1/);
    await expect(star.locator("#cutaway-heading")).toHaveText("Radius from the centre");
    const body = (await star.boundingBox())!;
    const picture = (await star.locator("#stage").boundingBox())!;
    if (id === "mesa-giant-tip") {
      const inset = star.locator("#stellar-detail");
      await expect(inset.locator("[data-scale]")).toHaveText("0–22,100 km from centre, inner 0.018% of the radius");
      const detail = (await inset.boundingBox())!;
      expect(detail.x).toBeGreaterThanOrEqual(picture.x + picture.width - 1);
      expect(detail.y + detail.height).toBeLessThanOrEqual(picture.y + picture.height);
      const ratio = await inset.locator("svg").evaluate((svg) => {
        const width = (layer: string) => svg.querySelector<SVGPathElement>(`[data-layer="${layer}"]`)!.getBBox().width;
        return width("helium-core") / width("hydrogen-shell");
      });
      expect(ratio).toBeCloseTo(18529.87 / 22091.93, 3);
      await expect(legend.locator('li[data-layer="hydrogen-shell"]')).toContainText("22,100 km");
    } else {
      expect(picture.x + picture.width / 2).toBeCloseTo(body.x + body.width / 2, 0);
    }
    await star.screenshot({ path: testInfo.outputPath(`${id}.png`) });
  }
  await controls.locator('[data-cut="half"]').click();
  await expect(star).toHaveAttribute("cutaway", "half");
  await expect(page).toHaveURL(/cutaway=half/);
  await expect(page.locator("#embed-panel a[href^='embed.html']")).toHaveAttribute("href", /[?&]cutaway=half/);
  await page.locator("#presets [data-preset=proxima]").click();
  await expect(controls).toBeHidden();
  await expect(star.locator("#cutaway-panel")).toBeHidden();
  expect(errors).toEqual([]);
});

test("a named stellar model keeps its cutaway in a line embed with a Japanese legend", async ({ page }, testInfo) => {
  await page.goto("/wakusei-planets/embed.html?star=mesa-giant-tip&cutaway=half&look=line&lang=ja");
  const star = page.locator("wakusei-body");
  await expect(star.locator("#stage svg [data-layer]")).toHaveCount(5);
  await expect(star.locator("#cutaway-heading")).toHaveText("中心からの半径");
  await expect(star.locator("#stellar-detail")).toContainText("水素燃焼殻の拡大図");
  await expect(star.locator("#stellar-detail [data-scale]")).toContainText("中心から 0〜22,100 km");
  await expect(star).toHaveAttribute("data-stellar-cut", "");
  await expect.poll(async () => {
    const legend = await star.locator("#cutaway-panel").boundingBox();
    const controls = await page.locator("kazoku-view-controls").boundingBox();
    return legend !== null && controls !== null && legend.y + legend.height <= controls.y;
  }).toBe(true);
  if (testInfo.project.name === "chromium-phone") await star.screenshot({ path: testInfo.outputPath("mesa-giant-tip-ja-phone.png") });
  await star.evaluate((element) => element.setAttribute("radius-sun", "150"));
  await expect(star.locator("#stage svg [data-layer]")).toHaveCount(0);
  await expect(star.locator("#stellar-detail")).toBeHidden();
  await expect(star.locator("#cutaway [data-empty]")).toBeVisible();
});
