// The orbit lines of the space view fade as more of them crowd the screen and as the view goes out, and a line under the pointer is lit in full and names its body; a press on one follows the click rules
// (the first selects and the camera stays, the second goes there, Ctrl or Command goes there at once). Lighting a line is the view's own layer and draws nothing. Chromium, drawing in software.
import "./load.ts";
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { openSpace, quiet, SPACE, setOn, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const fadeOf = async (page: Page): Promise<{ crowd: number; outness: number; opacity: number }> => ((await statsOf(page)) as unknown as { orbits: { fade: { crowd: number; outness: number; opacity: number } } }).orbits.fade;
const bodyOf = (page: Page): Promise<string> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body") as string);
const selectedOf = (page: Page): Promise<string | null> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "selected") as string | null);
/** What the lit line shows: whether it is up, the name beside the pointer and the colour of its path. */
const lit = (page: Page): Promise<{ up: boolean; name: string; stroke: string | null; points: number }> =>
  page.locator(SPACE).evaluate((el) => {
    const layer = el.shadowRoot!.querySelector(".sp-line")!;
    const name = el.shadowRoot!.querySelector<HTMLElement>(".sp-linename")!;
    const path = layer.querySelector("path")!;
    return { up: !layer.hasAttribute("hidden") && !name.hidden, name: name.textContent ?? "", stroke: path.getAttribute("stroke"), points: (path.getAttribute("d") ?? "").split(/[ML]/).length - 1 };
  });

/**
 * Go to a body and set a zoom, then wait for the draws to hold. `zoomFor` gives the zoom that shows a preset when the Earth is looked at; `times` carries it to another body (the Sun's radius is 109 times the Earth's,
 * and the camera stands off by a number of the body's radii), so that the Sun is held still in the middle with the inner planets going round it.
 */
async function look(page: Page, body: string, preset: string, times = 1): Promise<void> {
  await page.locator(SPACE).evaluate(
    (el, [id, name, k]) => {
      const space = el as unknown as { goTo(id: string, o: unknown): boolean; zoomFor(n: string): number };
      space.goTo(id as string, { smooth: false });
      // through the page's bar, which holds the zoom, so that a press afterwards does not put the old one back
      const bar = document.querySelector("kazoku-view-controls") as unknown as { controller: { set(v: unknown, notify: boolean, how: string): void } };
      bar.controller.set({ yaw: 0, tilt: 0, zoom: space.zoomFor(name as string) * (k as number) }, true, "jump");
    },
    [body, preset, times] as const,
  );
  await quiet(page);
}
const SUN_IN_EARTHS = 109.2;

/**
 * A point on the orbit line of a body, found by the view's own answer: the pointer is moved over the picture in a grid and the places where the line named for the body is lit are kept; the one farthest from every body and
 * every name is the answer (a press or a hover there is on the line, not on a body). The pointer is then taken off the view.
 */
async function onLineOf(page: Page, name: string): Promise<{ x: number; y: number }> {
  const found = await page.locator(SPACE).evaluate((el, wanted) => {
    const box = el.getBoundingClientRect();
    const space = el as unknown as { placeOf(id: string): { x: number; y: number } | null; bodyList(): { id: string }[] };
    const bodies = space.bodyList().map(({ id }) => space.placeOf(id)).filter((p): p is { x: number; y: number } => p !== null);
    const names = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-label:not([hidden])")].map((n) => n.getBoundingClientRect());
    let best: { x: number; y: number; clear: number } | null = null;
    for (let y = 10; y < box.height - 10; y += 4) {
      for (let x = 10; x < box.width - 10; x += 4) {
        el.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + x, clientY: box.top + y, pointerType: "mouse", buttons: 0, bubbles: true, composed: true }));
        if (el.shadowRoot!.querySelector(".sp-line")!.hasAttribute("hidden") || el.shadowRoot!.querySelector(".sp-linename")!.textContent !== wanted) continue;
        const fromBody = Math.min(...bodies.map((p) => Math.hypot(p.x - x, p.y - y)));
        const fromName = Math.min(...names.map((n) => Math.hypot(Math.max(n.left - box.left - x, 0, x - (n.right - box.left)), Math.max(n.top - box.top - y, 0, y - (n.bottom - box.top)))));
        const clear = Math.min(fromBody, fromName);
        if (best === null || clear > best.clear) best = { x, y, clear };
      }
    }
    el.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse", bubbles: false, composed: true }));
    return best;
  }, name);
  expect(found, `${name}'s line is on the picture`).not.toBeNull();
  expect(found!.clear, `a place on ${name}'s line well clear of the bodies and names`).toBeGreaterThan(25);
  return { x: found!.x, y: found!.y };
}

