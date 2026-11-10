// The space page's controls as a person uses them, and the readings the space tests share: a click that does not scroll the page (a view scrolled out of sight is rightly not drawn).
import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page } from "@playwright/test";

export const setLight = (page: Page, name: "The Sun's" | "Always lit") => page.getByRole("group", { name: "Light" }).getByRole("button", { name, exact: true }).dispatchEvent("click");

export const SPACE = "wakusei-space";
export const NOV2 = "2026-11-02T14:00Z";

export interface Stats {
  state: string;
  draws: number;
  contexts: number;
  canvas: { width: number; height: number; pixels: number };
  distance: number;
  time: number;
  lookups: number;
  camera: { position: [number, number, number]; fov: number };
  bodies: { look: string; painted: number; moons: number };
}
export const statsOf = (page: Page): Promise<Stats> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "stats") as Stats);
export const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);
export const setOn = (page: Page, key: string, value: unknown) => page.locator(SPACE).evaluate((el, [k, v]) => Reflect.set(el, k as string, v), [key, value] as const);
/** Call a method of the element with arguments. */
export const callOn = (page: Page, method: string, ...args: unknown[]) => page.locator(SPACE).evaluate((el, [m, a]) => (Reflect.get(el, m as string) as (...x: unknown[]) => unknown).apply(el, a as unknown[]), [method, args] as const);

/** Open the space page and wait for its first picture. */
export async function openSpace(page: Page, query = `t=${NOV2}`): Promise<void> {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`/wakusei-planets/space.html?${query}`);
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  await expect.poll(async () => (await statsOf(page)).draws).toBeGreaterThan(0);
  await settle(page);
}

/** Press a "Go to" button of the page, then wait until the frame that shows it has drawn. */
export async function goTo(page: Page, name: string): Promise<void> {
  const before = (await readCounts(page)).draws;
  await page.getByRole("group", { name: "Go to" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
  await settle(page, 400);
}

export interface Box {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}
/** The boxes on the screen, in CSS pixels, of the names the view shows now. */
export const nameBoxes = (page: Page): Promise<Box[]> =>
  page.locator(SPACE).evaluate((el) =>
    [...el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-label:not([hidden])")].map((n) => {
      const r = n.getBoundingClientRect();
      return { id: n.dataset["body"]!, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  );
/** Pairs of names whose boxes cross. */
export const crossing = (boxes: Box[]): string[] => {
  const out: string[] = [];
  for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`${a.id} and ${b.id}`);
  return out;
};
