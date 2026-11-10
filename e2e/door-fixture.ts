// A source of small bodies made in the page, as the README shows a source of one's own: `count` bodies on one circle of 3 astronomical units, spread round it, in the ecliptic. Not a test file.
import type { Page } from "@playwright/test";

/** Adds the source to the element that matches `selector`, and keeps the count of times `records()` was called in `window.__rocks`. */
export async function addRocks(page: Page, selector: string, count: number): Promise<void> {
  await page.locator(selector).evaluate((el, n) => {
    const reads = { count: 0 };
    Reflect.set(window, "__rocks", reads);
    const source = {
      kind: "records",
      info: {
        id: "rocks",
        name: { en: "My rocks", ja: "私の小天体" },
        credit: { en: "Rocks: mine, A. Person (2026)", ja: "小天体：私の（A. Person、2026年）" },
        licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
        url: "https://example.org/rocks",
        retrieved: "2026-11-10",
      },
      records() {
        reads.count += 1;
        return Array.from({ length: n }, (_, k) => ({ name: `R${k}`, a: 3, e: 0, i: 0, node: 0, peri: 0, M0: (360 * k) / n, epoch: 2461000.5, H: 8 }));
      },
    };
    (el as unknown as { addSource(s: unknown): void }).addSource(source);
  }, count);
}
