// Every body turns when nothing says otherwise, with no date and with a date. Two pictures, two seconds apart, must differ in the middle,
// where the disc is (a ringed body's rings do not turn, so the whole frame barely changes). Chromium, in software, with motion allowed.
import { expect, type Page, test } from "@playwright/test";
import { apparent } from "../src/ephemeris.ts";
import { BODY_IDS, type BodyId } from "../src/facts.ts";

/** A moment when the body is well lit, so a turn of the surface can be seen. Mercury and Venus are a dark crescent for much of the year. */
const litTime = (id: BodyId): string => {
  if (id === "sun") return "2026-11-02T12:00:00.000Z";
  let best = Date.UTC(2026, 5, 15, 12);
  let lit = -1;
  for (let month = 0; month < 36; month += 1) {
    const time = Date.UTC(2026, month, 15, 12);
    const next = apparent(id, time).illumination;
    if (next > lit) {
      lit = next;
      best = time;
    }
  }
  return new Date(best).toISOString();
};

/** The share of the middle of two pictures that differs. A body told to stay still measures 0. */
const centreChanged = (page: Page, before: Buffer, after: Buffer): Promise<number> =>
  page.evaluate(
    async ([a, b]) => {
      const load = async (data: string): Promise<ImageData> => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
      };
      const p = await load(a as string);
      const q = await load(b as string);
      const w = p.width;
      const h = p.height;
      let differ = 0;
      let n = 0;
      for (let y = Math.round(h * 0.35); y < Math.round(h * 0.65); y += 1) {
        for (let x = Math.round(w * 0.35); x < Math.round(w * 0.65); x += 1) {
          const i = (y * w + x) * 4;
          n += 1;
          if (Math.abs(p.data[i]! - q.data[i]!) + Math.abs(p.data[i + 1]! - q.data[i + 1]!) + Math.abs(p.data[i + 2]! - q.data[i + 2]!) > 12) differ += 1;
        }
      }
      return n === 0 ? 0 : differ / n;
    },
    [before.toString("base64"), after.toString("base64")] as const,
  );

test.use({ reducedMotion: "no-preference" });

test("every body turns by default, and a dated picture turns too", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  test.setTimeout(20 * 60_000);
  await page.setViewportSize({ width: 480, height: 480 });
  const body = page.locator("wakusei-body");

  const settle = () =>
    body.evaluate(async (el) => {
      const node = el as HTMLElement & { stats: { textureWidth: number } };
      const start = performance.now();
      let last = -1;
      let steady = 0;
      while (performance.now() - start < 12_000) {
        const width = node.stats.textureWidth;
        steady = width === last ? steady + 1 : 0;
        last = width;
        if (steady >= 3 && (width > 0 || performance.now() - start > 800)) return width;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return last;
    });

  for (const id of BODY_IDS) {
    for (const dated of [false, true]) {
      const time = dated ? `&time=${encodeURIComponent(litTime(id))}` : "";
      await page.goto(`/wakusei-planets/embed.html?body=${id}&look=realistic${time}`);
      await expect(body).toHaveAttribute("body", id);
      await expect(body).not.toHaveAttribute("turn");
      await expect(body).toHaveAttribute("data-state", "live", { timeout: 60_000 });
      await settle();
      const before = await body.screenshot();
      await page.waitForTimeout(2000);
      const after = await body.screenshot();
      const share = await centreChanged(page, before, after);
      // A still picture of the same body differs by 0. The smoothest turning one measured (Uranus, no date) is about 0.008.
      expect(share, `${id} ${dated ? "dated" : "portrait"}`).toBeGreaterThan(0.004);
    }
  }
});
