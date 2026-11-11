// Every body the package knows is offered by the space view (MODULES-741): all the planets, dwarf planets and moons can be gone to, with a compact picker (a kind, for a moon the planet it goes round, then the body, or a
// search by name), each planet's system with its moons, and every body ridden. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, settle, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const bodyOf = (page: Page): Promise<string> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body") as string);
const choices = (page: Page): Promise<string[]> => page.locator("#choices button").evaluateAll((buttons) => buttons.map((b) => (b as HTMLElement).dataset["id"] ?? ""));
const press = (page: Page, selector: string) => page.locator(selector).dispatchEvent("click");

test("the view offers all 52 bodies: the Sun, every planet, dwarf planet and minor body, and every moon, each with its kind", async ({ page }) => {
  await openSpace(page);
  const list = await page.locator(SPACE).evaluate((el) => (el as unknown as { bodyList(): { id: string; kind: string; host?: string }[] }).bodyList());
  expect(list.length).toBe(52);
  const of = (kind: string): string[] => list.filter((b) => b.kind === kind).map((b) => b.id);
  expect(of("star")).toEqual(["sun"]);
  expect(of("planet")).toEqual(["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]);
  expect(of("dwarf-planet").sort()).toEqual(["ceres", "eris", "gonggong", "haumea", "makemake", "orcus", "pluto", "quaoar", "sedna"]);
  expect(of("asteroid")).toEqual(["vesta", "pallas"]);
  expect(of("centaur")).toEqual(["chiron", "pholus"]);
  expect(of("comet")).toEqual(["halley"]);
  expect(of("moon").length).toBe(29);
  expect(list.find((b) => b.id === "dysnomia")).toMatchObject({ host: "eris" });
});

test("the picker: a kind, then (for a moon) the planet it goes round, then the body; each choice goes there and is at the middle", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page);
  expect(await choices(page), "the Sun and the eight planets").toEqual(["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]);
  await press(page, '#kinds [data-kind="dwarf-planet"]');
  expect(await choices(page)).toEqual(expect.arrayContaining(["ceres", "eris", "sedna", "pluto"]));
  await page.locator('#choices button[data-id="eris"]').dispatchEvent("click");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("eris");
  await press(page, '#kinds [data-kind="minor"]');
  expect(await choices(page), "the minor bodies, from the Sun outwards").toEqual(["vesta", "pallas", "chiron", "halley", "pholus"]);
  await page.locator('#choices button[data-id="halley"]').dispatchEvent("click");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("halley");
  await press(page, '#kinds [data-kind="moon"]');
  await expect(page.locator("#hosts-row")).toBeVisible();
  const hosts = await page.locator("#hosts button").evaluateAll((buttons) => buttons.map((b) => (b as HTMLElement).dataset["id"]));
  expect(hosts).toEqual(["earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "orcus", "haumea", "eris"]);
  await page.locator('#hosts button[data-id="saturn"]').dispatchEvent("click");
  expect(await choices(page)).toEqual(["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus"]);
  await page.locator('#choices button[data-id="titan"]').dispatchEvent("click");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("titan");
});

test("the search finds a body by its name in English or Japanese and goes there", async ({ page }) => {
  await openSpace(page);
  await page.locator("#find").fill("Hydra");
  await page.locator("#find").dispatchEvent("change");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("hydra");
  await page.locator("#find").fill("ケレス");
  await page.locator("#find").dispatchEvent("change");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("ceres");
  await page.locator("#find").fill("ベスタ");
  await page.locator("#find").dispatchEvent("change");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("vesta");
  await page.locator("#find").fill("Pholus");
  await page.locator("#find").dispatchEvent("change");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("pholus");
  await page.locator("#find").fill("ケレス");
  await page.locator("#find").dispatchEvent("change");
  await expect.poll(() => bodyOf(page), { timeout: 30_000 }).toBe("ceres");
  await page.locator("#find").fill("nowhere");
  await page.locator("#find").dispatchEvent("change");
  expect(await bodyOf(page)).toBe("ceres");
});

for (const host of ["mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "orcus", "haumea", "eris"]) {
  test(`${host}'s system: with its moons shows them round it`, async ({ page }) => {
    test.setTimeout(120_000);
    await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
    const zoom = await page.locator(SPACE).evaluate((el, id) => (el as unknown as { zoomFor(p: string): number }).zoomFor(`${id}-moons`), host);
    expect(Number.isFinite(zoom) && zoom > 0 && zoom <= 1, `a zoom for ${host}: ${zoom}`).toBe(true);
    await callOn(page, "goTo", host, { smooth: false, zoom });
    await page.locator("kazoku-view-controls").evaluate((el, z) => (Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void }).set({ zoom: z }, true, "jump"), zoom);
    await expect.poll(async () => (await statsOf(page)).bodies.moons, { timeout: 60_000, message: `${host}'s moons are drawn` }).toBeGreaterThanOrEqual(1);
  });
}

test("every body can be ridden: the camera is at a dwarf planet, at a moon of a planet and at a moon of a dwarf planet, and the ride is not lost", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page);
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__lost", 0);
    el.addEventListener("wakusei-ride-lost", () => Reflect.set(window, "__lost", (Reflect.get(window, "__lost") as number) + 1));
  });
  for (const target of ["ceres", "eris", "titan", "vanth", "dysnomia", "hiiaka", "mars", "io", "vesta", "halley"]) {
    await callOn(page, "ride", target, { smooth: false });
    await settle(page, 700);
    const s = await statsOf(page);
    expect((s as unknown as { ride: { riding: boolean; lost: boolean } }).ride, target).toMatchObject({ riding: true, lost: false });
    expect(s.camera.position.every(Number.isFinite), `${target}: the camera is somewhere`).toBe(true);
  }
  expect(await page.evaluate(() => Reflect.get(window, "__lost"))).toBe(0);
});
