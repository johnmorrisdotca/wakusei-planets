// Help mode's axis line and spin arrow have depth against their own body : by default less of them is drawn over the globe than whole (the axis runs into the near pole and out of the far pole, the part of the
// arrow behind the globe is hidden), and `help-through` brings back the whole lines. A picture test: the pixels inside the disc that help mode changes, with it off, with depth and whole. Chromium, drawing in software.
import { expect, test } from "@playwright/test";
import { callOn, changedInside, drawn, openSpace, setOn, shot, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

for (const [body, look, scale] of [["mars", "realistic", "true"], ["mars", "painted", "compressed"], ["saturn", "realistic", "true"], ["earth", "realistic", "compressed"]] as const) {
  test(`${body}, ${look}, ${scale} scale: less of the help lines is drawn over the globe by default than whole with help-through`, async ({ page }) => {
    test.setTimeout(180_000);
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}&look=${look}&play=off`);
    await drawn(page, () => callOn(page, "goTo", body, { smooth: false }));
    const off = await shot(page);
    await drawn(page, () => setOn(page, "help", true));
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough")), "depth is the default").toBe(false);
    const depth = await shot(page);
    await drawn(page, () => setOn(page, "helpThrough", true));
    const whole = await shot(page);
    const hidden = await changedInside(page, body, off, depth);
    const full = await changedInside(page, body, off, whole);
    expect(full, `help-through changes ${full} pixels over the ${body}`).toBeGreaterThan(25);
    // with depth, well under two thirds of what the whole lines change: the part of the arrow behind the globe and the axis inside it are gone
    expect(hidden, `with depth help changes ${hidden} pixels over the ${body}, against ${full} whole`).toBeLessThanOrEqual(full * 0.6);
    // the attribute and the property say the same
    await page.locator(SPACE).evaluate((el) => {
      el.setAttribute("help-through", "");
      el.removeAttribute("help-through");
    });
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough"))).toBe(false);
    await page.locator(SPACE).evaluate((el) => el.setAttribute("help-through", ""));
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough"))).toBe(true);
  });
}
