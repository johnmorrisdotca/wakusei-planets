// The scale of the space view and its marks (MODULES-856): it opens at true distances, the scale in use is always named on the view, a body too small to see has a ring and its name, and the Moon is never as big as the Earth.
// Chromium, drawing in software.
import { expect, test } from "@playwright/test";
import { goTo, nameBoxes, openSpace, setOn, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const scaleLine = (page: import("@playwright/test").Page) => page.locator(SPACE).evaluate((el) => el.shadowRoot!.querySelector(".sp-scale")!.textContent);
const rings = (page: import("@playwright/test").Page) =>
  page.locator(SPACE).evaluate((el) => {
    const out: { id: string; x: number; y: number }[] = [];
    for (const ring of el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-ring:not([hidden])")) {
      const id = ring.dataset["ring"]!;
      const at = (el as unknown as { placeOf(id: string): { x: number; y: number } | null }).placeOf(id);
      // one outside the view is not on the screen
      if (!at || at.x < 0 || at.y < 0 || at.x > el.clientWidth || at.y > el.clientHeight) continue;
      const m = /translate\((-?\d+)px,\s*(-?\d+)px\)/.exec(ring.style.transform)!;
      out.push({ id, x: Number(m[1]) - (at?.x ?? 0), y: Number(m[2]) - (at?.y ?? 0) });
    }
    return out;
  });

test("it opens at true distances, and the scale in use is always named on the view, in the element's language", async ({ page }) => {
  await openSpace(page);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "scale"))).toBe("true");
  expect(await scaleLine(page)).toBe("True distances");
  await setOn(page, "scale", "compressed");
  expect(await scaleLine(page)).toBe("Distances squeezed to fit");
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  expect(await scaleLine(page)).toBe("距離を縮めて表示");
  await setOn(page, "scale", "true");
  expect(await scaleLine(page)).toBe("本当の距離");
  await setOn(page, "scaleNames", { true: "Real distances" });
  expect(await scaleLine(page)).toBe("Real distances");
  // the line is there with the names turned off, and is on the screen
  await setOn(page, "labels", false);
  const box = await page.locator(SPACE).evaluate((el) => {
    const r = el.shadowRoot!.querySelector(".sp-scale")!.getBoundingClientRect();
    const h = el.getBoundingClientRect();
    return r.width > 0 && r.left >= h.left && r.right <= h.right && r.top >= h.top && r.bottom <= h.bottom;
  });
  expect(box, "the scale line is inside the view").toBe(true);
});

test("a body too small to see has a ring on it and its name; the Earth, large, has no ring", async ({ page }) => {
  await openSpace(page);
  expect(await rings(page), "the Earth fills the view").toEqual([]);
  await goTo(page, "Inner planets");
  const marked = await rings(page);
  const labelled = (await nameBoxes(page)).map((b) => b.id);
  expect(marked.length, "rings at the inner planets").toBeGreaterThanOrEqual(3);
  for (const ring of marked) {
    expect(labelled, `${ring.id} has its name`).toContain(ring.id);
    expect(Math.abs(ring.x) + Math.abs(ring.y), `the ring of ${ring.id} is on the body`).toBeLessThanOrEqual(1.5);
  }
  expect(marked.map((r) => r.id), "the Sun is a speck at this size").toContain("sun");
});

test("the Moon is drawn at its true size beside the Earth in the compressed scale too: a quarter of it, not as big", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=compressed");
  await goTo(page, "Moon");
  const sizes = await page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { placeOf(id: string): { r: number } | null };
    return { earth: space.placeOf("earth")?.r ?? 0, moon: space.placeOf("moon")?.r ?? 0 };
  });
  expect(sizes.moon).toBeGreaterThan(0);
  expect(sizes.moon / sizes.earth, "the Moon is about 0.27 of the Earth").toBeLessThan(0.45);
});
