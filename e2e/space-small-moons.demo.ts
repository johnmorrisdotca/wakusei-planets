// A small far moon with no map is drawn clean in true distances (MODULES-994). Nix, Hydra, Miranda and Proteus are cratered rock made by the shader: each crater's slope was taken from the difference between
// neighbouring pixels and tipped the surface by up to fifteen times that, so the wall of every crater a few pixels across turned right away from the light and drew a hard black ring, and the pixel-sized
// ones a speck: over the whole disc, a grid of dark edges. (Not number precision: the scene is moved to the body looked at, so a moon 5 billion kilometres from the Sun is drawn within a few hundred
// radii of the origin.) A picture test: lit from the camera's side, the middle of the disc holds little black (the real dark bowls: under 6 percent). Chromium, drawing in software. Every wait is on what the page reports.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { callOn, drawn, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

/** Pictures for a look by a person: written when `SMALL_MOON_SHOTS` names a folder. */
const keep = (name: string, data: Buffer): void => {
  const dir = process.env["SMALL_MOON_SHOTS"];
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.png`, data);
};

test("Nix, Hydra, Miranda and Proteus in true distances: no black rings or specks over the middle of the disc", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&look=painted&scale=true&light=lit");
  const black: string[] = [];
  const shares: string[] = [];
  for (const id of ["nix", "hydra", "miranda", "proteus"]) {
    await drawn(page, () => callOn(page, "goTo", id, { smooth: false }));
    await page.waitForTimeout(1200);
    const picture = await page.locator(SPACE).screenshot();
    keep(id, picture);
    const share = await page.evaluate(
      async ({ data, spot }) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const ratio = bitmap.width / (document.querySelector("wakusei-space")?.clientWidth ?? bitmap.width);
        const [x0, x1] = [Math.round((spot.x - 0.35 * spot.r) * ratio), Math.round((spot.x + 0.35 * spot.r) * ratio)];
        const [y0, y1] = [Math.round((spot.y - 0.55 * spot.r) * ratio), Math.round((spot.y + 0.55 * spot.r) * ratio)];
        const { data: px } = context.getImageData(x0, y0, x1 - x0, y1 - y0);
        let dark = 0;
        for (let i = 0; i < px.length; i += 4) if ((px[i]! + px[i + 1]! + px[i + 2]!) / 765 < 0.2) dark += 1;
        return dark / (px.length / 4);
      },
      { data: picture.toString("base64"), spot: (await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id))! },
    );
    shares.push(`${id} ${(share * 100).toFixed(1)}%`);
    if (share > 0.06) black.push(`${id}: ${(share * 100).toFixed(1)}% of the middle of the disc is darker than a fifth of white`);
  }
  // before (origin/main's shader): nix 10.3%, hydra 14.4%, miranda 16.5%, proteus 25.2%; after: 0.0%, 3.8%, 0.1%, 3.5% (the bowls that are really dark)
  expect(black, shares.join(", ")).toEqual([]);
});
