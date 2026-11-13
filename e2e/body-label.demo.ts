// The name written on the body: `body-label` writes each body's name on its own globe, in the page's language, turning with the body or facing the reader, and nothing on a body
// too small on the screen. A picture test: the pixels inside the disc that the name changes. Chromium, drawing in software. Every wait is on what the page reports.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { callOn, drawn as drawnShared, openSpace, setOn, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Labels {
  count: number;
  focus: { shown: boolean; text: string; turn: number } | null;
}
const labels = async (page: Page): Promise<Labels> => ((await statsOf(page)) as unknown as { bodyLabels: Labels }).bodyLabels;
const shot = async (page: Page): Promise<string> => (await page.locator(SPACE).screenshot()).toString("base64");
/** Pictures for a look by a person: written when `BODY_LABEL_SHOTS` names a folder. */
const keep = (name: string, data: string): void => {
  const dir = process.env["BODY_LABEL_SHOTS"];
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.png`, Buffer.from(data, "base64"));
};

/** Do something, then wait until the view has drawn again and the name on the body looked at reads as wanted (the name is drawn once its font is in, which asks for one more draw: `drawn` waits for the draws to hold). */
const drawn = (page: Page, act: () => Promise<unknown>, wanted: (now: Labels) => boolean): Promise<void> => drawnShared(page, act, (stats) => wanted((stats as unknown as { bodyLabels: Labels }).bodyLabels));

/** How many pixels inside the disc of a body differ between two pictures of the view (by more than a fifth of the brightness range). */
async function changedInside(page: Page, id: string, a: string, b: string): Promise<number> {
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
  expect(place, `${id} is drawn`).not.toBeNull();
  return page.evaluate(
    async ({ pa, pb, p }) => {
      const read = async (data: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return { data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
      };
      const [x0, x1] = [await read(pa), await read(pb)];
      const ratio = x0.width / (document.querySelector("wakusei-space")?.clientWidth ?? x0.width);
      let n = 0;
      for (let y = Math.max(0, Math.floor((p.y - p.r) * ratio)); y < Math.min(x0.height, (p.y + p.r) * ratio); y += 1) {
        for (let x = Math.max(0, Math.floor((p.x - p.r) * ratio)); x < Math.min(x0.width, (p.x + p.r) * ratio); x += 1) {
          if (Math.hypot(x - p.x * ratio, y - p.y * ratio) > p.r * ratio * 0.9) continue;
          const i = (y * x0.width + x) * 4;
          const d = Math.abs(x0.data[i]! - x1.data[i]!) + Math.abs(x0.data[i + 1]! - x1.data[i + 1]!) + Math.abs(x0.data[i + 2]! - x1.data[i + 2]!);
          if (d > 150) n += 1;
        }
      }
      return n;
    },
    { pa: a, pb: b, p: place! },
  );
}

test("off by default; on, the Earth's name is drawn on its globe and changes the picture inside its disc; off again, the picture is as before", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&look=painted");
  expect(await labels(page), "no name on a body by default").toEqual({ count: 0, focus: null });
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyLabel")), "the property reads the attributes: none").toBeNull();
  const off = await shot(page);
  await drawn(page, () => page.locator(SPACE).evaluate((el) => el.setAttribute("body-label", "painted")), (now) => now.focus?.shown === true);
  const now = await labels(page);
  expect(now.focus?.text, "the Earth's name in capitals").toBe("EARTH");
  expect(await page.evaluate(() => [...document.fonts].some((face) => face.family.replace(/["']/g, "") === "Michroma" && face.status === "loaded")), "the name is written in Michroma, fetched once").toBe(true);
  expect(now.count).toBeGreaterThanOrEqual(1);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyLabel"))).toEqual({ look: "painted" });
  const on = await shot(page);
  keep("space-earth-painted", on);
  keep("space-earth-off", off);
  const changed = await changedInside(page, "earth", off, on);
  expect(changed, `the name changes ${changed} pixels inside the Earth's disc`).toBeGreaterThan(300);
  await drawn(page, () => setOn(page, "bodyLabel", null), (next) => next.focus === null);
  expect(await changedInside(page, "earth", off, await shot(page)), "off again, the picture is as before").toBeLessThan(40);
});

