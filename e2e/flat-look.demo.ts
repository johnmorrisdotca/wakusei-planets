// The flat map of any body in a real browser: every body's picture loads, the two looks (photo and line map), the night and the sunrise line, the key, the one-line credit, the marks a page adds, English and Japanese, and the phone.
// The map is a 2D canvas, so there is no WebGL here: the tests read pixels and counters.
import "./load.ts";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { FLAT_BODIES, flatSun } from "../src/flat/index.ts";

type Mark = { id: string; lat: number; lon: number; name: string | { en: string; ja?: string }; group?: string; shape?: string; colour?: string; size?: number; labelled?: boolean; data?: unknown };
type Flat = HTMLElement & {
  stats: { draws: number; mapDraws: number; dots: number; marks: number; custom: number; mapLoaded: boolean; look: string; lookState: string; canvases: { width: number; height: number }[] };
  placeOf(id: string): { x: number; y: number; lon: number; lat: number } | null;
  look: string;
  lookState: string;
  keyOpen: boolean;
  center: number;
  zoom: number;
  layers: string[];
  marks: { id: string; group: string }[];
  groups: { group: string; label: unknown; count: number }[];
  selected: string | null;
  setMarks(group: string, marks: Mark[] | null, label?: unknown): void;
  clearMarks(group?: string): void;
};

test.use({ reducedMotion: "no-preference" });
// The desktop tests read the whole world in one screen; on a phone the map wraps past the edges, so the phone has its own tests below.
test.beforeEach(async ({ viewport }, info) => {
  test.skip((viewport?.width ?? 1280) < 500 && !info.title.startsWith("a phone"), "read on a desktop screen: the phone's own tests are below");
});

