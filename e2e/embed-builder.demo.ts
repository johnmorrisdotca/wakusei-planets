// "Put it in your page": the code follows what is set up above, for every way a page is made, and the picture beside it is made from the same choices.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("the code follows the body, the look, the date, the moons and the size, for each kind of page", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  const code = page.locator("#embed-code");
  await expect(code).toContainText('<wakusei-body body="jupiter" look="line"');
  await expect(code).toContainText("element/+esm");
  await expect(code).not.toContainText("jupiter/+esm");
  await page.locator('#looks [data-look="realistic"]').click();
  await expect(code).toContainText("jupiter/+esm");
  await page.locator("#moons").click();
  await expect(code).toContainText("moons");
  await expect(code).toContainText('time="now"');
  await page.locator('#embed-sizes [data-size="480"]').click();
  await expect(code).toContainText('size="480"');
  for (const [kind, needle] of [["module", 'planet.setAttribute("body", "jupiter")'], ["react", "<wakusei-body body="], ["vue", "<script setup"], ["angular", "CUSTOM_ELEMENTS_SCHEMA"], ["svelte", "onMount"], ["iframe", "embed.html?body=jupiter"]] as const) {
    await page.locator(`#embed-tabs [data-kind="${kind}"]`).click();
    await expect(code, kind).toContainText(needle);
    await expect(page.locator(`#embed-tabs [data-kind="${kind}"]`)).toHaveAttribute("aria-selected", "true");
  }
  await expect(page).toHaveURL(/embed=iframe/);
  await page.locator('.tile[data-body="saturn"]').click();
  await expect(code).toContainText("body=saturn");
});

test("the picture beside the code is made from the same choices, and the iframe tab shows the iframe", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars&size=240`);
  const preview = page.locator("#embed-preview wakusei-body");
  await expect(preview).toHaveAttribute("body", "mars");
  await expect(preview).toHaveAttribute("look", "line");
  await expect(preview).toHaveAttribute("size", "240");
  await page.locator('#embed-tabs [data-kind="iframe"]').click();
  const frame = page.locator("#embed-preview iframe");
  await expect(frame).toHaveAttribute("src", /embed\.html\?body=mars&look=line/);
  await expect(page.locator("#embed-credit")).toContainText("Wakusei Planets");
});

test("copy puts the code on the clipboard, and the tabs answer the arrow keys", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("webkit"), "the clipboard is Chromium's to grant here");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${URL}?look=line&body=saturn`);
  await page.locator("#embed-copy").click();
  await expect(page.locator("#embed-status")).toContainText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('<wakusei-body body="saturn" look="line"');
  await page.locator('#embed-tabs [data-kind="html"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('#embed-tabs [data-kind="module"]')).toHaveAttribute("aria-selected", "true");
});

test("every control in the section is a finger wide", async ({ page }) => {
  await page.goto(`${URL}?look=line`);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("#embed button, #embed a.fam-button")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 47.5 && !el.closest(".fam-seg")) out.push(`${el.textContent?.trim()} is ${Math.round(r.height)} px high`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});