for (const look of ["etched", "outline", "burned"] as const) {
  test(`${look}: the look is drawn on Mars and reads back from the property`, async ({ page }) => {
    test.setTimeout(240_000);
    await openSpace(page, `t=2026-11-02T14:00Z&play=off&bl=${look}&blr=both&bls=1`);
    await drawn(page, () => callOn(page, "goTo", "mars", { smooth: false }), (now) => now.focus?.text === "MARS" && now.focus.shown);
    const on = await shot(page);
    keep(`space-mars-${look}`, on);
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyLabel"))).toEqual({ look, repeat: "both", strength: 1 });
    await drawn(page, () => setOn(page, "bodyLabel", null), (now) => now.focus === null);
    const changed = await changedInside(page, "mars", await shot(page), on);
    expect(changed, `${look} changes ${changed} pixels inside Mars's disc`).toBeGreaterThan(300);
  });
}

test("the name is in the page's language: 地球 in Japanese, and the fallback font is read from the attribute", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&bl=painted");
  await expect.poll(async () => (await labels(page)).focus?.shown, { timeout: 60_000 }).toBe(true);
  await drawn(page, () => page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja")), (now) => now.focus?.text === "地球");
  await page.locator(SPACE).evaluate((el) => el.setAttribute("body-label-fallback-font", "Noto Sans JP"));
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyLabel"))).toEqual({ look: "painted", fallbackFont: "Noto Sans JP" });
  keep("space-earth-ja", await shot(page));
});

test("facing: the name turns to the reader as the view turns; turning with the body it does not", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&bl=painted&blf=1");
  await expect.poll(async () => (await labels(page)).focus?.shown, { timeout: 60_000 }).toBe(true);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyLabel"))).toEqual({ look: "painted", facing: true });
  const at0 = (await labels(page)).focus!.turn;
  await drawn(page, () => callOn(page, "setView", { yaw: 90, tilt: 0, zoom: 1 }), (now) => now.focus !== null && Math.abs(now.focus.turn - at0) > 0.1);
  const at90 = (await labels(page)).focus!.turn;
  const turned = Math.abs(((at90 - at0 + Math.PI) % (2 * Math.PI)) - Math.PI);
  expect(turned, "a quarter turn of the view turns the name a quarter turn back").toBeGreaterThan(Math.PI / 2 - 0.15);
  expect(turned).toBeLessThan(Math.PI / 2 + 0.15);
  keep("space-earth-facing-90", await shot(page));
  await drawn(page, () => setOn(page, "bodyLabel", { look: "painted" }), (now) => now.focus !== null && now.focus.turn === 0);
  await drawn(page, () => callOn(page, "setView", { yaw: 0, tilt: 0, zoom: 1 }), (now) => now.focus !== null && now.focus.turn === 0);
});

