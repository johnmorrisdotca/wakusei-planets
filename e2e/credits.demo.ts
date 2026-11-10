// The credits: every page of the demo links to every credit without opening a menu, and says in a line where its numbers come from. The family pages carry the link in the footer, the code builder in its own footer,
// and the bare frame made for an iframe in a corner of its own, which must not cover a button, on a phone or on a desk.
import { expect, test } from "@playwright/test";

const NOTICE = "https://github.com/johnmorrisdotca/wakusei-planets/blob/main/NOTICE.md";
const PAGES = ["", "portrait.html", "kids.html", "lineup.html", "star.html", "space.html"];
const FRAMES = ["embed.html?body=saturn&look=line", "embed.html?lineup=1&stars=bright&look=line", "embed.html?star=Betelgeuse&temperature-k=3600&radius-sun=764&look=line", "embed.html?body=jupiter&look=line&moons=1&time=2026-11-02T12:00Z"];

for (const lang of ["en", "ja"] as const) {
  for (const path of PAGES) {
    test(`${path || "the home page"} in ${lang} shows its credits in the footer`, async ({ page }) => {
      await page.goto(`/wakusei-planets/${path}${path.includes("?") ? "&" : "?"}lang=${lang}`);
      const footer = page.locator("footer");
      await expect(footer.locator('[data-say="foot"]')).toContainText(lang === "ja" ? "出典の一覧にある論文" : "the papers named in the credits");
      const all = footer.locator(`a[href="${NOTICE}"]`);
      await expect(all).toBeVisible();
      await expect(all).toContainText(lang === "ja" ? "出典" : "credit");
    });
  }
  for (const path of FRAMES) {
    test(`${path} in ${lang} names its sources in a corner that covers no button`, async ({ page }) => {
      await page.goto(`/wakusei-planets/${path}&lang=${lang}`);
      const credit = page.getByTestId("frame-credit");
      await expect(credit).toBeVisible();
      await expect(credit).toContainText(lang === "ja" ? "出典の一覧" : "All credits");
      await expect(credit).toHaveAttribute("href", NOTICE);
      // The bar of buttons is added once the picture has drawn: look at the buttons only after it is there.
      if (!path.includes("lineup")) await page.locator("kazoku-view-controls").waitFor();
      const box = (await credit.boundingBox())!;
      const size = page.viewportSize()!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      for (const button of await page.locator("button").all()) {
        const other = await button.boundingBox();
        if (other !== null) expect(box.y + box.height <= other.y || other.y + other.height <= box.y || box.x + box.width <= other.x || other.x + other.width <= box.x, "the credit covers a button").toBe(true);
      }
    });
  }
}

test("the code builder links to every credit and back to the demo, in its footer", async ({ page }) => {
  await page.goto("/wakusei-planets/builder.html");
  const footer = page.locator("footer");
  await expect(footer.locator(`a[href="${NOTICE}"]`)).toBeVisible();
  await expect(footer.locator('a[href="./"]')).toBeVisible();
});
