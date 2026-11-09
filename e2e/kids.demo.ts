// The colouring sheets page in a real browser: pick a sheet and the paper, see the sheet as it prints, press Print / save PDF. Chromium also prints every sheet on every paper to a PDF (page.pdf),
// and the PDF is read for its paper size and its page count: one page each.
import { expect, test, type Page } from "@playwright/test";

const SHEETS = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon", "io", "europa", "ganymede", "callisto", "titan", "triton", "charon", "lineup"];
const PAPERS = [["a4", 210, 297], ["letter", 215.9, 279.4], ["a3", 297, 420], ["tabloid", 279.4, 431.8]] as const;
const PT = 72 / 25.4;
const MM = 25.4 / 96;

const open = async (page: Page, query = "sheet=saturn&paper=a4"): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Reflect.set(window, "__printed", 0);
    window.print = () => Reflect.set(window, "__printed", (Reflect.get(window, "__printed") as number) + 1);
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/wakusei-planets/kids.html?${query}`);
  await expect(page.locator("#paper-inner .kazoku-page")).toBeVisible();
  return errors;
};

/** The paper sizes and the number of pages in a PDF Chromium wrote, read from its page objects. */
const readPdf = (bytes: Buffer): { pages: number; boxes: [number, number][] } => {
  const text = bytes.toString("latin1");
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m): [number, number] => [Number(m[1]), Number(m[2])]);
  return { pages: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length, boxes };
};
const near = (got: number, want: number): boolean => Math.abs(got - want) <= 1.5;

test("the page offers a sheet for every body and the lineup, in clicks in a row, and the sheet shows its name, colours, facts and QR code", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("[data-sheet]")).toHaveCount(19);
  await expect(page.locator("[data-paper]")).toHaveCount(4);
  const sheet = page.locator("#paper-inner .kazoku-sheet");
  await expect(sheet.locator(".kazoku-brand")).toHaveText("Space Program X");
  await expect(sheet.locator(".kazoku-package")).toHaveText("Wakusei Planets");
  await expect(sheet.locator(".kazoku-title")).toHaveText("Saturn");
  await expect(sheet.locator(".kazoku-namelabel")).toHaveText("Name:");
  await expect(sheet.locator(".kazoku-qr svg")).toBeVisible();
  await expect(sheet.locator(".kazoku-credits")).toContainText("IAU and NASA");
  await expect(sheet.locator(".kazoku-meta")).toContainText(/Version \d+\.\d+\.\d+ · Date \d{4}-\d\d-\d\d/);
  await expect(sheet.locator(".kazoku-address")).toContainText("kids.html?sheet=saturn");
  await expect(sheet.locator("svg [data-swatch]")).toHaveCount(3);
  await expect(sheet.locator("svg [data-fact]").first()).toContainText("km across");
  await expect(page.locator("#info")).toHaveText("A4, tall: one page");
  await page.locator('[data-sheet="mars"]').click();
  await expect(sheet.locator(".kazoku-title")).toHaveText("Mars");
  await expect(sheet.locator("svg [data-swatch]")).toHaveCount(4);
  await expect(page).toHaveURL(/sheet=mars/);
  await page.locator('[data-sheet="lineup"]').click();
  await expect(page.locator("#info")).toHaveText("A4, wide: one page");
  await expect(sheet.locator("svg [data-badge]")).toHaveCount(8);
  await page.locator('[data-paper="letter"]').click();
  await expect(page.locator("#info")).toHaveText("US Letter, wide: one page");
  expect(errors).toEqual([]);
});

test("the sheet's picture is drawn at the size it prints: one millimetre of the picture is one millimetre of the page, every line of text is inside it and the lines are 1 mm", async ({ page }) => {
  await open(page);
  // a wider font than the sheet's rounded ones, as a server's fallback is: the picture was drawn with room to spare
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = '.kazoku-sheet { font-family: Verdana, "DejaVu Sans", sans-serif !important; }';
    document.documentElement.append(style);
  });
  for (const [paper] of PAPERS) {
    for (const id of ["saturn", "mercury", "lineup"]) {
      await page.goto(`/wakusei-planets/kids.html?sheet=${id}&paper=${paper}`);
      await expect(page.locator("#paper-inner .kazoku-page")).toBeVisible();
      const got = await page.locator("#paper-inner .kazoku-body").evaluate((body, mm) => {
        const svg = body.querySelector("svg")!;
        const box = svg.viewBox.baseVal;
        const scaled = (new DOMMatrix(getComputedStyle(document.querySelector("#paper-inner")!).transform).a);
        const area = body.getBoundingClientRect();
        const frame = svg.getBoundingClientRect();
        const slack = 0.5 / mm;
        const inside = [...svg.querySelectorAll("text")].every((text) => {
          const b = text.getBoundingClientRect();
          return b.left >= frame.left - slack && b.top >= frame.top - slack && b.right <= frame.right + slack && b.bottom <= frame.bottom + slack;
        });
        const widths = [...svg.querySelectorAll("[stroke-width]")].map((el) => Number(el.getAttribute("stroke-width")));
        return { scale: Math.min(area.width * mm / scaled / box.width, area.height * mm / scaled / box.height), inside, thin: Math.min(...widths) };
      }, MM);
      expect(got.scale, `${id} ${paper}: the picture's scale`).toBeGreaterThan(0.99);
      expect(got.scale, `${id} ${paper}`).toBeLessThan(1.01);
      expect(got.inside, `${id} ${paper}: the text is inside the picture`).toBe(true);
      expect(got.thin, `${id} ${paper}: the thinnest line`).toBeGreaterThanOrEqual(id === "lineup" ? 0.8 : 1);
    }
  }
});