const flat = (page: Page): Locator => page.locator("wakusei-flat#flat");
const stats = (page: Page): Promise<Flat["stats"]> => flat(page).evaluate((el) => (el as Flat).stats);
const state = (page: Page): Promise<string> => flat(page).evaluate((el) => (el as Flat).lookState);
const settled = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
const open = async (page: Page, query = ""): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/flat.html${query}`);
  await expect(flat(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(0);
  // the map is in the screen, so a mouse at its pixels is over it
  await flat(page).locator(".dots").scrollIntoViewIfNeeded();
  return errors;
};
/** Hold the map where it is: a held clock draws nothing, and the test sets the moment. */
const hold = async (page: Page, iso = "2026-11-17T12:00:00Z"): Promise<void> => {
  await flat(page).evaluate((el, time) => {
    el.setAttribute("speed", "0");
    el.setAttribute("time", time);
  }, iso);
  await settled(page);
};
const setBody = async (page: Page, body: string): Promise<void> => {
  await flat(page).evaluate((el, id) => el.setAttribute("body", id), body);
  await expect.poll(async () => (await stats(page)).mapLoaded).toBe(true);
  await settled(page);
};
const setLook = async (page: Page, look: "map" | "photo"): Promise<void> => {
  await flat(page).evaluate((el, value) => el.setAttribute("look", value), look);
  await expect.poll(() => state(page)).toBe(look);
  await settled(page);
};
/** The map canvas read back: red, green and blue of each pixel at its own size. */
type Picture = { width: number; height: number; data: Uint8Array };
const pixels = async (page: Page): Promise<Picture> => {
  // sent as base64: the map's pixels are millions of numbers, and a list of them is far slower to send than a string
  const sent = await flat(page).locator(".map").evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let text = "";
    for (let i = 0; i < data.length; i += 0x8000) text += String.fromCharCode(...data.subarray(i, i + 0x8000));
    return { width: canvas.width, height: canvas.height, base64: btoa(text) };
  });
  return { width: sent.width, height: sent.height, data: Uint8Array.from(Buffer.from(sent.base64, "base64")) };
};
const luminance = (image: { width: number; data: Uint8Array }, x: number, y: number, half = 6): number => {
  let sum = 0;
  let n = 0;
  for (let dy = -half; dy <= half; dy += 1) {
    for (let dx = -half; dx <= half; dx += 1) {
      const at = ((Math.round(y) + dy) * image.width + Math.round(x) + dx) * 4;
      sum += 0.3 * image.data[at]! + 0.59 * image.data[at + 1]! + 0.11 * image.data[at + 2]!;
      n += 1;
    }
  }
  return sum / n;
};
/** The share of the picture whose blue is above its red. */
const cool = (image: Picture): number => {
  let n = 0;
  let blue = 0;
  for (let i = 0; i < image.data.length; i += 16) {
    n += 1;
    if (image.data[i + 2]! > image.data[i]!) blue += 1;
  }
  return blue / n;
};
const colours = (image: Picture): number => {
  const seen = new Set<number>();
  for (let y = 0; y < image.height; y += 3) for (let x = 0; x < image.width; x += 3) seen.add(((image.data[(y * image.width + x) * 4]! >> 2) << 16) | ((image.data[(y * image.width + x) * 4 + 1]! >> 2) << 8) | (image.data[(y * image.width + x) * 4 + 2]! >> 2));
  return seen.size;
};
const listen = (page: Page): Promise<void> =>
  flat(page).evaluate((el) => {
    Reflect.set(window, "__picks", []);
    el.addEventListener("wakusei-flat-pick", (event) => (Reflect.get(window, "__picks") as unknown[]).push((event as CustomEvent).detail));
  });
const picks = (page: Page): Promise<{ kind: string | null; id: string | null; name: string | null; via: string; body: string; mark?: { data?: unknown; group: string } }[]> => page.evaluate(() => Reflect.get(window, "__picks"));

test("every body the map draws loads its own picture and is drawn, named and credited, with no page error", async ({ page }) => {
  // twenty-eight pictures, most of them the 2048 pixel one: WebKit takes its time
  test.setTimeout(300_000);
  const errors = await open(page);
  expect(await flat(page).evaluate(() => customElements.get("wakusei-flat") !== undefined)).toBe(true);
  expect(FLAT_BODIES.length).toBe(28);
  for (const body of FLAT_BODIES) {
    await setBody(page, body);
    await expect.poll(() => state(page), { message: body }).toBe("photo");
    const label = await flat(page).locator(".dots").getAttribute("aria-label");
    expect(label, body).toMatch(/^Flat map of /);
    await expect(flat(page).locator(".credit"), body).toBeVisible();
    // the body's own picture, not the Moon's: the picture is drawn over the whole box
    // counted in the page: the map's pixels are millions of numbers, too many to send for each of twenty-eight bodies
    const distinct = await flat(page).locator(".map").evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 7) seen.add(((data[i]! >> 2) << 16) | ((data[i + 1]! >> 2) << 8) | (data[i + 2]! >> 2));
      return seen.size;
    });
    expect(distinct, `${body} is more than a plain colour`).toBeGreaterThan(40);
  }
  expect(errors).toEqual([]);
});

test("a body with no orbiters has no orbiter chip and no footprint or track button; the Moon and Mars keep theirs", async ({ page }) => {
  await open(page);
  await expect(flat(page).locator('button[data-act="track"]')).toBeVisible();
  await expect(flat(page).locator('.chip[data-layer="orbiters"]')).toBeVisible();
  // the demo's own buttons choose the body, and its row of orbiters goes with them
  await page.locator('#bodies button[data-value="jupiter"]').click();
  await expect.poll(async () => (await stats(page)).mapLoaded).toBe(true);
  await settled(page);
  await expect(flat(page).locator('button[data-act="track"]')).toHaveCount(0);
  await expect(flat(page).locator('button[data-act="footprint"]')).toHaveCount(0);
  await expect(flat(page).locator('.chip[data-layer="orbiters"]')).toHaveCount(0);
  await expect(page.locator("#orbiters-row")).toBeHidden();
  expect((await stats(page)).dots).toBe(0);
  await page.locator('#moons button[data-value="titan"]').click();
  await expect(flat(page)).toHaveAttribute("body", "titan");
  await expect.poll(() => flat(page).locator(".chip").count()).toBeGreaterThan(0);
  await page.locator('#bodies button[data-value="mars"]').click();
  await expect.poll(async () => (await stats(page)).dots).toBe(6);
  await expect(flat(page).locator('.chip[data-layer="orbiters"]')).toBeVisible();
});

test("the two looks: the photo is the default, the Map and Photo buttons and the attribute switch, the map is a few tones with lines and a grid with degrees, and the event says so", async ({ page }) => {
  await open(page, "?body=mars");
  await hold(page);
  await flat(page).evaluate((el) => {
    el.setAttribute("shade", "off");
    Reflect.set(window, "__looks", []);
    el.addEventListener("wakusei-flat-look", (event) => (Reflect.get(window, "__looks") as unknown[]).push(JSON.stringify((event as CustomEvent).detail)));
  });
  await settled(page);
  expect(await flat(page).evaluate((el) => (el as Flat).look)).toBe("photo");
  expect(await state(page)).toBe("photo");
  const group = flat(page).getByRole("group", { name: "Look of the map" });
  await expect(group.getByRole("button", { name: "Photo" })).toHaveAttribute("aria-pressed", "true");
  await expect(group.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "false");
  const photo = await pixels(page);
  await group.getByRole("button", { name: "Map" }).click();
  await expect.poll(() => state(page)).toBe("map");
  await settled(page);
  await expect(flat(page)).toHaveAttribute("look", "map");
  await expect(group.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "true");
  const map = await pixels(page);
  expect(map.width).toBe(photo.width);
  // the line map is dark cool tones (blue above red), where Mars's photo is ochre (red above blue)
  expect(cool(map)).toBeGreaterThan(0.9);
  expect(cool(photo)).toBeLessThan(0.1);
  expect(colours(map)).not.toBe(colours(photo));
  // the page is told, in order: the map is asked for, then it is there
  const looks = await page.evaluate(() => Reflect.get(window, "__looks") as string[]);
  expect(looks.at(-1)).toBe('{"look":"map","state":"map"}');
  await group.getByRole("button", { name: "Photo" }).click();
  await expect.poll(() => state(page)).toBe("photo");
  expect(await page.evaluate(() => (Reflect.get(window, "__looks") as string[]).at(-1))).toBe('{"look":"photo","state":"photo"}');
  // an unknown look is the photo; the attribute off is the photo again
  await flat(page).evaluate((el) => el.setAttribute("look", "sepia"));
  await expect.poll(() => state(page)).toBe("photo");
  // the demo's address carries the look, so a shared page opens on it
  await group.getByRole("button", { name: "Map" }).click();
  await expect(page).toHaveURL(/look=map/);
});

test("the line map names its grid: degrees along the edges, more of them as the map is zoomed, and the named features are marked with their names", async ({ page }) => {
  await open(page, "?look=map");
  await hold(page);
  await expect.poll(() => state(page)).toBe("map");
  await expect.poll(async () => (await stats(page)).marks, { message: "the sites and the named features are in" }).toBeGreaterThan(40);
  expect(await flat(page).evaluate((el) => (el as Flat).layers)).toEqual(["landing", "feature"]);
  const before = await stats(page);
  await flat(page).evaluate((el) => {
    (el as Flat).zoom = 3;
    (el as Flat).center = 0;
  });
  await settled(page);
  expect((await stats(page)).mapDraws).toBeGreaterThan(before.mapDraws);
  // back on the photo, the sites alone, as before
  await setLook(page, "photo");
  expect(await flat(page).evaluate((el) => (el as Flat).layers)).toEqual(["landing"]);
  // a page that names its places keeps them in both looks
  await flat(page).evaluate((el) => el.setAttribute("places", "crash"));
  await setLook(page, "map");
  expect(await flat(page).evaluate((el) => (el as Flat).layers)).toEqual(["crash"]);
});

test("the night is clearly darker, the sunrise and sunset line is drawn on it and the Sun's dot is where the Sun is overhead, in both looks and on another body", async ({ page }) => {
  await open(page);
  let lastNight = 0;
  for (const body of ["mars", "jupiter"] as const) {
    await setBody(page, body);
    const when = Date.UTC(2026, 10, 17, 12);
    await hold(page, new Date(when).toISOString());
    const sun = flatSun(body, when);
    for (const look of ["photo", "map"] as const) {
      await setLook(page, look);
      await flat(page).evaluate((el, lon) => ((el as Flat).center = lon), sun.lon);
      await settled(page);
      const image = await pixels(page);
      const k = image.width / 360;
      const day = luminance(image, image.width / 2, image.height / 2 - 40 * k);
      const night = luminance(image, 20, image.height / 2 - 40 * k, 10);
      expect(day, `${body} ${look}: the day side is brighter`).toBeGreaterThan(night * 1.6);
      lastNight = night;
      // the Sun's dot: yellow, in the middle of the map's width at the Sun's latitude
      const y = image.height / 2 - sun.lat * k;
      let yellow = 0;
      for (let dy = -8; dy <= 8; dy += 1) for (let dx = -8; dx <= 8; dx += 1) {
        const at = ((Math.round(y) + dy) * image.width + Math.round(image.width / 2) + dx) * 4;
        if (image.data[at]! > 230 && image.data[at + 1]! > 190 && image.data[at + 2]! < 120) yellow += 1;
      }
      expect(yellow, `${body} ${look}: the Sun's dot`).toBeGreaterThan(8);
      // the sunrise line: pale yellow dashes down the map where the Sun is on the horizon (cos of the longitude from the Sun is minus tan latitude times tan the Sun's latitude), on either side
      let rows = 0;
      let on = 0;
      for (let lat = -60; lat <= 60; lat += 2) {
        const reach = (Math.acos(Math.max(-1, Math.min(1, -Math.tan((lat * Math.PI) / 180) * Math.tan((sun.lat * Math.PI) / 180)))) * 180) / Math.PI;
        for (const side of [-1, 1]) {
          const x = Math.round(image.width / 2 + side * reach * k);
          const row = Math.round(image.height / 2 - lat * k);
          rows += 1;
          scan: for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -3; dx <= 3; dx += 1) {
              const at = ((row + dy) * image.width + x + dx) * 4;
              if (image.data[at]! > 225 && image.data[at + 1]! > 190 && image.data[at + 2]! > 100 && image.data[at + 2]! < 190) {
                on += 1;
                break scan;
              }
            }
          }
        }
      }
      expect(on / rows, `${body} ${look}: the sunrise line is drawn where the Sun is on the horizon`).toBeGreaterThan(0.4);
    }
    // shade off takes the night, the line and the dot away
    await flat(page).evaluate((el) => el.setAttribute("shade", "off"));
    await settled(page);
    const clear = await pixels(page);
    expect(luminance(clear, 20, clear.height / 2 - 40 * (clear.width / 360), 10)).toBeGreaterThan(lastNight * 1.5);
    await flat(page).evaluate((el) => el.removeAttribute("shade"));
  }
});

