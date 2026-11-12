// The asteroid belts and the Kuiper belt in the space view, in a real browser (Chromium, drawn in software): drawn by default, one instanced draw for each belt and credited, chosen by `belts`, nothing drawn at rest, a flight into
// the main belt with the line that says how empty it is, and the Oort cloud's labelled shell.
import { COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.addInitScript(COUNT_SCRIPT);
});

const SPACE = "wakusei-space";
const PAGE = "/wakusei-planets/space.html";
type Door = { points: number; belts: number; draws: number };
const sky = (page: Page) => page.locator(SPACE);
const doorOf = (page: Page) => sky(page).evaluate((el) => (Reflect.get(el, "stats") as { door: Door }).door);
const creditsOf = (page: Page) => sky(page).evaluate((el) => (el as unknown as { credits(): { source: { id: string }; own: boolean; used: number }[] }).credits().map((c) => ({ id: c.source.id, own: c.own, used: c.used })));
const noteOf = (page: Page) => sky(page).evaluate((el) => {
  const note = el.shadowRoot!.querySelector<HTMLElement>(".sp-note")!;
  return { hidden: note.hidden, text: note.textContent ?? "" };
});

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`${PAGE}?t=2026-11-02T14:00Z&scale=compressed&play=off${query}`);
  await expect(sky(page)).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await page.waitForTimeout(1200);
}

test("the belts are drawn by default, one instanced draw for each of the seven, credited as the package's own and held by data=own", async ({ page }) => {
  await open(page);
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 60_000 }).toBe(3340);
  const door = await doorOf(page);
  expect(door.draws).toBe(7);
  expect(door.points, "a page's own sources are none").toBe(0);
  expect(await sky(page).evaluate((el) => (Reflect.get(el, "belts") as string[]).join(","))).toBe("main,hilda,trojan,centaur,classical,resonant,scattered");
  expect(await sky(page).evaluate((el) => (Reflect.get(el, "sources") as unknown[]).length), "the belts are not among the page's sources").toBe(0);
  const credits = await creditsOf(page);
  expect(credits.find((c) => c.id === "wakusei-belts")).toMatchObject({ own: true, used: 3340 });
  await expect(page.getByTestId("door-credit")).toContainText("Small-Body Database");
  // data=own keeps the package's own
  await open(page, "&data=own");
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 60_000 }).toBe(3340);
});

test("belts=0 draws none and credits none, and the property chooses which are drawn", async ({ page }) => {
  await open(page, "&belts=0");
  expect((await doorOf(page)).belts).toBe(0);
  expect((await creditsOf(page)).some((c) => c.id === "wakusei-belts")).toBe(false);
  await sky(page).evaluate((el) => Reflect.set(el, "belts", ["main", "trojan"]));
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 60_000 }).toBe(1300 + 520);
  expect((await doorOf(page)).draws).toBe(2);
  await sky(page).evaluate((el) => el.setAttribute("belts", "hilda"));
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 30_000 }).toBe(220);
  await sky(page).evaluate((el) => el.setAttribute("belts", "off"));
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 30_000 }).toBe(0);
});

test("at rest the belts are not drawn again, and the whole solar system shows the main belt as a band", async ({ page }) => {
  await open(page);
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 60_000 }).toBe(3340);
  await sky(page).evaluate((el) => {
    const controller = Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void };
    controller.set({ zoom: (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system") }, true, "jump");
  });
  // the pictures of the bodies that came into view finish loading, each with one more draw; then it is at rest
  await page.waitForTimeout(7000);
  const before = await sky(page).evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);
  await page.waitForTimeout(2500);
  const after = await sky(page).evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);
  expect(after - before, "nothing is drawn at rest").toBe(0);
});

test("a flight into the main belt: the camera rides a point round the Sun, true distances, and a line says the belt is almost all empty, in either language; leaving, or the squeezed scale, ends it", async ({ page }) => {
  await open(page);
  await expect.poll(async () => (await doorOf(page)).belts, { timeout: 60_000 }).toBe(3340);
  expect((await noteOf(page)).hidden).toBe(true);
  await sky(page).evaluate((el) => (el as unknown as { enterBelt(b: string, o: object): void }).enterBelt("main", { smooth: false }));
  expect(await sky(page).evaluate((el) => Reflect.get(el, "flyingThrough"))).toBe("main");
  expect(await sky(page).evaluate((el) => Reflect.get(el, "scale")), "true distances").toBe("true");
  expect(await sky(page).evaluate((el) => (Reflect.get(el, "riding") as { around: string; look: string }))).toMatchObject({ around: "sun", look: "ahead" });
  await expect.poll(async () => (await noteOf(page)).text, { timeout: 30_000 }).toContain("1,429,419 bodies are known");
  const note = await noteOf(page);
  expect(note.hidden).toBe(false);
  expect(note.text).toMatch(/Moon distances/);
  expect(note.text).toMatch(/almost all empty/);
  expect(note.text).toMatch(/1,300 drawn are only the brightest/);
  // the picture is not black: dots round the camera
  await page.waitForTimeout(1500);
  const lit = await sky(page).screenshot().then((png) => png.length);
  expect(lit).toBeGreaterThan(2000);
  await sky(page).evaluate((el) => el.setAttribute("lang", "ja"));
  await expect.poll(async () => (await noteOf(page)).text).toContain("メインベルト");
  expect((await noteOf(page)).text).toContain("何もない空間");
  await sky(page).evaluate((el) => (el as unknown as { leaveBelt(o: object): void }).leaveBelt({ smooth: false }));
  expect(await sky(page).evaluate((el) => Reflect.get(el, "flyingThrough"))).toBeNull();
  expect((await noteOf(page)).hidden).toBe(true);
  // the squeezed scale does not map a camera among the bodies: it ends the flight
  await sky(page).evaluate((el) => (el as unknown as { enterBelt(b: string, o: object): void }).enterBelt("trojan", { smooth: false }));
  expect(await sky(page).evaluate((el) => Reflect.get(el, "flyingThrough"))).toBe("trojan");
  await sky(page).evaluate((el) => Reflect.set(el, "scale", "compressed"));
  expect(await sky(page).evaluate((el) => Reflect.get(el, "flyingThrough"))).toBeNull();
  expect(await sky(page).evaluate((el) => (el as unknown as { enterBelt(b: string): void }).enterBelt("nowhere")).catch((error: Error) => error.message)).toContain("belt must be one of");
});

test("the Oort cloud's shell is drawn in the squeezed scale, labelled, and not to scale", async ({ page }) => {
  await open(page);
  await sky(page).evaluate((el) => {
    const controller = Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void };
    controller.set({ zoom: 0.0008 }, true, "jump");
  });
  await expect.poll(async () => sky(page).evaluate((el) => !el.shadowRoot!.querySelector<HTMLElement>(".sp-oort")!.hidden), { timeout: 30_000 }).toBe(true);
  expect(await sky(page).evaluate((el) => el.shadowRoot!.querySelector<HTMLElement>(".sp-oort")!.textContent)).toContain("Oort cloud");
  await sky(page).evaluate((el) => Reflect.set(el, "scale", "true"));
  await expect.poll(async () => sky(page).evaluate((el) => el.shadowRoot!.querySelector<HTMLElement>(".sp-oort")!.hidden), { timeout: 30_000 }).toBe(true);
});
