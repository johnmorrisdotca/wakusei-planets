// The giant planets' moon pages (jupiter.html, saturn.html, uranus.html, neptune.html) in a real browser: the four tabs, the orbits with their two colours, the table that sorts, Japanese, and no sideways scroll at a phone's 390 pixels.
// The map, the portrait and the cards draw WebGL, so off CI WebKit leaves those two tabs closed (it has no software drawing, and tests never draw on the Mac's graphics card).
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import { MOONS_OF } from "../src/facts.ts";
import { catalogueMoonsOf, moonCounts } from "../src/moon-catalogue.ts";

const HOSTS = ["jupiter", "saturn", "uranus", "neptune"] as const;
const TABS = ["orbits", "views", "cards", "table"] as const;

const open = async (page: Page, host: string, query = ""): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/${host}.html${query}`);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  return errors;
};
const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const drawsGl = (browserName: string): boolean => browserName === "chromium" || process.env["CI"] !== undefined;
/** The numbers of a column of the table, top to bottom, with the rows that have none left out. */
const column = (page: Page, index: number): Promise<number[]> =>
  page.locator("#rows tr").evaluateAll(
    (rows, i) => rows.map((row) => row.children[i]!.textContent!.replace(/[≈,\s]/g, "")).filter((text) => text !== "—").map(Number),
    index,
  );
const ascending = (list: number[]): boolean => list.every((v, i) => i === 0 || list[i - 1]! <= v);

for (const host of HOSTS) {
  test(`${host}: four tabs, each one panel, and nothing scrolls sideways at 390 pixels`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await open(page, host);
    const name = host[0]!.toUpperCase() + host.slice(1);
    await expect(page.locator("#moons-h")).toHaveText(`${name} and its moons`);
    await expect(page.locator(`#planets a[data-host="${host}"]`)).toHaveAttribute("aria-current", "page");
    // the counts in the words are the moon list's own
    const counts = moonCounts()[host]!;
    await expect(page.locator("#lede")).toContainText(`${counts.total} known moons, ${counts.named} of them with a name`);
    await expect(page.locator("[role=tab]")).toHaveCount(4);
    expect(await page.locator("details, summary").count()).toBe(0);
    for (const tab of TABS) {
      if ((tab === "views" || tab === "cards") && !drawsGl(browserName)) continue;
      await page.locator(`#tab-${tab}`).click();
      await expect(page.locator(`#tab-${tab}`)).toHaveAttribute("aria-selected", "true");
      for (const other of TABS) await expect(page.locator(`#panel-${other}`)).toBeVisible({ visible: other === tab });
      await expect.poll(() => page.evaluate(() => location.search)).toBe(tab === "orbits" ? "" : `?tab=${tab}`);
      expect(await noSideScroll(page), `${tab} scrolls sideways`).toBe(true);
    }
    // the arrow keys go along the tabs
    await page.locator("#tab-table").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#tab-orbits")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#tab-orbits")).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test("the orbits: every moon with an orbit, prograde and retrograde in two colours, three angles, a press says whose orbit it is", async ({ page }) => {
  const errors = await open(page, "jupiter");
  const svg = page.locator("#orbits");
  const placed = catalogueMoonsOf("jupiter").filter((m) => m.orbit !== null);
  await expect(svg).toHaveAttribute("data-orbits", String(placed.length));
  // each orbit has its far half before the planet and its near half after it, so at an angle there are up to two lines a moon
  const ids = new Set(await svg.locator("path[data-id]").evaluateAll((paths) => paths.map((p) => p.getAttribute("data-id"))));
  expect(ids.size).toBe(placed.length);
  const colours = await svg.locator(".lines path").evaluateAll((paths) => [...new Set(paths.map((p) => `${p.getAttribute("data-dir")} ${p.getAttribute("stroke")}`))]);
  expect(colours.sort()).toEqual(["prograde #5aa9ff", "retrograde #ff6b6b"]);
  await expect(page.locator("#key li")).toHaveCount(2);
  await expect(page.locator('#key li[data-key="retrograde"] b')).toHaveText(String(placed.filter((m) => m.retrograde).length));
  for (const view of ["above", "side", "tilted"]) {
    await page.locator(`#view [data-view="${view}"]`).click();
    await expect(svg).toHaveAttribute("data-view", view);
    await expect(page.locator(`#view [data-view="${view}"]`)).toHaveAttribute("aria-pressed", "true");
  }
  // by family, the key is the families
  await page.locator('#colour [data-colour="group"]').click();
  await expect(svg).toHaveAttribute("data-colour", "group");
  await expect(page.locator("#key li")).toHaveCount(7);
  await expect.poll(() => page.evaluate(() => location.search)).toContain("colour=group");
  // the inner moons, from above: a press on Callisto's line names it
  await page.locator('#reach [data-reach="inner"]').click();
  await page.locator('#view [data-view="above"]').click();
  await expect(svg).toHaveAttribute("data-reach", "inner");
  const at = await svg.locator('path[data-id="callisto"]').first().evaluate((path) => {
    const p = (path as SVGPathElement).getPointAtLength(0);
    const m = (path as SVGPathElement).getScreenCTM()!;
    return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
  });
  await page.mouse.click(at.x, at.y);
  await expect(svg).toHaveAttribute("data-picked", "callisto");
  await expect(page.locator("#pick")).toContainText("Callisto: Prograde, 1,882,700 km from Jupiter");
  expect(errors).toEqual([]);
});