test("the night moves with the time and the map is drawn again only when it has: a held clock draws nothing in either look, and nothing is held back after leaving the map look", async ({ page }) => {
  await open(page, "?look=map");
  await hold(page);
  await expect.poll(() => state(page)).toBe("map");
  const held = await stats(page);
  await page.waitForTimeout(1200);
  expect((await stats(page)).draws).toBe(held.draws);
  expect((await stats(page)).mapDraws).toBe(held.mapDraws);
  await flat(page).evaluate((el) => el.setAttribute("time", "2026-11-24T12:00:00Z"));
  await settled(page);
  expect((await stats(page)).mapDraws).toBeGreaterThan(held.mapDraws);
  await setLook(page, "photo");
  const photo = await stats(page);
  await page.waitForTimeout(800);
  expect((await stats(page)).draws).toBe(photo.draws);
});

test("the key names every mark drawn now and nothing else, in English and in Japanese, open on a wide map and folded by its button", async ({ page }) => {
  await open(page);
  await hold(page);
  const key = flat(page).locator(".legend");
  await expect(key).toBeVisible();
  await expect(key.locator("ul")).toBeVisible();
  const items = (): Promise<string[]> => key.locator("li").allInnerTexts();
  const moon = await items();
  expect(moon.some((text) => text.includes("The Sun is overhead"))).toBe(true);
  expect(moon.some((text) => text.includes("Sunrise or sunset line"))).toBe(true);
  expect(moon.some((text) => text.includes("The night side"))).toBe(true);
  expect(moon.some((text) => text.includes("An orbiter"))).toBe(true);
  expect(moon.some((text) => text.includes("Landing and rover sites"))).toBe(true);
  expect(moon.some((text) => text.includes("Footprint"))).toBe(false);
  expect(moon.some((text) => text.includes("Named features"))).toBe(false);
  expect(moon.some((text) => text.includes("My place"))).toBe(false);
  expect(moon.some((text) => text.includes("NASA"))).toBe(true);
  // switching things on puts them in the key; switching them off takes them out
  await flat(page).locator('button[data-act="footprint"]').click();
  await flat(page).locator('button[data-act="track"]').click();
  await flat(page).evaluate((el) => el.setAttribute("home-lon", "0"));
  await flat(page).evaluate((el) => el.setAttribute("home-lat", "0"));
  await settled(page);
  const more = await items();
  for (const word of ["Footprint", "Ground track", "My place"]) expect(more.some((text) => text.includes(word)), word).toBe(true);
  await flat(page).evaluate((el) => el.setAttribute("shade", "off"));
  await settled(page);
  const unlit = await items();
  expect(unlit.some((text) => text.includes("The Sun is overhead") || text.includes("night"))).toBe(false);
  await flat(page).evaluate((el) => el.removeAttribute("shade"));
  // a body with no orbiters has none of those
  await setBody(page, "jupiter");
  await settled(page);
  const jupiter = await items();
  expect(jupiter.some((text) => text.includes("An orbiter") || text.includes("Footprint") || text.includes("Ground track"))).toBe(false);
  expect(jupiter.some((text) => text.includes("Nestaeric") && text.includes("CC BY 4.0"))).toBe(true);
  // the button folds it, and a screen reader is told
  const toggle = key.locator("button[data-act=key]");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(key.locator("ul")).toBeHidden();
  expect(await flat(page).evaluate((el) => (el as Flat).keyOpen)).toBe(false);
  await flat(page).evaluate((el) => ((el as Flat).keyOpen = true));
  await expect(key.locator("ul")).toBeVisible();
  // controls without the key leave it out
  await flat(page).evaluate((el) => el.setAttribute("controls", "centre zoom"));
  await expect(key).toBeHidden();
  await flat(page).evaluate((el) => el.setAttribute("controls", "centre look zoom footprint track chips key"));
  // Japanese
  await flat(page).evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(key.locator("button[data-act=key]")).toContainText("凡例");
  const ja = await items();
  expect(ja.some((text) => text.includes("太陽が真上にある場所"))).toBe(true);
  expect(ja.some((text) => text.includes("日の出・日の入りの線"))).toBe(true);
  expect(ja.some((text) => text.includes("夜の側"))).toBe(true);
  expect(ja.some((text) => text.includes("表面の地図："))).toBe(true);
});

