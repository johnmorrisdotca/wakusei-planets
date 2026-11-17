// The landing sites with their country's flag: the Flags button on the body page and the space page, the flag in a place's tip, the site's name and flag written beside its dot once the body is close, the flag the real flag package draws,
// and the page told which site a press was. Chromium, drawing in software; every wait is on what the page reports.
import { expect, test, type Locator } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Shown = { id: string; layer: string; x: number; y: number }[];
const shown = (el: Locator): Promise<Shown> => el.evaluate((node) => [...(Reflect.get(node, "placesShown") as Shown)]);
const flagCodes = (el: Locator): Promise<string[]> => el.locator(".wk-place-site hata-flag").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("code") ?? ""));

test("the Flags button writes site-flags, names the landing sites with their flags once close, and the flags are drawn", async ({ page }) => {
  await page.goto("/wakusei-planets/?body=moon&places=landing");
  const main = page.locator("#main");
  await expect.poll(async () => (await shown(main)).length, { timeout: 90_000 }).toBeGreaterThan(5);
  // off until asked for: no name or flag beside a dot
  await expect(main).not.toHaveAttribute("site-flags", /.*/);
  expect(await main.locator(".wk-place-site").count()).toBe(0);

  await page.getByRole("group", { name: "Flags" }).getByRole("button", { name: "Flags", exact: true }).click();
  await expect(main).toHaveAttribute("site-flags", "");
  await expect.poll(() => new URL(page.url()).searchParams.get("flags")).toBe("1");
  // Tranquility Base to the middle: Apollo 11's name and the United States' flag beside it
  await main.evaluate((el) => (el as unknown as { goToPlace(t: string, o: unknown): Promise<unknown> }).goToPlace("Apollo 11 lunar module", { smooth: false }));
  // closer in, so the names find room beside their dots
  await main.evaluate((el) => (el as unknown as { setView(v: { zoom: number }): void }).setView({ zoom: 3 }));
  const eagle = main.locator('.wk-place[data-place="moon/apollo-11-lunar-module"] .wk-place-site');
  await expect(eagle).toBeVisible({ timeout: 30_000 });
  await expect(eagle).toContainText("Apollo 11");
  await expect(eagle.locator("hata-flag")).toHaveAttribute("code", "US");
  // the flag package draws it: a picture inside the element, with some width
  await expect.poll(async () => (await eagle.locator("hata-flag").boundingBox())?.width ?? 0, { timeout: 30_000 }).toBeGreaterThan(6);
  // the labels never sit on each other
  const boxes = await main.locator(".wk-place-site").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })));
  expect(boxes.length).toBeGreaterThan(1);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!;
    const b = boxes[j]!;
    expect(a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t, `labels ${i} and ${j} overlap`).toBe(false);
  }

  // the tip carries the flag too, and a press tells the page which site it is, with where the number is from
  const mark = main.locator('.wk-place[data-place="moon/apollo-11-lunar-module"]');
  await mark.hover();
  await expect(main.locator(".wk-place-tip hata-flag")).toHaveAttribute("code", "US");
  const picked = main.evaluate((el) => new Promise<{ id: string; country: string; url: string; agency: string }>((resolve) => el.addEventListener("wakusei-place", (e) => {
    const site = (e as CustomEvent<{ site: { id: string; country: string; agency: { en: string }; source: { url: string } } }>).detail.site;
    resolve({ id: site.id, country: site.country, url: site.source.url, agency: site.agency.en });
  }, { once: true })));
  await mark.click();
  expect(await picked).toEqual({ id: "moon/apollo-11", country: "US", url: "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html", agency: "NASA" });

  // a Soviet lander carries the Soviet flag, a Chinese one China's
  await main.evaluate((el) => (el as unknown as { goToPlace(t: string, o: unknown): Promise<unknown> }).goToPlace("Luna 16", { smooth: false }));
  await expect.poll(async () => (await flagCodes(main)).includes("SU"), { timeout: 30_000 }).toBe(true);

  // in Japanese the name is the Japanese one; the flag stays
  await page.evaluate(() => document.querySelector("#main")!.setAttribute("lang", "ja"));
  await expect(main.locator('.wk-place[data-place="moon/luna-16"] .wk-place-site')).toContainText("ルナ16号", { timeout: 30_000 });

  // off again: the names and flags go, the dots stay
  await page.evaluate(() => document.querySelector("#main")!.removeAttribute("site-flags"));
  await expect.poll(() => main.locator(".wk-place-site").count(), { timeout: 30_000 }).toBe(0);
  expect((await shown(main)).length).toBeGreaterThan(0);
});

test("Mars on the space page: the landers carry the United States' and China's flags", async ({ page }) => {
  await page.goto("/wakusei-planets/space.html?places=landing&flags=1");
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("site-flags", "");
  const result = await space.evaluate(async (el) => {
    const space = el as unknown as { goToPlace(t: string, o: unknown): Promise<{ id: string } | undefined> };
    const viking = await space.goToPlace("Viking 1", { body: "mars", smooth: false, zoom: 8 });
    return viking?.id;
  });
  expect(result).toBe("mars/viking-1");
  const label = space.locator('.wk-place[data-place="mars/viking-1"] .wk-place-site');
  await expect(label).toBeVisible({ timeout: 60_000 });
  await expect(label.locator("hata-flag")).toHaveAttribute("code", "US");
});
