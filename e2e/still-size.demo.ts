// A still (live="off") is drawn at the size the page asks for with `still-size`, in device pixels (CSS pixels times the device pixel ratio, up to 3), not at the renderer's 160. Chromium, in software.
import "./load.ts";
import { expect, test } from "@playwright/test";

test("still-size sets the sharpness of a still: the picture is as wide as the size asked for times the device pixel ratio, and a plain still stays small", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.goto("/wakusei-planets/?body=mars&look=painted");
  await expect(page.locator("#main")).toHaveAttribute("data-state", /still|live/, { timeout: 90_000 });
  const side = await page.evaluate(() => Math.round(Math.min(3, window.devicePixelRatio || 1) * 480));
  const made = await page.evaluate(async () => {
    const make = (extra: string): HTMLElement => {
      const el = document.createElement("wakusei-body");
      el.setAttribute("body", "mars");
      el.setAttribute("look", "painted");
      el.setAttribute("live", "off");
      el.setAttribute("size", "300");
      if (extra !== "") el.setAttribute("still-size", extra);
      el.style.display = "block";
      el.style.width = "300px";
      el.style.height = "300px";
      document.body.append(el);
      return el;
    };
    const sharp = make("480");
    const plain = make("");
    const widthOf = async (el: HTMLElement): Promise<number> => {
      // a still is made when the element is in sight
      el.scrollIntoView({ block: "center" });
      for (let i = 0; i < 400; i += 1) {
        const img = el.shadowRoot?.querySelector("img") ?? el.querySelector("img");
        if (img !== null && img !== undefined && img.complete && img.naturalWidth > 0) return Math.max(img.naturalWidth, img.naturalHeight);
        await new Promise((done) => setTimeout(done, 100));
      }
      return 0;
    };
    return { attribute: sharp.getAttribute("data-still-size"), sharp: await widthOf(sharp), plain: await widthOf(plain), plainAttribute: plain.getAttribute("data-still-size") };
  });
  expect(made.attribute).toBe(String(side));
  expect(made.plainAttribute).toBeNull();
  expect(made.sharp).toBe(side);
  expect(made.plain).toBeLessThanOrEqual(160);
});

test("a changed still-size makes the still again at the new size", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.goto("/wakusei-planets/?body=mars&look=painted");
  await expect(page.locator("#main")).toHaveAttribute("data-state", /still|live/, { timeout: 90_000 });
  const attributes = await page.evaluate(() => {
    const el = document.createElement("wakusei-body");
    el.setAttribute("live", "off");
    el.setAttribute("still-size", "200");
    document.body.append(el);
    const first = el.getAttribute("data-still-size");
    el.setAttribute("still-size", "400");
    return { first, second: el.getAttribute("data-still-size"), dpr: window.devicePixelRatio || 1 };
  });
  expect(Number(attributes.second)).toBe(Math.round(400 * Math.min(3, attributes.dpr)));
  expect(Number(attributes.first)).toBe(Math.round(200 * Math.min(3, attributes.dpr)));
});