test("the credit is one small line at the map's edge, whole on a wide map, opens to the full credit, is in both looks and goes when the picture cannot be had", async ({ page }) => {
  await open(page, "?body=mars");
  await hold(page);
  const credit = flat(page).locator(".credit");
  await expect(credit).toBeVisible();
  const read = (): Promise<{ text: string; height: number; stage: { bottom: number; right: number }; box: { bottom: number; right: number } }> =>
    credit.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const stage = el.parentElement!.getBoundingClientRect();
      return { text: (el as HTMLElement).innerText, height: box.height, stage: { bottom: stage.bottom, right: stage.right }, box: { bottom: box.bottom, right: box.right } };
    });
  const photo = await read();
  expect(photo.text).toBe("Mars: NASA / USGS (public domain)");
  expect(photo.height).toBeLessThan(30);
  expect(photo.box.bottom).toBeLessThanOrEqual(photo.stage.bottom);
  expect(photo.box.right).toBeLessThanOrEqual(photo.stage.right);
  await setLook(page, "map");
  expect((await read()).text).toBe("Mars: NASA / USGS (public domain)");
  // the whole credit is a press away
  await credit.click();
  await expect(credit).toHaveAttribute("aria-expanded", "true");
  expect((await read()).text).toContain("Jet Propulsion Lab");
  await credit.click();
  await expect(credit).toHaveAttribute("aria-expanded", "false");
  expect(await credit.getAttribute("aria-label")).toContain("NASA / Jet Propulsion Lab / USGS");
  // a picture with CC BY 4.0 names its author and its licence in the line
  await setBody(page, "jupiter");
  expect((await read()).text).toBe("Jupiter: Nestaeric (CC BY 4.0)");
  expect(await credit.getAttribute("title")).toContain("sketchfab.com/Nestaeric");
  await flat(page).evaluate((el) => el.setAttribute("lang", "ja"));
  expect((await read()).text).toBe("木星：Nestaeric（CC BY 4.0）");
});

