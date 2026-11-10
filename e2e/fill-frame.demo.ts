// Every 3D view of the demo fills its frame edge to edge, at any shape of window: no square box inside a wider frame, no letterbox, nothing cut off. The canvas of the space view, the portrait and the line-up is
// measured against the frame that holds it, at a desk (1440), a phone (390) and a wide, short window, and the two boxes must agree to within a pixel. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const SIZES = [
  ["desk", 1440, 900],
  ["phone", 390, 844],
  ["wide", 2400, 700],
] as const;
const PAGES = [
  ["space", "/wakusei-planets/space.html?t=2026-11-02T14:00Z", "#sky", "wakusei-space"],
  ["portrait", "/wakusei-planets/portrait.html", "#wrap", "wakusei-portrait"],
  ["line-up", "/wakusei-planets/lineup.html", "#view", "wakusei-lineup"],
] as const;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
const boxes = (page: Page, frame: string, element: string): Promise<{ frame: Box; element: Box; canvas: Box | null }> =>
  page.evaluate(
    ([f, e]) => {
      const rect = (n: Element): { left: number; top: number; width: number; height: number } => {
        const r = n.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      };
      const frameBox = document.querySelector(f!)!;
      const el = document.querySelector(e!)!;
      const canvas = el.shadowRoot?.querySelector("canvas") ?? null;
      return { frame: rect(frameBox), element: rect(el), canvas: canvas ? rect(canvas) : null };
    },
    [frame, element] as const,
  );

for (const [name, url, frame, element] of PAGES) {
  for (const [shape, width, height] of SIZES) {
    test(`the ${name} fills its frame edge to edge at ${shape} (${width} by ${height}): the element and its canvas are the frame's box to within a pixel`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      await page.goto(url);
      await page.locator(`${element}[data-state=live]`).waitFor({ timeout: 90_000 });
      await page.locator(frame).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      const seen = await boxes(page, frame, element);
      expect(seen.frame.width, "the frame has a size").toBeGreaterThan(100);
      for (const key of ["left", "top", "width", "height"] as const) {
        expect(Math.abs(seen.element[key] - seen.frame[key]), `${name}, ${shape}: the element's ${key} against the frame's (${JSON.stringify(seen.element)} in ${JSON.stringify(seen.frame)})`).toBeLessThanOrEqual(1);
      }
      expect(seen.canvas, "it has a canvas").not.toBeNull();
      for (const key of ["left", "top", "width", "height"] as const) {
        expect(Math.abs(seen.canvas![key] - seen.frame[key]), `${name}, ${shape}: the canvas's ${key} against the frame's (${JSON.stringify(seen.canvas)} in ${JSON.stringify(seen.frame)})`).toBeLessThanOrEqual(1);
      }
    });
  }
}
