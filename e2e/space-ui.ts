// The space page's controls as a person uses them, and the readings the space tests share: a click that does not scroll the page (a view scrolled out of sight is rightly not drawn).
import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Locator, type Page } from "@playwright/test";
import "./load.ts";

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
/**
 * Waits until the draws have held still for four reads in a row, 250 ms apart (a frame on a slow runner takes longer than one quiet read), in place of a fixed sleep for the view to settle. Nothing arriving late
 * (a picture, a tile, a table) shows as a draw, so the count holding still means it has all come.
 */
export async function quiet(page: Page, timeout = 60_000): Promise<void> {
  let held = 0;
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = (await readCounts(page)).draws;
        held = now === last ? held + 1 : 0;
        last = now;
        return held;
      },
      { timeout, intervals: [250], message: "the draws held still" },
    )
    .toBeGreaterThanOrEqual(4);
}
/** Dispatch a click on a button and say how many draws the space view had made (its own count, `stats.draws`, the one `drawnAfter` waits on), in the one call: no draw can land between the count and the click and be taken for the click's. */
export const clickCounted = (button: Locator): Promise<number> =>
  button.evaluate((el) => {
    const before = Number((Reflect.get(document.querySelector("wakusei-space")!, "stats") as { draws: number }).draws);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
    return before;
  });
export const setOn = (page: Page, key: string, value: unknown) => page.locator(SPACE).evaluate((el, [k, v]) => Reflect.set(el, k as string, v), [key, value] as const);
/** Call a method of the element with arguments. */
export const callOn = (page: Page, method: string, ...args: unknown[]) => page.locator(SPACE).evaluate((el, [m, a]) => (Reflect.get(el, m as string) as (...x: unknown[]) => unknown).apply(el, a as unknown[]), [method, args] as const);

/** Set a property of the element and say how many draws had been made, in the one call (see `clickCounted`). */
export const setCounted = (page: Page, key: string, value: unknown): Promise<number> =>
  page.locator(SPACE).evaluate((el, [k, v]) => {
    const before = Number((Reflect.get(el, "stats") as { draws: number }).draws);
    Reflect.set(el, k as string, v);
    return before;
  }, [key, value] as const);
/** Call a method of the element and say how many draws had been made, in the one call (see `clickCounted`). */
export const callCounted = (page: Page, method: string, ...args: unknown[]): Promise<number> =>
  page.locator(SPACE).evaluate((el, [m, a]) => {
    const before = Number((Reflect.get(el, "stats") as { draws: number }).draws);
    (Reflect.get(el, m as string) as (...x: unknown[]) => unknown).apply(el, a as unknown[]);
    return before;
  }, [method, args] as const);
/** Wait until a draw has come after `before` (a count taken in the same call as the change, by `setCounted`, `callCounted` or `clickCounted`). */
export const drawnAfter = (page: Page, before: number, what = "the change") => expect.poll(async () => (await statsOf(page)).draws, { timeout: 60_000, message: `a draw came after ${what}` }).toBeGreaterThan(before);

/** Open the space page and wait for its first picture. */
export async function openSpace(page: Page, query = `t=${NOV2}`): Promise<void> {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`/wakusei-planets/space.html?${query}`);
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  await expect.poll(async () => (await statsOf(page)).draws, { timeout: 60_000, message: "the first draw" }).toBeGreaterThan(0);
  // a view whose clock runs draws every frame and never holds still: it has its first draw, and that is all there is to wait for
  const running = await page.locator(SPACE).evaluate((el) => Number(Reflect.get(el, "speed")) !== 0);
  if (!running) await quiet(page);
}

/** Press a "Go to" button of the page, then wait until the frame that shows it has drawn. */
export async function goTo(page: Page, name: string): Promise<void> {
  const before = await clickCounted(page.getByRole("group", { name: "Go to" }).getByRole("button", { name, exact: true }));
  await drawnAfter(page, before, `the press on ${name}`);
  await quiet(page);
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

/**
 * Do something that changes the picture, then wait until the view has drawn it (the draws the renderer counts went up) and the draws hold again (two reads apart with no new draw);
 * with `until`, also until what the page reports satisfies it. Every wait is on what the page reports, never on the clock alone.
 */
export async function drawn(page: Page, act: () => Promise<unknown>, until?: (stats: Stats) => boolean): Promise<void> {
  const before = (await readCounts(page)).draws;
  await act();
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
  if (until) await expect.poll(async () => until(await statsOf(page)), { timeout: 60_000 }).toBe(true);
  await quiet(page);
}

/**
 * `drawn` for a view at rest: it waits for the draws to hold still first, so that nothing still arriving (a picture, a tile) can land between the count and the change and be taken for the change's draw. Not for a view
 * whose clock runs, which never holds still.
 */
export async function drawnAtRest(page: Page, act: () => Promise<unknown>, until?: (stats: Stats) => boolean): Promise<void> {
  await quiet(page);
  await drawn(page, act, until);
}

/** A picture of the view, as a base64 PNG. */
export const shot = async (page: Page): Promise<string> => (await page.locator(SPACE).screenshot()).toString("base64");

/** A picture of the view with where a body is in it, so two pictures can be compared disc to disc wherever the body sits in each. */
export async function pictureOf(page: Page, id: string): Promise<{ data: string; x: number; y: number; r: number }> {
  const data = await shot(page);
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
  expect(place, `${id} is drawn`).not.toBeNull();
  return { data, ...place! };
}

/** How many pixels inside the disc of a body (at its place now) differ between two pictures of the view, by more than `threshold` of summed channel difference. */
export async function changedInside(page: Page, id: string, a: string, b: string, threshold = 150, share = 0.9): Promise<number> {
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
  expect(place, `${id} is drawn`).not.toBeNull();
  return changedBetween(page, { data: a, ...place! }, { data: b, ...place! }, threshold, share);
}

/** How many pixels of a body's disc differ between two pictures, each disc taken at its own place (the smaller radius of the two, times `share`). */
export async function changedBetween(page: Page, a: { data: string; x: number; y: number; r: number }, b: { data: string; x: number; y: number; r: number }, threshold = 60, share = 0.8): Promise<number> {
  return page.evaluate(
    async ({ pa, pb, threshold: limit, share: part }) => {
      const read = async (data: string): Promise<{ px: Uint8ClampedArray; width: number; height: number }> => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return { px: context.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
      };
      const [x, y] = [await read(pa.data), await read(pb.data)];
      const ratio = x.width / (document.querySelector("wakusei-space")?.clientWidth ?? x.width);
      const r = Math.min(pa.r, pb.r) * ratio * part;
      const [ax, ay, bx, by] = [pa.x * ratio, pa.y * ratio, pb.x * ratio, pb.y * ratio];
      let n = 0;
      for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.hypot(dx, dy) > r) continue;
          const [i, j, k, l] = [Math.round(ax + dx), Math.round(ay + dy), Math.round(bx + dx), Math.round(by + dy)];
          if (i < 0 || j < 0 || k < 0 || l < 0 || i >= x.width || k >= y.width || j >= x.height || l >= y.height) continue;
          const p = (j * x.width + i) * 4;
          const q = (l * y.width + k) * 4;
          if (Math.abs(x.px[p]! - y.px[q]!) + Math.abs(x.px[p + 1]! - y.px[q + 1]!) + Math.abs(x.px[p + 2]! - y.px[q + 2]!) > limit) n += 1;
        }
      }
      return n;
    },
    { pa: a, pb: b, threshold, share },
  );
}
