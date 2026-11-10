// The ready-made PDFs of every colouring sheet, printed from the built demo (site/kids.html) by Chromium's page.pdf: A4 and US Letter, English and Japanese, into site/pdf/ with a list page for each language.
//   pnpm site && node scripts/make-pdfs.mjs
// The server is this package's picture-script port, 8302. One headless browser, under the browser lock, drawing in software; it is closed when the last PDF is written.
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { SOFTWARE_GL_ARGS, withBrowserLock } from "@johnmorrisdotca/kazoku-ui/testing";

const PORT = Number(process.env.PDF_PORT ?? 8302);
const site = new URL("../site/", import.meta.url).pathname;
const SHEETS = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon", "io", "europa", "ganymede", "callisto", "titan", "triton", "charon", "lineup"];
const PAPERS = ["a4", "letter"];
const LANGS = ["en", "ja"];
const NAMES = {
  en: { sun: "Sun", mercury: "Mercury", venus: "Venus", earth: "Earth", mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", pluto: "Pluto", moon: "Moon", io: "Io", europa: "Europa", ganymede: "Ganymede", callisto: "Callisto", titan: "Titan", triton: "Triton", charon: "Charon", lineup: "All the planets" },
  ja: { sun: "たいよう (太陽)", mercury: "すいせい (水星)", venus: "きんせい (金星)", earth: "ちきゅう (地球)", mars: "かせい (火星)", jupiter: "もくせい (木星)", saturn: "どせい (土星)", uranus: "てんのうせい (天王星)", neptune: "かいおうせい (海王星)", pluto: "めいおうせい (冥王星)", moon: "つき (月)", io: "イオ", europa: "エウロパ", ganymede: "ガニメデ", callisto: "カリスト", titan: "タイタン", triton: "トリトン", charon: "カロン", lineup: "わくせいの ならびかた" },
};
const SAY = {
  en: { title: "Colouring sheets: PDFs", intro: "Print on A4 or US Letter. Every sheet is one page.", back: "Back to the page where you pick a sheet", paper: { a4: "A4", letter: "US Letter" }, other: "日本語 (Japanese)", otherPage: "ja.html", page: "kids.html" },
  ja: { title: "ぬりえの PDF", intro: "A4 か USレターで いんさつします。ぬりえは ぜんぶ 1ページです。", back: "ぬりえを えらぶ ページに もどる", paper: { a4: "A4", letter: "USレター" }, other: "English", otherPage: "./", page: "kids.html?lang=ja" },
};
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };

const server = createServer((req, res) => {
  void (async () => {
    let url = (req.url ?? "/").split("?")[0].replace(/^\/wakusei-planets\/?/, "/");
    if (url === "/") url = "/index.html";
    try {
      const path = join(site, normalize(url));
      res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
      res.end(await readFile(path));
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  })();
}).listen(PORT);

const file = (sheet, paper, lang) => `wakusei-planets-${sheet}-${paper}-${lang}.pdf`;
await mkdir(join(site, "pdf"), { recursive: true });
let written = 0;
await withBrowserLock(async () => {
  const browser = await chromium.launch({ args: SOFTWARE_GL_ARGS });
  try {
    for (const lang of LANGS) {
      for (const paper of PAPERS) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: lang === "ja" ? "ja-JP" : "en-US", reducedMotion: "reduce" });
        await page.addInitScript(() => { window.print = () => {}; });
        await page.emulateMedia({ colorScheme: "light" });
        await page.goto(`http://127.0.0.1:${PORT}/wakusei-planets/kids.html?sheet=sun&paper=${paper}&lang=${lang}`);
        await page.locator("#paper-inner .kazoku-page").waitFor();
        for (const sheet of SHEETS) {
          await page.locator(`button[data-sheet="${sheet}"]`).click();
          await page.locator("#paper-inner .kazoku-title").waitFor();
          await page.locator("#print").click();
          await page.emulateMedia({ media: "print", colorScheme: "light" });
          await writeFile(join(site, "pdf", file(sheet, paper, lang)), await page.pdf({ preferCSSPageSize: true, printBackground: true }));
          written += 1;
          await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
          await page.emulateMedia({ media: "screen", colorScheme: "light" });
        }
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
});

for (const lang of LANGS) {
  const say = SAY[lang];
  const rows = SHEETS.map((sheet) => `<tr><th scope="row">${NAMES[lang][sheet]}</th>${PAPERS.map((paper) => `<td><a href="${file(sheet, paper, lang)}">${say.paper[paper]}</a></td>`).join("")}</tr>`).join("\n");
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${say.title} · Wakusei Planets</title>
<style>:root{color-scheme:light dark}body{margin:0 auto;max-width:44rem;padding:1rem 16px;font:1rem/1.5 system-ui,"Hiragino Sans","Noto Sans JP",sans-serif}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid #8886}a{display:inline-block;min-height:48px;line-height:48px;padding:0 .5rem}</style></head>
<body><h1>${say.title}</h1><p>${say.intro}</p><p><a href="../${say.page}">${say.back}</a> · <a href="${say.otherPage}">${say.other}</a></p>
<table><tbody>
${rows}
</tbody></table></body></html>
`;
  await writeFile(join(site, "pdf", lang === "en" ? "index.html" : "ja.html"), html, "utf8");
}
console.log(`pdfs: ${written} written to site/pdf/ (${SHEETS.length} sheets, ${PAPERS.join(" and ")}, ${LANGS.join(" and ")})`);