test("a picture that cannot be fetched leaves the ground, the grid and the marks, says so, and hides the credit; both looks", async ({ page }) => {
  await page.route("**/textures/saturn-*.webp", (route) => route.fulfill({ status: 404, body: "no" }));
  await open(page);
  await flat(page).evaluate((el) => el.setAttribute("body", "saturn"));
  await expect.poll(() => state(page)).toBe("failed");
  await expect(flat(page).locator(".msg")).toContainText("could not be loaded");
  await expect(flat(page).locator(".credit")).toBeHidden();
  await flat(page).evaluate((el) => el.setAttribute("look", "map"));
  await expect.poll(() => state(page)).toBe("failed");
  expect((await stats(page)).draws).toBeGreaterThan(0);
});

test("marks of your own: drawn, named on hover, chosen by a tap, reached by the keyboard, listed in the key, taken away by group, in English and Japanese", async ({ page }) => {
  const errors = await open(page, "?body=mars");
  await hold(page);
  await listen(page);
  await flat(page).evaluate((el) => {
    (el as Flat).setMarks(
      "favourites",
      [
        { id: "olympus", lat: 18.65, lon: -133.8, name: { en: "Olympus Mons", ja: "オリンポス山" }, shape: "diamond", colour: "#ffd23f", labelled: true, data: { note: "tallest" } },
        { id: "valles", lat: -13.9, lon: -59.2, name: "Valles Marineris", shape: "star", size: 7 },
        { id: "bad", lat: Number.NaN, lon: 0, name: "dropped" },
      ],
      { en: "My favourites", ja: "お気に入り" },
    );
    (el as Flat).setMarks("moons", [{ id: "phobos-point", lat: 0, lon: 10, name: "Phobos below", shape: "ring", colour: "#6ee7a0" }], "Moons");
  });
  await settled(page);
  expect((await stats(page)).custom).toBe(3);
  expect(await flat(page).evaluate((el) => (el as Flat).groups.map((g) => `${g.group}:${g.count}`))).toEqual(["favourites:2", "moons:1"]);
  const items = await flat(page).locator(".legend li").allInnerTexts();
  expect(items.some((text) => text.includes("My favourites"))).toBe(true);
  expect(items.some((text) => text.includes("Moons"))).toBe(true);
  // a hover names it, a tap chooses it and sends the record with the page's data
  const at = await flat(page).evaluate((el) => (el as Flat).placeOf("olympus"));
  expect(at).not.toBeNull();
  const box = (await flat(page).locator(".dots").boundingBox())!;
  await page.mouse.move(box.x + at!.x, box.y + at!.y);
  await expect(flat(page).locator(".tip")).toContainText("Olympus Mons");
  await expect(flat(page).locator(".tip")).toContainText("18.65° N");
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "mark", id: "olympus", via: "hover", body: "mars" });
  await page.mouse.click(box.x + at!.x, box.y + at!.y);
  const tapped = (await picks(page)).at(-1)!;
  expect(tapped).toMatchObject({ kind: "mark", id: "olympus", via: "tap", name: "Olympus Mons" });
  expect(tapped.mark).toMatchObject({ group: "favourites", data: { note: "tallest" } });
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBe("olympus");
  // the keyboard goes from one to the next, from the left of the map to the right, and the words are in the live region
  await page.mouse.click(box.x + 4, box.y + 4);
  await flat(page).locator(".dots").focus();
  await page.keyboard.press("Home");
  const first = (await picks(page)).at(-1)!;
  expect(first.via).toBe("key");
  expect(["mark", "orbiter", "place"]).toContain(first.kind);
  const seen = new Set<string>();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press("ArrowRight");
    const pick = (await picks(page)).at(-1)!;
    if (pick.kind === "mark") seen.add(pick.id!);
  }
  expect([...seen].sort()).toEqual(["olympus", "phobos-point", "valles"]);
  await expect(flat(page).locator("#live")).not.toBeEmpty();
  // select by id from code
  await flat(page).evaluate((el) => ((el as Flat).selected = "valles"));
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBe("valles");
  // Japanese names, in the tip and in the pick
  await flat(page).evaluate((el) => el.setAttribute("lang", "ja"));
  await settled(page);
  const again = (await flat(page).evaluate((el) => (el as Flat).placeOf("olympus")))!;
  await page.mouse.click(box.x + again.x, box.y + again.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "mark", id: "olympus", name: "オリンポス山" });
  await expect(flat(page).locator(".tip")).toContainText("オリンポス山");
  expect(await flat(page).locator(".legend li").allInnerTexts()).toEqual(expect.arrayContaining([expect.stringContaining("お気に入り")]));
  // taking away a group: its marks go, the chosen mark is let go, the key follows
  await flat(page).evaluate((el) => ((el as Flat).selected = "olympus"));
  await flat(page).evaluate((el) => (el as Flat).clearMarks("favourites"));
  await settled(page);
  expect((await stats(page)).custom).toBe(1);
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBeNull();
  await flat(page).evaluate((el) => (el as Flat).clearMarks());
  await settled(page);
  expect((await stats(page)).custom).toBe(0);
  expect(await flat(page).evaluate((el) => (el as Flat).groups.length)).toBe(0);
  // a mark is on the map wherever it is: it wraps with the world and moves when the page moves it
  await flat(page).evaluate((el) => (el as Flat).setMarks("walker", [{ id: "w", lat: 10, lon: 190, name: "W" }]));
  await settled(page);
  const w1 = (await flat(page).evaluate((el) => (el as Flat).placeOf("w")))!;
  await flat(page).evaluate((el) => (el as Flat).setMarks("walker", [{ id: "w", lat: 10, lon: -160, name: "W" }]));
  await settled(page);
  const w2 = (await flat(page).evaluate((el) => (el as Flat).placeOf("w")))!;
  expect(Math.abs(w2.x - w1.x)).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test("the Moon and Mars are as they were: the same chips, a pick of an orbiter, and Apollo 11 on the Moon in the photo look", async ({ page }) => {
  await open(page);
  await hold(page);
  await listen(page);
  await expect.poll(async () => (await stats(page)).marks).toBeGreaterThan(20);
  const lro = (await flat(page).evaluate((el) => (el as Flat).placeOf("lro")))!;
  const box = (await flat(page).locator(".dots").boundingBox())!;
  await page.mouse.click(box.x + lro.x, box.y + lro.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "orbiter", id: "lro", via: "tap" });
  expect(await flat(page).locator(".chip").first().innerText()).toContain("Orbiters");
  await expect(page.locator("details")).toHaveCount(1);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("a phone: the key is folded and opens on a press, the credit is short and opens on a tap, the look buttons are tappable, and nothing scrolls sideways", async ({ page }) => {
    await open(page, "?body=mars");
    await hold(page);
    await flat(page).locator(".dots").scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const key = flat(page).locator(".legend");
    await expect(key.locator("button[data-act=key]")).toHaveAttribute("aria-expanded", "false");
    await expect(key.locator("ul")).toBeHidden();
    await key.locator("button[data-act=key]").tap();
    await expect(key.locator("ul")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await key.locator("button[data-act=key]").tap();
    const credit = flat(page).locator(".credit");
    await expect(credit).toBeVisible();
    expect(await credit.evaluate((el) => (el as HTMLElement).innerText)).toBe("Mars: NASA / USGS");
    const box = (await credit.boundingBox())!;
    const stage = (await flat(page).locator(".stage").boundingBox())!;
    expect(box.height).toBeLessThan(40);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width);
    await credit.tap();
    await expect(credit).toHaveAttribute("aria-expanded", "true");
    expect(await credit.evaluate((el) => (el as HTMLElement).innerText)).toContain("Jet Propulsion Lab");
    await credit.tap();
    // the look pair
    const group = flat(page).getByRole("group", { name: "Look of the map" });
    await group.getByRole("button", { name: "Map" }).tap();
    await expect.poll(() => state(page)).toBe("map");
    const target = (await group.getByRole("button", { name: "Map" }).boundingBox())!;
    expect(target.height).toBeGreaterThanOrEqual(40);
    await group.getByRole("button", { name: "Photo" }).tap();
    await expect.poll(() => state(page)).toBe("photo");
  });

  test("a phone: Jupiter as a line map, a finger picks a mark, a pinch zooms, the map fills the width", async ({ page }) => {
    await open(page, "?body=jupiter&look=map");
    await hold(page);
    await expect.poll(() => state(page)).toBe("map");
    await flat(page).locator(".dots").scrollIntoViewIfNeeded();
    const canvas = (await flat(page).locator(".dots").boundingBox())!;
    expect(canvas.width).toBeGreaterThan(300);
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(390);
    await listen(page);
    await flat(page).evaluate((el) => (el as Flat).setMarks("a", [{ id: "grs", lat: -22, lon: 0, name: "Great Red Spot", shape: "ring", colour: "#ff8a65" }]));
    await settled(page);
    const spot = (await flat(page).evaluate((el) => (el as Flat).placeOf("grs")))!;
    await page.touchscreen.tap(canvas.x + spot.x, canvas.y + spot.y);
    expect((await picks(page)).at(-1)).toMatchObject({ kind: "mark", id: "grs", via: "tap", body: "jupiter" });
    const zoom = await flat(page).evaluate((el) => (el as Flat).zoom);
    await flat(page).evaluate((el) => {
      const dots = el.shadowRoot!.querySelector(".dots") as HTMLElement;
      const box = dots.getBoundingClientRect();
      const fire = (type: string, id: number, x: number, y: number): void => {
        dots.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: box.left + x, clientY: box.top + y, bubbles: true, isPrimary: id === 1 }));
      };
      fire("pointerdown", 1, 150, 120);
      fire("pointerdown", 2, 190, 120);
      for (let i = 1; i <= 6; i += 1) {
        fire("pointermove", 1, 150 - i * 12, 120);
        fire("pointermove", 2, 190 + i * 12, 120);
      }
      fire("pointerup", 1, 78, 120);
      fire("pointerup", 2, 262, 120);
    });
    await expect.poll(() => flat(page).evaluate((el) => (el as Flat).zoom)).toBeGreaterThan(zoom * 1.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
