// Shown times match the page's own date in two zones (MODULES-954). Each reading is made in the page, so a difference between the runner's zone data and the browser's does not count.
import { expect, test, type Page } from "@playwright/test";
import { SPACECRAFT } from "../src/spacecraft-facts.ts";
import "./load.ts";

const AT = Date.parse("2026-11-02T14:00:00.000Z");
const ZONES = ["America/Vancouver", "Asia/Tokyo"] as const;

/** The datetime-local digits of an instant, worked out in the page. */
async function localBox(page: Page, ms: number): Promise<string> {
  return page.evaluate((at) => {
    const d = new Date(at);
    const p = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }, ms);
}

for (const zone of ZONES) {
  test.describe(zone, () => {
    test.use({ timezoneId: zone });

    test("a local date box shows that instant, and a time marked UTC stays UTC", async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(`/wakusei-planets/space.html?t=${new Date(AT).toISOString()}&play=off`);
      await expect.poll(async () => page.locator("#when").inputValue(), { timeout: 30_000 }).toBe(await localBox(page, AT));

      await page.goto(`/wakusei-planets/?t=${new Date(AT).toISOString()}&moons=1&play=off`);
      await expect.poll(async () => page.locator("#when").inputValue(), { timeout: 30_000 }).toBe(await localBox(page, AT));
      await expect(page.locator("#caption")).toContainText("2026-11-02 14:00 UTC", { timeout: 30_000 });

      await page.goto(`/wakusei-planets/space-full.html?t=${new Date(AT).toISOString()}`);
      const full = await page.evaluate((at) => new Date(at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "medium" }), AT);
      await expect.poll(async () => page.locator("#when").textContent(), { timeout: 30_000 }).toBe(full);

      await page.goto(`/wakusei-planets/portrait.html?scene=${encodeURIComponent(`date:${new Date(AT).toISOString()}`)}`);
      await expect.poll(async () => page.locator("#when").inputValue(), { timeout: 30_000 }).toBe(await localBox(page, AT));
    });

    test("the spacecraft page's date, launch and events are that page's own times", async ({ page }) => {
      await page.goto("/wakusei-planets/craft.html");
      await expect(page.locator("#facts")).toContainText("Voyager 1", { timeout: 30_000 });
      await page.locator("#play").click();
      const launch = SPACECRAFT.voyager1.launch.date;
      const events = SPACECRAFT.voyager1.events.map((event) => ({ date: event.date, precision: event.precision, name: event.name.en }));
      const read = await page.evaluate(({ launch: at, events: list }) => {
        const box = (document.querySelector("#when") as HTMLInputElement).value;
        const ms = Date.parse(box);
        const where = document.querySelector("#where")?.textContent ?? "";
        const short = new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        const facts = document.querySelector("#facts")?.textContent ?? "";
        const launchText = new Date(at).toLocaleString();
        const rows = [...document.querySelectorAll("#events li")].map((item) => item.textContent ?? "");
        const eventText = list.map((event) => event.precision === "minute"
          ? new Date(event.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
          : new Date(event.date).toLocaleDateString(undefined, { dateStyle: "medium" }));
        return { whereHas: where.includes(short), factsHas: facts.includes(launchText), eventsMatch: rows.length === list.length && rows.every((row, i) => row.startsWith(`${eventText[i]}:`)) };
      }, { launch, events });
      expect(read.whereHas, "the where line uses the date box's instant").toBe(true);
      expect(read.factsHas, "the launch is the page's own local time").toBe(true);
      expect(read.eventsMatch, "each event uses the page's own local date").toBe(true);
    });
  });
}