test("the lines fade as more of them are drawn and as the view goes out, and never away", async ({ page }) => {
  test.setTimeout(300_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&moons=all");
  await setOn(page, "orbits", true);
  await look(page, "earth", "earth");
  const near = await fadeOf(page);
  expect(near.outness, "close to the Earth, near").toBe(0);
  expect(near.crowd, "two lines in the picture, the Earth's and the Moon's").toBeLessThanOrEqual(3);
  expect(near.opacity, "a few lines in a near view: the line's own opacity").toBeCloseTo(0.55, 5);
  await look(page, "moon", "moon");
  const moon = await fadeOf(page);
  expect(moon.outness, "the Earth and the Moon, a little out").toBeGreaterThan(0);
  expect(moon.outness).toBeLessThan(1);
  await look(page, "earth", "inner");
  const inner = await fadeOf(page);
  expect(inner.outness, "the inner system from the Earth, far out").toBe(1);
  expect(inner.crowd, "the lines of the inner system are in the picture").toBeGreaterThan(near.crowd);
  expect(inner.opacity, "farther out, fainter").toBeLessThan(near.opacity);
  expect(inner.opacity, "but never gone").toBeGreaterThan(0.55 * 0.1);
  // Saturn showing every moon: the catalogue's 293 orbits crowd the screen, and every line is fainter for it
  await look(page, "saturn", "saturn-moons");
  const crowded = await fadeOf(page);
  expect(crowded.crowd, "Saturn's catalogue moons are counted").toBeGreaterThan(100);
  expect(crowded.opacity, "a crowd is fainter than a few lines").toBeLessThan(near.opacity / 2);
  expect(crowded.opacity, "but never gone").toBeGreaterThan(0.55 * 0.1);
});

test("a line under the pointer is lit in full with the name of its body, and goes when the pointer does, with nothing drawn", async ({ page }) => {
  test.setTimeout(300_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  await setOn(page, "orbits", true);
  await look(page, "sun", "inner", SUN_IN_EARTHS);
  const at = await onLineOf(page, "Mars");
  await quiet(page);
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__hover", []);
    el.addEventListener("wakusei-body-hover", (e) => (Reflect.get(window, "__hover") as string[]).push((e as CustomEvent<{ id: string }>).detail.id));
    el.addEventListener("wakusei-body-hover-end", (e) => (Reflect.get(window, "__hover") as string[]).push(`end:${(e as CustomEvent<{ id: string }>).detail.id}`));
  });
  expect((await lit(page)).up, "nothing is lit before the pointer comes").toBe(false);
  const before = await readCounts(page);
  await page.mouse.move(box.x + at.x - 40, box.y + at.y + 40);
  await page.mouse.move(box.x + at.x, box.y + at.y, { steps: 6 });
  const on = await lit(page);
  expect(on.up, "the line is lit").toBe(true);
  expect(on.name, "with the name of its body").toBe("Mars");
  expect(on.stroke).toMatch(/^#[0-9a-f]{6}$/);
  expect(on.points, "its whole path").toBeGreaterThan(50);
  expect(await page.evaluate(() => Reflect.get(window, "__hover") as string[]), "the page is told the body").toContain("mars");
  expect((await lit(page)).name).toBe("Mars");
  await page.mouse.move(box.x + 6, box.y + box.height - 6, { steps: 8 });
  expect((await lit(page)).up, "gone with the pointer").toBe(false);
  const told = await page.evaluate(() => Reflect.get(window, "__hover") as string[]);
  expect(told.at(-1), "and that it has gone").toMatch(/^end:/);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "lighting a line draws nothing").toBe(0);
  expect(after.rafRequests - before.rafRequests, "and asks for no frame").toBe(0);
  expect(after.contexts).toBe(1);
});