test("a body too small on the screen carries no name: from the whole solar system none is drawn, and close to Phobos its name comes", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&bl=painted&scale=compressed");
  await expect.poll(async () => (await labels(page)).focus?.shown, { timeout: 60_000 }).toBe(true);
  await drawn(page, () => page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void; zoomFor(p: string): number }).setView({ yaw: 0, tilt: 0, zoom: (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system") })), (now) => now.count === 0);
  expect((await labels(page)).focus?.shown, "the Earth is a dot: no name on it").toBe(false);
  // Phobos keeps one face to Mars, and its prime meridian faces Mars: a name written once is often on its far side, so it is written on both sides here
  await drawn(page, () => setOn(page, "bodyLabel", { look: "painted", repeat: "both" }), (now) => now.count === 0);
  await drawn(page, () => callOn(page, "goTo", "phobos", { smooth: false }), (now) => now.focus?.text === "PHOBOS" && now.focus.shown);
  keep("space-phobos", await shot(page));
});

test("the body page: a name on Saturn through the row, kept in the address, and read back from the element", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/wakusei-planets/?body=saturn&bl=etched&bll=55");
  const main = page.locator("#main");
  await main.hover();
  await expect(main).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  const stats = () => main.evaluate((el) => (Reflect.get(el, "stats") as { label: { shown: boolean; text: string; turn: number; look: string } | null }).label);
  await expect.poll(stats, { timeout: 60_000 }).toEqual({ shown: true, text: "SATURN", turn: 0, look: "etched" }); // etched asked for, etched drawn: auto tone changes only a painted look (MODULES-983)
  expect(await main.evaluate((el) => Reflect.get(el, "bodyLabel"))).toEqual({ look: "etched", latitude: 55 });
  keep("body-saturn-etched-north", (await main.screenshot()).toString("base64"));
  await page.getByRole("group", { name: "Name on the body" }).getByRole("button", { name: "Off", exact: true }).dispatchEvent("click");
  await expect.poll(stats, { timeout: 30_000 }).toBeNull();
  // the address is written a moment after the choice
  await expect.poll(() => new URL(page.url()).searchParams.get("bl"), { timeout: 10_000 }).toBeNull();
  await page.getByRole("group", { name: "Name on the body" }).getByRole("button", { name: "Burned in", exact: true }).dispatchEvent("click");
  await expect.poll(async () => (await stats())?.shown, { timeout: 60_000 }).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get("bl"), { timeout: 10_000 }).toBe("burned");
});

test("while the Earth carries its drawn name its floating name and dot fade out; from afar they come back; labels-always keeps both", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&bl=painted");
  await expect.poll(async () => (await labels(page)).focus?.shown, { timeout: 60_000 }).toBe(true);
  const floating = page.locator(SPACE).locator('.sp-label[data-body="earth"]');
  const carried = () => floating.evaluate((el) => el.hasAttribute("data-carried"));
  const opacity = () => floating.evaluate((el) => getComputedStyle(el).opacity);
  await expect.poll(carried, { timeout: 30_000 }).toBe(true);
  await expect.poll(opacity, { timeout: 10_000 }).toBe("0");
  expect(await floating.evaluate((el) => el.getAttribute("aria-hidden"))).toBe("true");
  // the Sun is a dot far away: it carries no drawn name, so its floating name stays
  // (its name may be left out where a wider font crowds it: then there is no floating name to carry anything)
  expect(await page.locator(SPACE).locator('.sp-label[data-body="sun"]').evaluateAll((all) => all.some((el) => el.hasAttribute("data-carried")))).toBe(false);
  // from the whole solar system the Earth is a dot again: its floating name comes back
  await drawn(page, () => page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void; zoomFor(p: string): number }).setView({ yaw: 0, tilt: 0, zoom: (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system") })), (now) => now.count === 0);
  await expect.poll(carried, { timeout: 30_000 }).toBe(false);
  await expect.poll(opacity, { timeout: 10_000 }).toBe("1");
  // back at the Earth with labels-always: both are kept
  await page.locator(SPACE).evaluate((el) => el.setAttribute("labels-always", ""));
  await drawn(page, () => callOn(page, "setView", { yaw: 0, tilt: 0, zoom: 1 }), (now) => now.focus?.shown === true);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "labelsAlways"))).toBe(true);
  expect(await carried()).toBe(false);
  await page.locator(SPACE).evaluate((el) => el.removeAttribute("labels-always"));
  await expect.poll(carried, { timeout: 30_000 }).toBe(true);
});

