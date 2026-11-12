// The places marked on a body: on <wakusei-body> and on the body <wakusei-space> looks at, each layer by itself, only on the near side, the name on hover, the place's record on a click,
// goToPlace bringing a place to the middle, the marks in the page's language, and nothing drawn by pointing at them. Chromium, drawing in software; every wait is on what the page reports.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { callOn, drawn, NOV2, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Shown = { id: string; layer: string; x: number; y: number }[];
const shown = (el: Locator): Promise<Shown> => el.evaluate((node) => [...(Reflect.get(node, "placesShown") as Shown)]);
/** Pictures for a look by a person: written when `PLACES_SHOTS` names a folder. */
const keep = async (page: Page, name: string, view?: Locator): Promise<void> => {
  const dir = process.env["PLACES_SHOTS"];
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await view?.scrollIntoViewIfNeeded();
  // a picture of what a reader sees: the body drawn, not a still being made again
  if (view !== undefined) await expect(view).toHaveAttribute("data-state", /still|live/, { timeout: 60_000 });
  await page.screenshot({ path: `${dir}/${name}.png` });
};

test("the body page marks the Moon's places by layer, only on the near side, and goToPlace brings one to the middle", async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/?body=moon&places=landing,crash,planned");
  const main = page.locator("#main");
  await expect.poll(async () => (await shown(main)).length, { timeout: 90_000 }).toBeGreaterThan(5);
  const first = await shown(main);
  expect(new Set(first.map((m) => m.layer))).toEqual(new Set(["landing", "crash", "planned"].filter((l) => first.some((m) => m.layer === l))));
  expect(first.every((m) => m.layer !== "feature")).toBe(true);
  // the layer buttons switch one layer at a time
  await page.getByRole("group", { name: "Places" }).getByRole("button", { name: "Features", exact: true }).click();
  await expect(main).toHaveAttribute("places", "landing crash planned feature");
  await expect.poll(async () => (await shown(main)).some((m) => m.layer === "feature"), { timeout: 30_000 }).toBe(true);
  await page.getByRole("group", { name: "Places" }).getByRole("button", { name: "Crashes", exact: true }).click();
  await expect.poll(async () => (await shown(main)).some((m) => m.layer === "crash"), { timeout: 30_000 }).toBe(false);
  await expect.poll(() => new URL(page.url()).searchParams.get("places")).toBe("landing,planned,feature");

  // Tranquility Base to the middle of the disc; the far side's Chang'e 4 is not marked then
  const place = await main.evaluate((el) => (el as unknown as { goToPlace(t: string, o: unknown): Promise<{ id: string } | undefined> }).goToPlace("Apollo 11 lunar module", { smooth: false }).then((p) => p?.id));
  expect(place).toBe("moon/apollo-11-lunar-module");
  const box = (await main.boundingBox())!;
  await expect
    .poll(async () => {
      const eagle = (await shown(main)).find((m) => m.id === "moon/apollo-11-lunar-module");
      return eagle === undefined ? Infinity : Math.hypot(eagle.x - box.width / 2, eagle.y - box.height / 2);
    }, { timeout: 30_000 })
    .toBeLessThan(3);
  expect((await shown(main)).some((m) => m.id === "moon/chang-e-4")).toBe(false);
  await keep(page, "body-desk-en", main);

  // the name on hover, measured in the page's font and inside the picture; a click hands the page the place's record
  const mark = main.locator('.wk-place[data-place="moon/apollo-11-lunar-module"]');
  await mark.hover();
  const tip = main.locator(".wk-place-tip");
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Apollo 11 lunar module");
  await expect(tip).toContainText("crewed landing, 1969");
  const tipBox = (await tip.boundingBox())!;
  expect(tipBox.x >= box.x - 1 && tipBox.x + tipBox.width <= box.x + box.width + 1).toBe(true);
  const picked = main.evaluate((el) => new Promise<string>((resolve) => el.addEventListener("wakusei-place", (e) => resolve((e as CustomEvent<{ place: { id: string }; body: string }>).detail.body + " " + (e as CustomEvent<{ place: { id: string } }>).detail.place.id), { once: true })));
  await mark.click();
  expect(await picked).toBe("moon moon/apollo-11-lunar-module");
  await expect(page.locator("#place-picked")).toContainText("Apollo 11 lunar module");
  await expect(page.locator("#place-credit")).toContainText("data from GCAT (J. McDowell, planet4589.org/space/gcat)");

  // live, the turn to a place moves at a pace you can follow and ends with the place in the middle
  await main.hover();
  await expect(main).toHaveAttribute("data-state", "live", { timeout: 60_000 });
  await main.evaluate((el) => (el as unknown as { goToPlace(t: string): Promise<unknown> }).goToPlace("Apollo 17 lunar module"));
  await expect
    .poll(async () => {
      const at = (await shown(main)).find((m) => m.id === "moon/apollo-17-lunar-module");
      return at === undefined ? Infinity : Math.hypot(at.x - box.width / 2, at.y - box.height / 2);
    }, { timeout: 30_000 })
    .toBeLessThan(3);

  // in Japanese the marks say so
  await main.evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(mark).toHaveAttribute("aria-label", "アポロ11号 月着陸船, 有人着陸、1969年");
  // a body with no places, and the line look, carry no marks
  await main.evaluate((el) => el.setAttribute("look", "line"));
  await expect.poll(async () => (await shown(main)).length).toBe(0);
});

