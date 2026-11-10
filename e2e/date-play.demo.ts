// The date follows the clock and Play runs it (MODULES-759, MODULES-755): on the space page and the body page, in a real browser. Time at 86400x for two seconds moves the date box on by days;
// a ride along (the Moon, Io) keeps the box moving; Play starts from the date shown, Pause holds it, Back returns to the date chosen, and the address keeps play, the speed and the date.
// Nothing is drawn while paused. The box is never written while the reader is typing in it, and a reader who prefers reduced motion gets Play left off.
import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });

const SPACE_PAGE = "/wakusei-planets/space.html";
const BODY_PAGE = "/wakusei-planets/";
const START = "2026-11-02T14:00:00Z";
const DAY = 86_400_000;

/** The date box as milliseconds (it shows local time to the minute). */
const boxMs = async (page: Page): Promise<number> => Date.parse(await page.locator("#when").inputValue());
const play = (page: Page) => page.locator('#replay [data-act="play"]');
const back = (page: Page) => page.locator('#replay [data-act="start"]');
const speed = (page: Page, value: number) => page.locator(`#replay button[data-v="${value}"]`);
/** What the address holds, as the page writes it (a few moments after a choice). */
const addressOf = async (page: Page): Promise<URLSearchParams> => {
  await page.waitForTimeout(400);
  return new URL(page.url()).searchParams;
};