/** How strongly the letters stand out inside a body's disc: the mean of the top 2 percent of the brightness changes (0 to 1) between the picture with the name and the picture without it. */
async function letterContrast(page: Page, id: string, plain: string, named: string): Promise<number> {
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
  expect(place, `${id} is drawn`).not.toBeNull();
  return page.evaluate(
    async ({ pa, pb, p }) => {
      const read = async (data: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return { data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
      };
      const [x0, x1] = [await read(pa), await read(pb)];
      const ratio = x0.width / (document.querySelector("wakusei-space")?.clientWidth ?? x0.width);
      const luma = (d: Uint8ClampedArray, i: number): number => (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255;
      const changes: number[] = [];
      for (let y = Math.max(0, Math.floor((p.y - p.r * 0.8) * ratio)); y < Math.min(x0.height, (p.y + p.r * 0.8) * ratio); y += 1) {
        for (let x = Math.max(0, Math.floor((p.x - p.r * 0.8) * ratio)); x < Math.min(x0.width, (p.x + p.r * 0.8) * ratio); x += 1) {
          if (Math.hypot(x - p.x * ratio, y - p.y * ratio) > p.r * ratio * 0.8) continue;
          const i = (y * x0.width + x) * 4;
          changes.push(Math.abs(luma(x0.data, i) - luma(x1.data, i)));
        }
      }
      changes.sort((a, b) => b - a);
      const top = changes.slice(0, Math.max(1, Math.floor(changes.length * 0.02)));
      return top.reduce((sum, v) => sum + v, 0) / top.length;
    },
    { pa: plain, pb: named, p: place! },
  );
}

// MODULES-983: the name reads on every body. Dark letters on the light bodies (Venus, Saturn, Uranus, Europa), pale ones on the dark; `tone` forces one. Strength 0.5, the name facing the reader, 30 degrees north.
test("the name reads on every body at strength 0.5: dark letters on Venus, Saturn, Uranus and Europa, pale on Mars, the Moon, the Earth and Neptune; a forced tone wins", async ({ page }) => {
  test.setTimeout(480_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&look=realistic&scale=true&light=lit");
  const base = { look: "painted", strength: 0.5, repeat: "once", facing: true, latitude: 30 };
  const looks = async (): Promise<string | undefined> => ((await statsOf(page)) as unknown as { bodyLabels: { focus: { look?: string } | null } }).bodyLabels.focus?.look;
  const measured: string[] = [];
  const low: string[] = [];
  for (const [id, tone] of [["uranus", "dark"], ["venus", "dark"], ["saturn", "dark"], ["europa", "dark"], ["mars", "light"], ["moon", "light"], ["earth", "light"], ["neptune", "light"]] as const) {
    await setOn(page, "bodyLabel", null);
    await drawnShared(page, () => callOn(page, "goTo", id, { smooth: false }));
    await page.waitForTimeout(600);
    const plain = await shot(page);
    const named = async (extra: object): Promise<string> => {
      await drawn(page, () => setOn(page, "bodyLabel", { ...base, ...extra }), (now) => now.focus?.shown === true);
      await page.waitForTimeout(400);
      return shot(page);
    };
    const auto = await named({});
    keep(`tone-${id}-auto`, auto);
    expect(await looks(), `${id}: the letters by default`).toBe(tone === "dark" ? "burned" : "painted");
    const pale = await named({ tone: "light" });
    expect(await looks(), `${id}: forced pale`).toBe("painted");
    const dark = await named({ tone: "dark" });
    expect(await looks(), `${id}: forced dark`).toBe("burned");
    const [byDefault, forcedPale, forcedDark] = [await letterContrast(page, id, plain, auto), await letterContrast(page, id, plain, pale), await letterContrast(page, id, plain, dark)];
    measured.push(`${id} ${byDefault.toFixed(3)} (pale ${forcedPale.toFixed(3)}, dark ${forcedDark.toFixed(3)})`);
    if (byDefault < 0.14) low.push(`${id}: ${byDefault.toFixed(3)}`);
    // the tone chosen reads at least as strongly as the other one on every body, and clearly more on the light ones
    expect(byDefault, `${id} by default is as strong as the better of the two (${measured.at(-1)})`).toBeGreaterThanOrEqual(Math.max(forcedPale, forcedDark) * 0.95);
    if (tone === "dark") expect(byDefault, `${id}: dark letters are clearly stronger than pale (${measured.at(-1)})`).toBeGreaterThan(forcedPale * 1.15);
  }
  // before (origin/main, one pale look for every body): Uranus 0.106; after: 0.147, and every other body 0.17 or more
  expect(low, measured.join("; ")).toEqual([]);
});