test("the table: every moon of the list, and it sorts by any column both ways, kept in the address", async ({ page }) => {
  const errors = await open(page, "saturn", "?tab=table");
  await expect(page.locator("#rows tr")).toHaveCount(catalogueMoonsOf("saturn").length);
  // by distance, nearest first, at the start
  await expect(page.locator('th[data-col="distance"]')).toHaveAttribute("aria-sort", "ascending");
  expect(ascending(await column(page, 3))).toBe(true);
  // by size: smallest first, then largest first, Titan at the top
  await page.locator('button[data-sort="size"]').click();
  await expect(page.locator('th[data-col="size"]')).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator('th[data-col="distance"]')).not.toHaveAttribute("aria-sort", /./);
  expect(ascending(await column(page, 2))).toBe(true);
  await page.locator('button[data-sort="size"]').click();
  await expect(page.locator('th[data-col="size"]')).toHaveAttribute("aria-sort", "descending");
  expect(ascending((await column(page, 2)).reverse())).toBe(true);
  await expect(page.locator("#rows tr").first()).toHaveAttribute("data-id", "titan");
  await expect.poll(() => page.evaluate(() => location.search)).toBe("?tab=table&sort=size&order=down");
  // a size worked out from brightness is marked
  expect(await page.locator("#rows td[data-estimate]").count()).toBe(catalogueMoonsOf("saturn").filter((m) => m.radiusFrom === "derived" && m.radiusKm !== null).length);
  // by the year found, and the address brings the same order back
  await page.locator('button[data-sort="year"]').click();
  expect(ascending(await column(page, 5))).toBe(true);
  await expect.poll(() => page.evaluate(() => location.search)).toBe("?tab=table&sort=year");
  await page.reload();
  await expect(page.locator('th[data-col="year"]')).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator("#tab-table")).toHaveAttribute("aria-selected", "true");
  // a move to another planet keeps the choices
  await page.locator('#planets a[data-host="jupiter"]').click();
  await expect(page).toHaveURL(/jupiter\.html\?tab=table&sort=year$/);
  await expect(page.locator("#rows tr")).toHaveCount(catalogueMoonsOf("jupiter").length);
  expect(errors).toEqual([]);
});

test("in Japanese: the title, the tabs and the table's words", async ({ page }) => {
  const errors = await open(page, "neptune", "?lang=ja&tab=table");
  await expect(page.locator("#moons-h")).toHaveText("海王星とその衛星");
  await expect(page.locator("#tab-orbits")).toHaveText("軌道");
  await expect(page.locator('button[data-sort="direction"]')).toHaveText("回る向き");
  await expect(page.locator('#rows tr[data-id="triton"] th')).toHaveText("トリトン");
  await expect(page.locator('#rows tr[data-id="triton"] td').last()).toHaveText("逆向き");
  expect(errors).toEqual([]);
});

test("the map, the portrait and the cards: made when their tab opens, with the moons drawn in full", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const errors = await open(page, "jupiter");
  await expect(page.locator("wakusei-plan, wakusei-portrait, wakusei-body")).toHaveCount(0);
  await page.locator("#tab-views").click();
  const plan = page.locator("wakusei-plan");
  await expect(plan).toHaveAttribute("data-state", "ready");
  expect(await plan.locator("g[data-id]").count()).toBe(MOONS_OF.jupiter.length + 1);
  await expect(page.locator("wakusei-portrait")).toHaveCount(1);
  await page.locator("#tab-cards").click();
  await expect(page.locator("#cards .moons-card")).toHaveCount(MOONS_OF.jupiter.length);
  await expect(page.locator("#cards .moons-card").first()).toHaveAttribute("data-id", "amalthea");
  await expect(page.locator('#cards .moons-card[data-id="amalthea"]')).toContainText("shape measured");
  expect(errors).toEqual([]);
});