async function openSpace(page: Page, query: string): Promise<void> {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${SPACE_PAGE}?${query}`);
  await page.locator("wakusei-space[data-state=live]").waitFor({ timeout: 90_000 });
}

test.describe("the space page", () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  });

  test("at 86400x for two seconds the date box reads a later day, and the element tells the page a few times a second at most", async ({ page }) => {
    await page.addInitScript(() => {
      const log: { at: number; running: boolean }[] = [];
      Reflect.set(window, "__timechange", log);
      addEventListener("DOMContentLoaded", () => document.querySelector("wakusei-space")!.addEventListener("wakusei-timechange", (e) => log.push({ at: performance.now(), running: (e as CustomEvent<{ running: boolean }>).detail.running })));
    });
    await openSpace(page, `t=${START}&play=on&speed=86400`);
    await expect(play(page)).toHaveAttribute("aria-pressed", "true");
    // Time is the page's clock, not the frames drawn (MODULES-797): in two seconds of real time the element's own moment moves on two days, within 1 percent, however slowly this machine draws.
    // It is read from the element and timed with the page's clock at both reads, so a slow draw between them cannot spoil it.
    const clock = () => page.evaluate(() => ({ time: (document.querySelector("wakusei-space") as unknown as { time: number }).time, at: performance.now() }));
    const from = await clock();
    await page.waitForTimeout(2200);
    const to = await clock();
    const seconds = (to.at - from.at) / 1000;
    expect((to.time - from.time) / DAY / seconds, `the clock moved ${((to.time - from.time) / DAY).toFixed(3)} days in ${seconds.toFixed(2)} s`).toBeGreaterThan(0.99);
    expect((to.time - from.time) / DAY / seconds).toBeLessThan(1.01);
    expect(to.time - from.time, "at least one day in 2.2 s").toBeGreaterThanOrEqual(DAY);
    // the box follows the clock: it is written from the element's events (a few a second), so it is never more than the moment of the last event behind. A long draw can hold an event back,
    // so it is the catching up that is waited for, not the clock of the test: the box reaches the moment the element had at the second read.
    await expect.poll(async () => await boxMs(page), { timeout: 15_000, message: "the box reaches the moment the clock had" }).toBeGreaterThanOrEqual(to.time - 60_000);
    expect(await boxMs(page), "and is a later day than it started").toBeGreaterThanOrEqual(from.time + DAY);
    const log = (await page.evaluate(() => Reflect.get(window, "__timechange"))) as { at: number; running: boolean }[];
    const running = log.filter((e) => e.running);
    expect(running.length, "told while time runs").toBeGreaterThanOrEqual(3);
    for (let i = 1; i < running.length; i += 1) expect(running[i]!.at - running[i - 1]!.at, "no more than four a second").toBeGreaterThanOrEqual(240);
    // it holds: told once, at once
    await play(page).click();
    await page.waitForTimeout(300);
    const held = ((await page.evaluate(() => Reflect.get(window, "__timechange"))) as { at: number; running: boolean }[]).filter((e) => !e.running);
    expect(held.length, "told once when it holds").toBe(1);
  });

  for (const [ride, label] of [["moon", "The Moon"], ["io", "Io, over Jupiter"]] as const) {
    test(`riding along ${ride}: the clock starts and the date box keeps moving`, async ({ page }) => {
      await openSpace(page, `t=${START}`);
      await expect(play(page)).toHaveAttribute("aria-pressed", "false");
      const before = await boxMs(page);
      await page.getByRole("group", { name: "Ride along" }).getByRole("button", { name: label, exact: true }).dispatchEvent("click");
      await expect(play(page)).toHaveAttribute("aria-pressed", "true");
      await expect.poll(async () => (await boxMs(page)) - before, { message: `the box moved on while riding ${ride}`, timeout: 8000 }).toBeGreaterThanOrEqual(3600_000);
      // "keeps moving": it reaches a later minute again. The box is written from the element's events, and a long draw of the ride can hold them back for a second or two on a busy machine, so
      // it is the box moving on that is waited for (a box that stopped for good fails at the end of the wait), not a fixed 1.5 s.
      const later = await boxMs(page);
      await expect.poll(() => boxMs(page), { message: "and keeps moving", timeout: 15_000 }).toBeGreaterThan(later);
    });
  }

  test("Play runs the clock from the date shown, Pause holds it, Back returns to the date chosen, and the address keeps it", async ({ page }) => {
    await openSpace(page, `t=${START}`);
    const start = await boxMs(page);
    expect(Date.parse(START) - start, "the box shows the address's date").toBeLessThan(60_000);
    expect((await addressOf(page)).get("play")).toBeNull();
    await page.waitForTimeout(1000);
    expect(await boxMs(page), "held until Play").toBe(start);

    await play(page).click();
    expect((await addressOf(page)).get("play")).toBe("on");
    // a lower bound, waited for: the box is written from the element's events, which a long draw can hold back on a busy machine
    await expect.poll(() => boxMs(page), { message: "Play moves the date on from the date shown", timeout: 15_000 }).toBeGreaterThan(start + 3600_000);
    const running = await boxMs(page);

    await play(page).click();
    await expect(play(page)).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(400);
    const held = await boxMs(page);
    expect(held).toBeGreaterThanOrEqual(running);
    await page.waitForTimeout(1500);
    expect(await boxMs(page), "Pause holds the date").toBe(held);
    const paused = await addressOf(page);
    expect(paused.get("play"), "play leaves the address").toBeNull();
    expect(Date.parse(paused.get("t")!), "the date it stopped on is in the address").toBeGreaterThan(Date.parse(START));
    expect(Math.abs(Date.parse(paused.get("t")!) - held), "and is the date shown").toBeLessThan(120_000);

    // Play again goes on from there, and Back goes to the date the reader chose, not where Pause was
    await play(page).click();
    await expect.poll(() => boxMs(page), { message: "Play goes on from the date it was held on", timeout: 15_000 }).toBeGreaterThan(held + 1800_000);
    await back(page).click();
    await expect(play(page)).toHaveAttribute("aria-pressed", "false");
    expect(await boxMs(page), "Back returns to the chosen date").toBe(start);
    await page.waitForTimeout(1000);
    expect(await boxMs(page), "and holds there").toBe(start);
    const returned = await addressOf(page);
    expect(Date.parse(returned.get("t")!), "the address has the chosen date").toBe(Date.parse(START));
    expect(returned.get("play")).toBeNull();
  });

  test("a speed is kept in the address and a reader who returns finds Play and the speed as they were", async ({ page }) => {
    await openSpace(page, `t=${START}`);
    await speed(page, 86400).click();
    await play(page).click();
    const ask = await addressOf(page);
    expect(ask.get("speed")).toBe("86400");
    expect(ask.get("play")).toBe("on");
    await page.reload();
    await page.locator("wakusei-space[data-state=live]").waitFor({ timeout: 90_000 });
    await expect(play(page)).toHaveAttribute("aria-pressed", "true");
    await expect(speed(page, 86400)).toHaveAttribute("aria-pressed", "true");
  });

  test("the box is left alone while the reader is typing in it", async ({ page }) => {
    await openSpace(page, `t=${START}&play=on&speed=86400`);
    await page.locator("#when").focus();
    const typed = await page.locator("#when").inputValue();
    await page.waitForTimeout(1500);
    expect(await page.locator("#when").inputValue(), "not written while it has the focus").toBe(typed);
    await page.locator("#when").blur();
    await expect.poll(() => page.locator("#when").inputValue(), { timeout: 5000 }).not.toBe(typed);
  });

  test("nothing is drawn while paused, and the clock stops asking for frames", async ({ page }) => {
    await openSpace(page, `t=${START}&play=on&speed=86400`);
    await page.waitForTimeout(800);
    await play(page).click();
    await expect(play(page)).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(800);
    const before = await readCounts(page);
    await page.waitForTimeout(3000);
    const after = await readCounts(page);
    expect(after.draws, "no draws while paused").toBe(before.draws);
    expect(after.rafRequests, "no frames asked for while paused").toBe(before.rafRequests);
  });
});

test.describe("the body page", () => {
  test("Play runs the dated picture's clock from the date shown and the box follows; Pause holds; Back returns", async ({ page }) => {
    await page.goto(`${BODY_PAGE}?look=line&body=jupiter&sky=real&moons=1&t=${START}&speed=86400`);
    const start = await boxMs(page);
    await expect(page.locator("#main")).toHaveAttribute("rate", "0");
    await page.waitForTimeout(800);
    expect(await boxMs(page), "held until Play").toBe(start);
    await play(page).click();
    await expect(page.locator("#main")).toHaveAttribute("rate", "86400");
    await expect.poll(async () => (await boxMs(page)) - start, { message: "the box reads a later day", timeout: 15_000 }).toBeGreaterThanOrEqual(DAY);
    await play(page).click();
    await page.waitForTimeout(400);
    const held = await boxMs(page);
    await page.waitForTimeout(1200);
    expect(await boxMs(page), "Pause holds").toBe(held);
    const paused = await addressOf(page);
    expect(Date.parse(paused.get("t")!), "the stopping date is in the address").toBeGreaterThan(Date.parse(START) + DAY);
    await play(page).click();
    await page.waitForTimeout(600);
    await back(page).click();
    expect(await boxMs(page), "Back returns to the chosen date").toBe(start);
    await expect(page.locator("#main")).toHaveAttribute("rate", "0");
  });

  test("a held clock draws nothing, however the picture is set up", async ({ page }) => {
    await page.addInitScript(COUNT_SCRIPT);
    await page.goto(`${BODY_PAGE}?look=line&body=jupiter&sky=real&moons=1&t=${START}`);
    await page.waitForTimeout(800);
    const before = await page.locator("#main").evaluate((el) => el.shadowRoot?.innerHTML.length ?? 0);
    const mutations = await page.locator("#main").evaluate(async (el) => {
      let n = 0;
      const watcher = new MutationObserver((list) => (n += list.length));
      watcher.observe(el.shadowRoot!, { subtree: true, childList: true, attributes: true, characterData: true });
      await new Promise((done) => setTimeout(done, 2500));
      watcher.disconnect();
      return n;
    });
    expect(before).toBeGreaterThan(0);
    expect(mutations, "the picture is not redrawn while the clock is held").toBe(0);
  });
});

test.describe("a reader who prefers reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("gets Play left off, even from an address that asks for it", async ({ page }) => {
    await page.goto(`${SPACE_PAGE}?t=${START}&play=on&speed=86400`);
    await expect(play(page)).toHaveAttribute("aria-pressed", "false");
    await expect(play(page)).toBeDisabled();
    const before = await boxMs(page);
    await page.waitForTimeout(1200);
    expect(await boxMs(page)).toBe(before);
    expect((await addressOf(page)).get("play")).toBeNull();
  });
});
