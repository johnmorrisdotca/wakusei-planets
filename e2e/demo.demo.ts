// The demo page and the embed page, played in a browser at a phone's width and a desk's. They use the line look: the shaded looks are in freeze.demo.ts (Chromium, drawn in software).
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("the page has the family's header, ten bodies, and draws the chosen one", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=saturn`);
  await expect(page.locator("kazoku-language-picker")).toBeVisible();
  await expect(page.locator("kazoku-theme-switch")).toBeVisible();
  await expect(page.locator("#tiles .tile")).toHaveCount(10);
  await expect(page.locator("#main")).toHaveAttribute("body", "saturn");
  await expect(page.locator("#main svg")).toBeVisible();
  await expect(page.locator("#caption")).toContainText("Saturn");
});

test("picking a tile changes the big view and the address", async ({ page }) => {
  await page.goto(`${URL}?look=line`);
  await page.locator('.tile[data-body="mars"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "mars");
  await expect(page).toHaveURL(/body=mars/);
  await expect(page.locator('.tile[data-body="mars"]')).toHaveAttribute("aria-pressed", "true");
});

test("moons show for a planet that has them, and the date row opens", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  await page.locator("#moons").click();
  await expect(page.locator("#main")).toHaveAttribute("moons", "");
  await expect(page.locator("#time-row")).toBeVisible();
  await expect(page.locator("#main svg")).toContainText("Callisto");
  await page.locator('.tile[data-body="mercury"]').click();
  await expect(page.locator("#moons")).toBeHidden();
});

test("one button draws the photo maps, and look=painted still works as an address", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  await expect(page.locator('#looks [data-look="painted"]')).toBeHidden();
  await expect(page.locator('#looks [data-look="realistic"]')).toBeVisible();
  await page.goto(`${URL}?look=painted&body=mars`);
  await expect(page.locator("#main")).toHaveAttribute("look", "painted");
});

test("the Earth's line look is chikyu-earth's own globe, not a second copy; its other looks are this package's", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=earth`);
  await expect(page.locator("#main chikyu-earth")).toBeAttached();
  await expect(page.locator("#caption")).toContainText("Earth");
  await page.locator('#looks [data-look="realistic"]').click();
  await expect(page.locator("#main chikyu-earth")).toHaveCount(0);
});

test("a turning line Earth keeps chikyu-earth's globe while a line Mars beside it turns, and turns again as another body", async ({ page }) => {
  // chikyu-earth's own page of the two packages together: an Earth and a Mars in the line look, turning at full speed
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`${URL}?look=line&body=saturn`);
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:0;z-index:99;background:#fff";
    const make = (body: string, size: string): HTMLElement => {
      const el = document.createElement("wakusei-body");
      el.setAttribute("body", body);
      el.setAttribute("look", "line");
      el.setAttribute("size", size);
      box.append(el);
      return el;
    };
    document.body.append(box);
    const earth = make("earth", "260");
    const mars = make("mars", "160");
    const seen = { globesRemoved: 0, marsDrawn: 0, earthDrawn: 0 };
    Object.assign(globalThis, { together: { earth, mars, seen } });
    new MutationObserver((records) => {
      seen.earthDrawn += 1;
      for (const record of records) for (const node of record.removedNodes) if ((node as Element).localName === "chikyu-earth") seen.globesRemoved += 1;
    }).observe(earth.shadowRoot!.getElementById("stage")!, { childList: true });
    new MutationObserver(() => void (seen.marsDrawn += 1)).observe(mars.shadowRoot!.getElementById("stage")!, { childList: true });
  });
  type Together = { together: { earth: HTMLElement; mars: HTMLElement; seen: { globesRemoved: number; marsDrawn: number; earthDrawn: number } } };
  await page.waitForFunction(() => ((globalThis as unknown as Together).together.earth.shadowRoot?.querySelector("chikyu-earth")?.shadowRoot?.querySelectorAll("svg path").length ?? 0) > 50);
  // Mars's own line drawing is redrawn as it turns: twenty of its frames
  await page.waitForFunction(() => (globalThis as unknown as Together).together.seen.marsDrawn >= 20);
  const after = await page.evaluate(() => {
    const { earth, seen } = (globalThis as unknown as Together).together;
    return { globesRemoved: seen.globesRemoved, globe: earth.shadowRoot!.querySelector("#stage > chikyu-earth") !== null, ownLine: earth.shadowRoot!.querySelector("#stage > svg") !== null };
  });
  expect(after).toEqual({ globesRemoved: 0, globe: true, ownLine: false });
  // the same element made another body is this package's own turning line drawing again
  await page.evaluate(() => {
    const { earth, seen } = (globalThis as unknown as Together).together;
    earth.setAttribute("body", "jupiter");
    seen.earthDrawn = 0;
  });
  await page.waitForFunction(() => (globalThis as unknown as Together).together.seen.earthDrawn >= 20);
  expect(await page.evaluate(() => (globalThis as unknown as Together).together.earth.shadowRoot!.querySelector("#stage > chikyu-earth") === null)).toBe(true);
});

test("the Japanese page names the bodies in Japanese", async ({ page }) => {
  await page.goto(`${URL}?look=line&lang=ja`);
  await expect(page.locator('.tile[data-body="jupiter"]')).toContainText("木星");
});

test("every control is a finger wide and none is left in the browser's own style", async ({ page }) => {
  await page.goto(`${URL}?look=line`);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".controls button, .controls input, .tile")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 47.5) out.push(`${el.textContent?.trim() || el.id} is ${Math.round(r.height)} px high`);
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius);
      if (radius < 8) out.push(`${el.textContent?.trim() || el.id} is square-cornered: the browser's own style`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("the embed page draws what its address says", async ({ page }) => {
  await page.goto(`${URL}embed.html?body=uranus&look=line&time=2026-11-02T12:00Z`);
  const el = page.locator("wakusei-body");
  await expect(el).toHaveAttribute("body", "uranus");
  await expect(el.locator("svg")).toBeVisible();
  const box = await page.locator("#frame").boundingBox();
  expect(box!.width).toBeGreaterThan(100);
});