test("Print / save PDF opens a print-only copy, calls window.print, and removes the copy afterwards", async ({ page }) => {
  await open(page);
  await page.locator("#print").click();
  expect(await page.evaluate(() => Reflect.get(window, "__printed"))).toBe(1);
  await expect(page.locator("body > .kazoku-print-root .kazoku-sheet")).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".kazoku-print-root")).toHaveCount(0);
});

test("the sheet speaks Japanese in plain words, with the readings of the names", async ({ page }) => {
  await open(page, "sheet=jupiter&paper=letter&lang=ja");
  const sheet = page.locator("#paper-inner .kazoku-sheet");
  await expect(sheet.locator(".kazoku-title")).toHaveText("もくせい（木星）");
  await expect(sheet.locator(".kazoku-namelabel")).toHaveText("なまえ:");
  await expect(sheet.locator("svg [data-colour-head]")).toHaveText("ぬってね！");
  await expect(sheet.locator("svg [data-fact]").first()).toContainText("よこはば");
  await expect(page.locator("#print")).toHaveText("いんさつ / PDFで ほぞん");
});

test("the buttons are a finger wide and the page fits the screen", async ({ page }) => {
  await open(page);
  const small = await page.locator(".kids-picks button").evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height < 47.5 || el.getBoundingClientRect().width < 47.5).length);
  expect(small).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const area = await page.locator("#paper").boundingBox();
  const first = await page.locator(".kazoku-page").first().boundingBox();
  expect(first!.width).toBeLessThanOrEqual(area!.width + 1);
});

for (const [paper, wide, tall] of PAPERS) {
  for (const language of ["en", "ja"]) {
    test(`${paper}, ${language}: every sheet prints to one page of the paper's size`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "page.pdf is Chromium's");
      test.skip(language === "ja" && (paper === "a3" || paper === "tabloid"), "Japanese is checked on A4 and Letter");
      test.setTimeout(240_000);
      await open(page, `sheet=sun&paper=${paper}&lang=${language}`);
      for (const id of SHEETS) {
        await page.locator(`[data-sheet="${id}"]`).click();
        await expect(page.locator("#paper-inner .kazoku-title")).not.toBeEmpty();
        await page.locator("#print").click();
        await page.emulateMedia({ media: "print", colorScheme: "light" });
        const landscape = id === "lineup";
        const pdf = readPdf(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
        expect(pdf.pages, `${id} ${paper} ${language}: pages`).toBe(1);
        const [w, h] = landscape ? [tall, wide] : [wide, tall];
        expect(near(pdf.boxes[0]![0], w * PT) && near(pdf.boxes[0]![1], h * PT), `${id} ${paper}: the page is ${pdf.boxes[0]} points`).toBe(true);
        await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
        await page.emulateMedia({ media: "screen", colorScheme: "light" });
      }
    });
  }
}
