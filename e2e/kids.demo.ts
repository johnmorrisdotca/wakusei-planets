// The kids' page in a real browser at a phone's width and a desk's, in Chromium and WebKit: the cards, the weight and age worked out from a typed weight and birthday, kg and lb, English and Japanese, and nothing kept.
import { expect, test, type Page } from "@playwright/test";

const TODAY = new Date(2026, 10, 8, 12, 0, 0);
const CARDS = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon", "io", "europa", "ganymede", "callisto", "titan", "triton"];

async function open(page: Page, query = ""): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(TODAY);
  await page.goto(`/wakusei-planets/kids.html${query}`);
  await expect(page.locator(".kids-card")).toHaveCount(CARDS.length);
  return errors;
}
const card = (page: Page, id: string) => page.locator(`.kids-card[data-world="${id}"]`);
const fill = async (page: Page, weight: string, birthday: string): Promise<void> => {
  await page.locator("#weight").fill(weight);
  await page.locator("#birthday").fill(birthday);
};

test("a big friendly card for the Sun, each planet, Pluto, the Moon and the big moons, each with its line drawing and its pull", async ({ page }) => {
  const errors = await open(page);
  expect(await page.locator(".kids-card").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset["world"]))).toEqual(CARDS);
  for (const id of CARDS) {
    const picture = card(page, id).locator(".kids-art svg");
    await expect(picture).toBeVisible();
    expect(await picture.evaluate((el) => el.innerHTML.length)).toBeGreaterThan(200);
    await expect(card(page, id).locator("h3")).toBeVisible();
    await expect(card(page, id).locator(".kids-pull")).toContainText("times the Earth's");
  }
  await expect(card(page, "mars").locator("h3")).toHaveText("Mars");
  await expect(card(page, "mars").locator(".kids-pull")).toHaveText("Pull: 0.38 times the Earth's");
  await expect(card(page, "jupiter").locator(".kids-pull")).toHaveText("Pull: 2.5 times the Earth's");
  await expect(card(page, "mars").locator(".kids-weight .kids-none")).toHaveText("Type your weight to see it here.");
  await expect(card(page, "mars").locator(".kids-age .kids-none")).toHaveText("Type your birthday to see your age here.");
  expect(errors).toEqual([]);
});

test("a weight and a birthday give the weight and age on each world", async ({ page }) => {
  await open(page);
  await fill(page, "30", "2016-11-08");
  const weight = (id: string) => card(page, id).locator(".kids-weight .kids-big");
  const age = (id: string) => card(page, id).locator(".kids-age .kids-big");
  await expect(weight("earth")).toHaveText("30 kg");
  await expect(weight("moon")).toHaveText("5 kg");
  await expect(weight("mars")).toHaveText("11.4 kg");
  await expect(weight("jupiter")).toHaveText("75.9 kg");
  await expect(weight("sun")).toHaveText("839.5 kg");
  await expect(age("earth")).toHaveText("10 years old");
  await expect(age("mars")).toHaveText("5.3 years old");
  await expect(age("jupiter")).toHaveText("0.84 years old");
  await expect(age("mercury")).toHaveText("41.5 years old");
  await expect(age("pluto")).toHaveText("0.04 years old");
  await expect(card(page, "earth").locator(".kids-age .kids-small").first()).toHaveText("3,652 days old there");
  await expect(card(page, "earth").locator(".kids-age .kids-small").nth(1)).toContainText("today!");
  await expect(card(page, "mars").locator(".kids-age .kids-small").nth(1)).toContainText("February 20, 2028");
  await expect(card(page, "mars").locator(".kids-age .kids-small").nth(1)).toContainText("you turn 6");
  await expect(card(page, "sun").locator(".kids-age .kids-none")).toHaveText("The Sun has no years or days to count.");
});

test("pounds in, pounds out", async ({ page }) => {
  await open(page);
  await page.locator('#units [data-unit="lb"]').click();
  await expect(page.locator('#units [data-unit="lb"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#weight").fill("66");
  await expect(card(page, "earth").locator(".kids-weight .kids-big")).toHaveText("66 lb");
  await expect(card(page, "mars").locator(".kids-weight .kids-big")).toHaveText("25 lb");
});

test("a weight of 0 and a birthday that has not come are told so, and nothing is worked out from them", async ({ page }) => {
  await open(page);
  await fill(page, "0", "2030-01-01");
  await expect(page.locator("#warn")).toBeVisible();
  await expect(page.locator("#warn")).toContainText("Type a weight above 0.");
  await expect(page.locator("#warn")).toContainText("has not come yet");
  await expect(card(page, "mars").locator(".kids-weight .kids-none")).toBeVisible();
  await expect(card(page, "mars").locator(".kids-age .kids-none")).toBeVisible();
  await fill(page, "30", "2016-11-08");
  await expect(page.locator("#warn")).toBeHidden();
});

test("Japanese: the names, the words and the dates are in Japanese", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(card(page, "sun").locator("h3")).toHaveText("太陽");
  await expect(card(page, "mars").locator("h3")).toHaveText("火星");
  await fill(page, "30", "2016-11-08");
  await expect(card(page, "mars").locator(".kids-age .kids-big")).toHaveText("5.3 さい");
  await expect(card(page, "mars").locator(".kids-weight .kids-big")).toHaveText("11.4 kg");
  await expect(card(page, "mars").locator(".kids-pull")).toHaveText("ひっぱる ちから: ちきゅうの 0.38 ばい");
  await expect(card(page, "mars").locator(".kids-age .kids-small").nth(1)).toContainText("2028年2月20日");
  await expect(page.locator('[data-say="kids_private"]')).toContainText("ほぞん");
});

test("what is typed is kept nowhere: not in storage, not in the address", async ({ page }) => {
  await open(page);
  await fill(page, "34.5", "2016-11-08");
  await expect(card(page, "earth").locator(".kids-weight .kids-big")).toHaveText("34.5 kg");
  const kept = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie, location.href]));
  expect(kept).not.toContain("2016-11-08");
  expect(kept).not.toContain("34.5");
  await page.reload();
  await expect(page.locator("#weight")).toHaveValue("");
  await expect(page.locator("#birthday")).toHaveValue("");
});

test("the page fits the screen, the fields and buttons are a finger wide and the names are large", async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const selector of ["#weight", "#birthday", '#units [data-unit="kg"]', '#units [data-unit="lb"]']) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.height, selector).toBeGreaterThanOrEqual(48);
    expect(box.width, selector).toBeGreaterThanOrEqual(48);
  }
  const name = await card(page, "earth").locator("h3").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(name).toBeGreaterThanOrEqual(24);
  const big = await card(page, "mars").locator(".kids-pull").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(big).toBeGreaterThanOrEqual(15);
  const first = (await card(page, "sun").boundingBox())!;
  expect(first.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await card(page, "triton").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the page is in the demo's list of pages", async ({ page }) => {
  await page.goto("/wakusei-planets/");
  await expect(page.locator('a[href="kids.html"]').first()).toBeAttached();
});
