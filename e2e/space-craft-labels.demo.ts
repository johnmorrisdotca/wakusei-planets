// The names of the deep-space craft give way (MODULES-1535): with every craft on, no craft's name lies over a body's, or over another craft's; a keep-out rectangle the page gives is written under by no name; `labelShort` writes a craft short and
// leaves its full name for a screen reader; a favourite's name outlasts the others'. The layout itself is checked without a browser in test/space-craft-labels.test.ts.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, quiet, SPACE } from "./space-ui.ts";

interface Box {
  id: string;
  x: number;
  y: number;
  right: number;
  bottom: number;
  craft: boolean;
}

/** The names shown, in the element's own box coordinates. */
const shownNames = (page: Page): Promise<Box[]> =>
  page.locator(SPACE).evaluate((el) => {
    const root = el.shadowRoot!;
    const frame = el.getBoundingClientRect();
    const ids = new Set<string>(((el as unknown as { stats: { spacecraft?: { ids?: string[] } } }).stats.spacecraft?.ids ?? []) as string[]);
    return [...root.querySelectorAll<HTMLElement>(".sp-label")]
      .filter((label) => !label.hidden && !label.hasAttribute("data-carried") && label.getClientRects().length > 0)
      .map((label) => {
        const r = label.getBoundingClientRect();
        const id = label.dataset["body"]!;
        return { id, x: r.left - frame.left, y: r.top - frame.top, right: r.right - frame.left, bottom: r.bottom - frame.top, craft: ids.has(id) || label.hasAttribute("data-craft") };
      });
  });

const crosses = (a: Box, b: Box): boolean => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

for (const focus of ["sun", "earth", "jupiter"]) {
  test(`with every craft on, looking at ${focus}: no craft's name is over a body's name or over another craft's`, async ({ page }) => {
    test.setTimeout(240_000);
    await openSpace(page, "t=2026-06-21T12:00Z&play=off&craft=all&scale=compressed");
    await callOn(page, "goTo", focus, { smooth: false });
    await quiet(page);
    const names = await shownNames(page);
    const bodies = names.filter((n) => !n.craft);
    const craft = names.filter((n) => n.craft);
    expect(craft.length, "some craft names are shown").toBeGreaterThan(0);
    for (const c of craft) {
      for (const other of [...bodies, ...craft.filter((x) => x.id !== c.id)]) expect(crosses(c, other), `${c.id} over ${other.id}`).toBe(false);
    }
  });
}

test("a keep-out rectangle is never written under, and the dots stay", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-06-21T12:00Z&play=off&craft=all&scale=compressed");
  await callOn(page, "goTo", "sun", { smooth: false });
  await quiet(page);
  const box = (await page.locator(SPACE).boundingBox())!;
  const bar = { x: 0, y: Math.round(box.height - 60), w: Math.round(box.width), h: 60 };
  await page.locator(SPACE).evaluate((el, area) => Reflect.set(el, "keepOut", [area]), bar);
  await quiet(page);
  for (const n of await shownNames(page)) expect(n.bottom <= bar.y || n.y >= bar.y + bar.h, `${n.id} is under the bar`).toBe(true);
  expect(await page.locator(SPACE).evaluate((el) => (Reflect.get(el, "keepOut") as unknown[]).length)).toBe(1);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "keepOut", []));
});

test("labelShort writes a craft's label short, in the language shown, and the full name stays for a screen reader", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-06-21T12:00Z&play=off&craft=all&scale=compressed");
  await callOn(page, "goTo", "sun", { smooth: false });
  await quiet(page);
  const full = await page.locator(SPACE).locator('.sp-label[data-body="webb"]').evaluate((label) => ({ text: label.textContent, aria: label.getAttribute("aria-label") }));
  expect(full.text!.length).toBeGreaterThan(8);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "labelShort", { webb: { en: "Webb", ja: "ウェッブ" } }));
  const short = await page.locator(SPACE).locator('.sp-label[data-body="webb"]').evaluate((label) => ({ text: label.textContent, aria: label.getAttribute("aria-label") }));
  expect(short.text).toBe("Webb");
  expect(short.aria).toBe(full.aria);
  expect(short.aria).toContain(full.text!);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "labelShort", {}));
  expect(await page.locator(SPACE).locator('.sp-label[data-body="webb"]').evaluate((label) => label.textContent)).toBe(full.text);
});
