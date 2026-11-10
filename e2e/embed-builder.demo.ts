// "Put it in your page" is the family's <kazoku-embed-panel>: the code follows what is set up above, for every way a page is made, and the picture beside it is made from the same choices.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("the code follows the body, the look, the date, the moons and the size, for each kind of page", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  const code = page.locator('#embed-panel [part="code"]');
  await expect(code).toContainText('<wakusei-body body="jupiter" look="line"');
  await expect(code).toContainText("element/+esm");
  await expect(code).not.toContainText("jupiter/+esm");
  await page.locator('#looks [data-look="realistic"]').click();
  await expect(code).toContainText("jupiter/+esm");
  await page.locator("#moons").click();
  await expect(code).toContainText("moons");
  await expect(code).toContainText('time="now"');
  await page.locator('#embed-panel button[data-size="480"]').click();
  await expect(code).toContainText('size="480"');
  for (const [kind, needle] of [["module", 'planet.setAttribute("body", "jupiter")'], ["react", "<wakusei-body body="], ["vue", "<script setup"], ["angular", "CUSTOM_ELEMENTS_SCHEMA"], ["svelte", "onMount"], ["iframe", "embed.html?body=jupiter"]] as const) {
    await page.locator(`#embed-panel button[data-kind="${kind}"]`).click();
    await expect(code, kind).toContainText(needle);
    await expect(page.locator(`#embed-panel button[data-kind="${kind}"]`)).toHaveAttribute("aria-selected", "true");
  }
  await expect(page).toHaveURL(/embed=iframe/);
  await page.locator('.pick[data-body="saturn"]').click();
  await expect(code).toContainText("body=saturn");
});

test("the picture beside the code is made from the same choices, and the iframe tab shows the iframe", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars&size=240`);
  const preview = page.locator('#embed-panel [part="preview"] wakusei-body');
  await expect(preview).toHaveAttribute("body", "mars");
  await expect(preview).toHaveAttribute("look", "line");
  await expect(preview).toHaveAttribute("size", "240");
  await page.locator('#embed-panel button[data-kind="iframe"]').click();
  const frame = page.locator('#embed-panel [part="preview"] iframe');
  await expect(frame).toHaveAttribute("src", /embed\.html\?body=mars&look=line/);
  await expect(page.locator('#embed-panel [part="credits"]')).toContainText("Wakusei Planets");
});

test("copy puts the code on the clipboard, and the tabs answer the arrow keys", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("webkit"), "the clipboard is Chromium's to grant here");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${URL}?look=line&body=saturn`);
  await page.locator('#embed-panel [part="copy"]').click();
  await expect(page.locator("#embed-panel .status")).toContainText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('<wakusei-body body="saturn" look="line"');
  await page.locator('#embed-panel button[data-kind="html"]').focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('#embed-panel button[data-kind="module"]')).toHaveAttribute("aria-selected", "true");
});

test("every control in the section is a finger wide", async ({ page }) => {
  await page.goto(`${URL}?look=line`);
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const inside = document.querySelector("#embed-panel")!.shadowRoot!;
    for (const el of [...document.querySelectorAll<HTMLElement>("#embed button"), ...inside.querySelectorAll<HTMLElement>("button, a.btn")]) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 47.5 && !el.closest(".fam-seg")) out.push(`${el.textContent?.trim()} is ${Math.round(r.height)} px high`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("the panel has its own picker: a planet, then its moon, changes the code and the picture, and Copy has its word", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  const code = page.locator('#embed-panel [part="code"]');
  await expect(page.locator('#embed-picker [data-row="bodies"] .pick')).toHaveCount(10);
  await page.locator('#embed-picker .pick[data-body="mars"]').click();
  await expect(code).toContainText('body="mars"');
  await page.locator('#embed-picker .pick[data-body="deimos"]').click();
  await expect(code).toContainText('body="deimos"');
  await expect(page.locator('#embed-panel [part="preview"] wakusei-body')).toHaveAttribute("body", "deimos");
  await expect(page.locator('#embed-picker .pick[data-body="deimos"]')).toHaveAttribute("aria-pressed", "true");
  const copy = page.locator('#embed-panel [part="copy"]');
  await expect(copy).toHaveText("Copy code");
  // the word can be read: its colour is not the pill's own
  const colours = await copy.evaluate((el) => ({ ink: getComputedStyle(el).color, ground: getComputedStyle(el).backgroundColor }));
  expect(colours.ink).not.toBe(colours.ground);
});

test("nothing the panel had before the shared one is gone: seven tabs, four sizes, the body picker, a picture, Copy, the two links and the credit", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  const panel = page.locator("#embed-panel");
  await expect(panel.locator('[role="tab"]')).toHaveText(["HTML", "ES module", "React", "Vue", "Angular", "Svelte", "iframe"]);
  await expect(panel.locator('[part="size-button"]')).toHaveText(["160", "240", "320", "480"]);
  await expect(panel.locator('[part="size-button"][aria-pressed="true"]')).toHaveText("320");
  await expect(page.locator('#embed-picker [data-row="bodies"] .pick')).toHaveCount(10);
  await expect(panel.locator('[part="preview"] wakusei-body')).toHaveCount(1);
  await expect(panel.locator('[part="copy"]')).toHaveText("Copy code");
  await expect(panel.locator('[part="open"]')).toHaveText("Open the embed page");
  await expect(panel.locator('[part="open"]')).toHaveAttribute("href", /^embed\.html\?body=jupiter&look=line/);
  await expect(panel.locator('[part="docs"]')).toHaveText("Read the docs");
  await expect(panel.locator('[part="docs"]')).toHaveAttribute("href", "docs/");
  await expect(panel.locator('[part="credits"]')).toContainText("Wakusei Planets by John Morris (MIT)");
});

test("the picture fits its box at every size, on a phone and on a desk", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=venus`);
  for (const size of [160, 240, 320, 480]) {
    await page.locator(`#embed-panel button[data-size="${size}"]`).click();
    // The panel lays the picture out and scales it to its box on the next animation frame after a choice, so how soon it fits depends on the machine: wait for that, then it must fit exactly.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const inside = document.querySelector("#embed-panel")!.shadowRoot!;
            const box = inside.querySelector('[part="preview"]')!.getBoundingClientRect();
            const body = inside.querySelector('[part="preview"] wakusei-body')!.getBoundingClientRect();
            return body.left >= box.left - 0.5 && body.right <= box.right + 0.5 && body.top >= box.top - 0.5 && body.bottom <= box.bottom + 0.5;
          }),
        { message: `${size} fits its box`, timeout: 30_000 },
      )
      .toBe(true);
  }
});