test("the space view marks the body it looks at, goToPlace puts the camera over a place on Mars, and pointing at the marks draws nothing", async ({ page }) => {
  await openSpace(page, `t=${NOV2}&places=landing,crash,planned,feature`);
  const space = page.locator(SPACE);
  await drawn(page, () => callOn(page, "goToPlace", "mars/perseverance", { body: "mars", smooth: false }));
  await expect.poll(async () => (await shown(space)).length, { timeout: 60_000 }).toBeGreaterThan(5);
  const box = (await space.boundingBox())!;
  const percy = (await shown(space)).find((m) => m.id === "mars/perseverance");
  expect(percy, "Perseverance is marked").toBeDefined();
  expect(Math.hypot(percy!.x - box.width / 2, percy!.y - box.height / 2)).toBeLessThan(box.height * 0.02);
  // Olympus Mons is about 140 degrees round from Jezero: on the far side, not marked
  expect((await shown(space)).some((m) => m.id === "mars/olympus-mons")).toBe(false);
  await keep(page, "space-desk-en", space);

  const before = (await readCounts(page)).draws;
  for (const m of (await shown(space)).slice(0, 8)) await page.mouse.move(box.x + m.x, box.y + m.y, { steps: 3 });
  await expect(space.locator(".wk-place-tip")).toBeVisible();
  await page.mouse.move(box.x + 4, box.y + box.height - 4);
  await expect(space.locator(".wk-place-tip")).toBeHidden();
  expect((await readCounts(page)).draws - before, "no draw from pointing at marks").toBe(0);

  // Olympus Mons by the page's own button: the view turns there and the mark is in the middle
  // (the button is below the view, and a view out of sight draws nothing: it is brought back into sight to finish the turn)
  await page.getByRole("group", { name: "Go to a place" }).getByRole("button", { name: "Olympus Mons", exact: true }).click();
  await space.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => {
      const olympus = (await shown(space)).find((m) => m.id === "mars/olympus-mons");
      return olympus === undefined ? Infinity : Math.hypot(olympus.x - box.width / 2, olympus.y - box.height / 2);
    }, { timeout: 60_000 })
    .toBeLessThan(box.height * 0.02);

  // the phone, in Japanese, for a look by a person
  if (process.env["PLACES_SHOTS"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await space.evaluate((el) => el.setAttribute("lang", "ja"));
    await drawn(page, () => callOn(page, "goToPlace", "mars/perseverance", { body: "mars", smooth: false }));
    await space.locator('.wk-place[data-place="mars/perseverance"]').hover();
    await keep(page, "space-phone-ja", space);
  }
});

test("pictures for a look by a person: the body page on a phone and in Japanese", async ({ page }) => {
  test.skip(!process.env["PLACES_SHOTS"], "only when PLACES_SHOTS names a folder");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/wakusei-planets/?body=mars&look=painted&places=landing,crash,planned,feature&lang=ja");
  const main = page.locator("#main");
  await expect.poll(async () => (await shown(main)).length, { timeout: 90_000 }).toBeGreaterThan(3);
  await main.evaluate((el) => (el as unknown as { goToPlace(t: string, o: unknown): Promise<unknown> }).goToPlace("Perseverance", { smooth: false }));
  await expect.poll(async () => (await shown(main)).some((m) => m.id === "mars/perseverance"), { timeout: 30_000 }).toBe(true);
  await main.locator('.wk-place[data-place="mars/perseverance"]').hover();
  await keep(page, "body-phone-ja", main);
  await page.setViewportSize({ width: 1280, height: 900 });
  await main.evaluate((el) => el.setAttribute("lang", "en"));
  await main.evaluate((el) => (el as unknown as { goToPlace(t: string, o: unknown): Promise<unknown> }).goToPlace("Olympus Mons", { smooth: false }));
  await expect.poll(async () => (await shown(main)).some((m) => m.id === "mars/olympus-mons"), { timeout: 30_000 }).toBe(true);
  await keep(page, "body-desk-en-mars", main);
});
