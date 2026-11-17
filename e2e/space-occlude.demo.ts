// A name, a ring or a note behind a nearer body is hidden, not drawn over its disc (MODULES-1404). From the view at Pholus (2026-11-30T06:01Z, the address spaceprogramx.com showed) the centaur is a big dark disc, and
// Jupiter, Mercury and its ring, Halley and the rest were drawn over it as if it were glass. By default (`covered="hide"`) their names fade out and Pholus's own stays; `covered="name"` is the old way. Chromium and WebKit,
// drawing in software where the browser can; every wait is on what the page reports. With SPACE_OCCLUDE_SHOTS set to a folder it writes the two pictures (occlude-before.png, occlude-after.png) there.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { frameAt, groundDirection, placeBodies } from "../src/space/index.ts";
import { callOn, drawnAtRest, openSpace, quiet, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });

interface Place {
  x: number;
  y: number;
  r: number;
  behind?: string;
}
const placesOf = (page: Page): Promise<Record<string, Place | null>> =>
  page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { placeOf(id: string): Place | null; bodyList(): { id: string }[] };
    const out: Record<string, Place | null> = {};
    for (const { id } of space.bodyList()) out[id] = space.placeOf(id);
    return out;
  });
/** Each name's button: whether it is shown (not `hidden`, not faded out) and how strong it reads now. */
const namesOf = (page: Page): Promise<Record<string, { shown: boolean; opacity: number }>> =>
  page.locator(SPACE).evaluate((el) => {
    const out: Record<string, { shown: boolean; opacity: number }> = {};
    for (const n of el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-label")) out[n.dataset["body"]!] = { shown: !n.hidden && !n.hasAttribute("data-carried"), opacity: n.hidden ? 0 : Number(getComputedStyle(n).opacity) };
    return out;
  });
const shot = async (page: Page, name: string): Promise<void> => {
  const dir = process.env["SPACE_OCCLUDE_SHOTS"];
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.png`, await page.locator(SPACE).screenshot());
};

/** At Pholus: turn the view round it until some body is behind its disc, and say which. */
async function behindPholus(page: Page): Promise<string[]> {
  for (const yaw of [null, 40, 80, 120, 160, 200, 240, 280, 320]) {
    if (yaw !== null) await drawnAtRest(page, () => callOn(page, "setView", { yaw, tilt: 10, zoom: 1 }));
    const places = await placesOf(page);
    const behind = Object.entries(places).filter(([, at]) => at?.behind === "pholus").map(([id]) => id);
    if (behind.length > 0) return behind;
  }
  return [];
}

test("at Pholus the names behind its disc fade out and its own stays; covered=\"name\" is the old way", async ({ page }) => {
  test.setTimeout(300_000);
  await openSpace(page, "t=2026-11-30T06:01Z&play=off&scale=compressed");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "covered")), "hiding is the default").toBe("hide");
  await page.locator(SPACE).evaluate((el) => el.setAttribute("covered", "name"));
  await callOn(page, "goTo", "pholus", { smooth: false });
  await quiet(page);
  const behind = await behindPholus(page);
  expect(behind.length, "some body is behind Pholus's disc").toBeGreaterThan(0);
  const pholus = (await placesOf(page))["pholus"]!;
  expect(pholus.r, "Pholus fills the middle of the picture").toBeGreaterThan(60);
  // the old way: their names are drawn over the disc
  await expect.poll(async () => { const names = await namesOf(page); return behind.some((id) => names[id]?.shown === true); }, { timeout: 30_000 }).toBe(true);
  await shot(page, "occlude-before");
  // the default: they fade out, and Pholus's own name stays
  await page.locator(SPACE).evaluate((el) => el.setAttribute("covered", "hide"));
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "covered"))).toBe("hide");
  await expect.poll(async () => { const names = await namesOf(page); return behind.every((id) => (names[id]?.opacity ?? 0) === 0); }, { timeout: 30_000, message: "every name behind Pholus is faded out" }).toBe(true);
  const names = await namesOf(page);
  expect(names["pholus"]?.shown, "Pholus's own name stays").toBe(true);
  expect(names["pholus"]!.opacity).toBeGreaterThan(0.4);
  await shot(page, "occlude-after");
  // a name that is not behind the disc is not touched
  const open = Object.entries(await placesOf(page)).filter(([id, at]) => at !== null && at.behind === undefined && id !== "pholus").map(([id]) => id);
  for (const id of open) if (names[id]?.shown === true) expect(names[id]!.opacity, `${id} is in the open`).toBeGreaterThan(0.3);
});

test("coveredAt names the body whose disc hides a point: behind Pholus's disc, not beside it, not in front of it", async ({ page }) => {
  test.setTimeout(300_000);
  await openSpace(page, "t=2026-11-30T06:01Z&play=off&scale=compressed");
  await callOn(page, "goTo", "pholus", { smooth: false });
  await quiet(page);
  const stats = (await statsOf(page)) as unknown as { camera: { position: [number, number, number]; forward: [number, number, number]; up: [number, number, number]; fov: number } };
  const { position, forward, up, fov } = stats.camera;
  const size = await page.locator(SPACE).evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight }));
  const right: [number, number, number] = [forward[1] * up[2] - forward[2] * up[1], forward[2] * up[0] - forward[0] * up[2], forward[0] * up[1] - forward[1] * up[0]];
  const focal = size.height / 2 / Math.tan((fov / 2) * (Math.PI / 180));
  /** The point `depth` along the line of sight through the screen place (x, y): what a page's label at that place and depth is. */
  const through = (x: number, y: number, depth: number): [number, number, number] =>
    [0, 1, 2].map((i) => position[i]! + forward[i]! * depth + right[i]! * (((x - size.width / 2) / focal) * depth) + up[i]! * (((size.height / 2 - y) / focal) * depth)) as [number, number, number];
  const at = (point: [number, number, number]) => page.locator(SPACE).evaluate((el, p) => (el as unknown as { coveredAt(point: [number, number, number]): string | null }).coveredAt(p), point);
  const place = (await placesOf(page))["pholus"]!;
  expect(place.r).toBeGreaterThan(60);
  // a long way behind the middle of Pholus's disc: hidden by it
  expect(await at(through(place.x, place.y, 1e7))).toBe("pholus");
  expect(await at(through(place.x + place.r * 0.8, place.y, 1e7))).toBe("pholus");
  // the same depth, outside its edge: in the open
  expect(await at(through(place.x + place.r * 1.2, place.y, 1e7))).toBeNull();
  // in front of it, between the camera and the disc: in the open
  expect(await at(through(place.x, place.y, 1e-3))).toBeNull();
  // the Oort cloud's note, which hangs on the same discs (here it sits inside Pholus's disc), is faded out or not drawn
  const note = await page.locator(SPACE).evaluate((el) => {
    const n = el.shadowRoot!.querySelector<HTMLElement>(".sp-oort")!;
    return { hidden: n.hidden, covered: n.hasAttribute("data-covered") };
  });
  expect(note.hidden || note.covered, "the note is not over Pholus's disc").toBe(true);
});

test("a move asked for before the first draw arrives on the lit side, as every other arrival does", async ({ page }) => {
  test.setTimeout(300_000);
  // 14:01 UTC: the side the default aim looks from is Pholus's night (2 per cent lit); the way in from the Earth is its day
  const when = Date.UTC(2026, 10, 30, 14, 1);
  await page.addInitScript(COUNT_SCRIPT);
  // as soon as the page's own script has run, before the view has drawn once: the way an address that opens at a body goes. The side is told in `wakusei-hop`: the controls' yaw and tilt, which the view aims by
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      const space = document.querySelector("wakusei-space") as unknown as EventTarget & { goTo(id: string, options: object): boolean; stats: { draws: number } };
      Reflect.set(window, "__drawsAtMove", space.stats.draws);
      space.addEventListener("wakusei-hop", (event) => Reflect.set(window, "__hop", (event as CustomEvent).detail));
      space.goTo("pholus", { smooth: false });
    });
  });
  await page.goto("/wakusei-planets/space.html?t=2026-11-30T14:01Z&play=off");
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  expect(await page.evaluate(() => Reflect.get(window, "__drawsAtMove")), "the move was asked for before the first draw").toBe(0);
  const hop = (await page.evaluate(() => Reflect.get(window, "__hop"))) as { yaw?: number; tilt?: number } | undefined;
  expect(typeof hop?.yaw, "the move says which side it comes from").toBe("number");
  expect(typeof hop?.tilt).toBe("number");
  // the view aims along the ground direction of (longitude - yaw, latitude - tilt) from the body (the camera's default centre is 0, 0): the lit share of Pholus from there
  const aim = groundDirection(0 - hop!.yaw!, 0 - hop!.tilt!, when);
  const placed = placeBodies("true", frameAt(when));
  const toSun = [0, 1, 2].map((i) => placed.sun[i]! - placed.pholus[i]!);
  const lit = (1 + (aim[0] * toSun[0]! + aim[1] * toSun[1]! + aim[2] * toSun[2]!) / Math.hypot(...toSun)) / 2;
  expect(lit, `Pholus is ${(lit * 100).toFixed(0)} per cent lit from the side the move chose`).toBeGreaterThanOrEqual(0.5);
});