test("a press on a line follows the click rules: the first selects and the camera stays, the second goes there, and Ctrl goes there at once", async ({ page }) => {
  test.setTimeout(300_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  await setOn(page, "orbits", true);
  await look(page, "sun", "inner", SUN_IN_EARTHS);
  const mars = await onLineOf(page, "Mars");
  const venus = await onLineOf(page, "Venus");
  await quiet(page);
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__select", []);
    Reflect.set(window, "__click", []);
    el.addEventListener("wakusei-body-select", (e) => (Reflect.get(window, "__select") as string[]).push((e as CustomEvent<{ id: string }>).detail.id));
    el.addEventListener("wakusei-body-click", (e) => (Reflect.get(window, "__click") as string[]).push((e as CustomEvent<{ id: string }>).detail.id));
  });
  // the first press selects, for the page's card; the camera stays where it is
  await page.mouse.click(box.x + mars.x, box.y + mars.y);
  expect(await page.evaluate(() => Reflect.get(window, "__select") as string[])).toEqual(["mars"]);
  expect(await selectedOf(page)).toBe("mars");
  expect(await bodyOf(page), "the camera stays").toBe("sun");
  // the second goes there
  await page.mouse.click(box.x + mars.x, box.y + mars.y);
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("mars");
  expect(await page.evaluate(() => Reflect.get(window, "__click") as string[])).toEqual(["mars", "mars"]);
  // Ctrl on a line of a body not selected: selected and there, in the same breath, with no glide
  await look(page, "sun", "inner", SUN_IN_EARTHS);
  const again = await onLineOf(page, "Venus");
  expect(Math.hypot(again.x - venus.x, again.y - venus.y), "the same picture as before").toBeLessThan(2);
  await page.locator(SPACE).click({ position: { x: venus.x, y: venus.y }, modifiers: ["Control"] });
  expect(await bodyOf(page), "gone at once").toBe("venus");
  expect(await selectedOf(page)).toBe("venus");
  expect(((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding, "with no glide").toBe(false);
  expect(await page.evaluate(() => Reflect.get(window, "__select") as string[])).toEqual(["mars", "venus"]);
});

test("a press on empty sky, away from every line, selects nothing", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  await setOn(page, "orbits", true);
  await look(page, "sun", "inner", SUN_IN_EARTHS);
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.mouse.click(box.x + 3, box.y + box.height - 3);
  expect(await selectedOf(page), "only the sun, which the view went to").toBe("sun");
});

test("with the orbits off no line is lit or pressed", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  await look(page, "sun", "inner", SUN_IN_EARTHS);
  const at = await onLineOf(page, "Mars");
  await setOn(page, "orbits", false);
  await quiet(page);
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.mouse.move(box.x + at.x - 30, box.y + at.y + 30);
  await page.mouse.move(box.x + at.x, box.y + at.y, { steps: 4 });
  expect((await lit(page)).up).toBe(false);
  await page.mouse.click(box.x + at.x, box.y + at.y);
  expect(await selectedOf(page), "only the sun, which the view went to").toBe("sun");
});

test("Saturn's catalogue moons' lines are lit by the moon, named, and one pointer move over 293 orbits is quick", async ({ page }) => {
  test.setTimeout(300_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&moons=all");
  await look(page, "saturn", "saturn-moons");
  await expect.poll(async () => (((await statsOf(page)) as unknown as { allMoons: { loaded: boolean; orbits: number } }).allMoons.orbits), { timeout: 60_000 }).toBeGreaterThan(200);
  await quiet(page);
  const result = await page.locator(SPACE).evaluate((el) => {
    const box = el.getBoundingClientRect();
    const seen = new Set<string>();
    const names = new Map<string, string>();
    const times: number[] = [];
    const shadow = el.shadowRoot!;
    for (let y = 8; y < box.height - 8; y += 5) {
      for (let x = 8; x < box.width - 8; x += 9) {
        const began = performance.now();
        el.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + x, clientY: box.top + y, pointerType: "mouse", buttons: 0, bubbles: true, composed: true }));
        times.push(performance.now() - began);
        const layer = shadow.querySelector(".sp-line")!;
        if (!layer.hasAttribute("hidden")) {
          const text = shadow.querySelector(".sp-linename")!.textContent ?? "";
          seen.add(text);
          if (!names.has(text)) names.set(text, layer.querySelector("path")!.getAttribute("stroke") ?? "");
        }
      }
    }
    times.sort((a, b) => a - b);
    return { moves: times.length, median: times[Math.floor(times.length / 2)]!, p95: times[Math.floor(times.length * 0.95)]!, max: times[times.length - 1]!, seen: [...seen], strokes: [...names.values()] };
  });
  console.log(`pointer move over Saturn's 293 catalogue orbits: ${result.moves} moves, median ${result.median.toFixed(2)} ms, 95th ${result.p95.toFixed(2)} ms, max ${result.max.toFixed(2)} ms; ${result.seen.length} lines named`);
  expect(result.seen.length, "the moons' lines under the pointer are named").toBeGreaterThan(3);
  expect(new Set(result.strokes).size, "each in its own group's colour").toBeGreaterThan(1);
  expect(result.median, "a pointer move is quick").toBeLessThan(15);
});
