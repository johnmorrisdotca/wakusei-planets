// The demo's page, made from demo/index.html and the family's shared head, header, footer and language chooser (family-template.mjs). The Pages build (site.ts) writes it
// into site/, and the dev server serves the same files, so the tests play the page that is published. The page's words, in both languages, are demo/words.js.
import { readFileSync } from "node:fs";

import { WORDS } from "../demo/words.js";
import { BODIES } from "../src/facts.ts";
import { MOON_PAGE_HOSTS, moonPage, type MoonPageHost } from "../src/moon-pages/data.ts";
import { FAMILY_SCRIPT, familyFooter, familyHead, familyHeader, familyUnreviewed } from "./family-template.mjs";

const id = "wakusei-planets";
/** Where every data credit is written in full. */
const NOTICE = "https://github.com/johnmorrisdotca/wakusei-planets/blob/main/NOTICE.md";

/** The family's footer, with a link to every credit beside the one-line credit, so a reader need not open anything to find the sources. */
const footer = (): string => familyFooter({ id }).replace('<span data-say="foot"></span>', `<span><span data-say="foot"></span> <a href="${NOTICE}" data-say="creditsAll"></a></span>`);
const TITLE = "Wakusei Planets 惑星: the Sun, planets and moons for the web";
const DESCRIPTION = "The Sun, the planets and their moons as a clean line drawing, a shaded realistic drawing or a painted surface map, with real sizes, axial tilt and rotation, and the moons where they are at any date and time. A web component and an SVG string.";
const LINKS = [{ href: "surface.html", say: "pageSurface" }, { href: "portrait.html", say: "pagePortrait" }, { href: "kids.html", say: "pageKids" }, { href: "space.html", say: "pageSpace" }, { href: "star.html", say: "pageStar" }, { href: "craft.html", say: "pageCraft" }, { href: "lineup.html", say: "pageLineup" }, { href: "plan.html", say: "pagePlan" }, { href: "flat.html", say: "pageFlat" }, { href: "system.html", say: "pageSystem" }, { href: "dots.html", say: "pageDots" }, { href: "docs/index.html", say: "pageDocs" }, { href: "embed.html", say: "pageEmbed" }];

/** The family's scripts and the language chooser, then the page's own module. */
const scripts = (script: string): string =>
  `<script>${FAMILY_SCRIPT}</script>\n<script>window.wakuseiLanguage = familyLanguage({ id: ${JSON.stringify(id)}, words: ${JSON.stringify(WORDS)}, onChange: function (lang) { window.dispatchEvent(new CustomEvent('wakusei-language', { detail: { lang: lang } })); } });</script>\n<script type="module" src="kazoku-parts.js"></script>\n<script type="module" src="${script}"></script>`;

/** A page of the demo with the family's blocks put in where its comments say. */
function render(file: string, title: string, description: string): string {
  const html = readFileSync(new URL(`../demo/${file}`, import.meta.url), "utf8");
  return html
    .replace("<!--family:head-->", familyHead({ id, title, description }))
    .replace("<!--family:header-->", familyHeader({ id, links: LINKS }))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", footer())
    .replace(/<!--family:scripts ([\w.-]+)-->/, (_, script: string) => scripts(script));
}

/** The demo's page. */
/** The demo's page, with a card for each giant planet's moon page (its count of moons from the moon list). */
export const renderIndex = (): string =>
  render("index.html", TITLE, DESCRIPTION).replace("<!--moons:index-->", () =>
    MOON_PAGE_HOSTS.map((host) => `<li><a class="giant" href="${host}.html" data-host="${host}"><b data-say="gi_${host}">${BODIES[host].name.en}</b><span><span>${moonPage(host).counts.total}</span><span data-say="gi_count"></span></span></a></li>`).join(""),
  );

/** The portrait builder's page. */
export const renderPortrait = (): string =>
  render("portrait.html", "Wakusei Planets 惑星: portrait builder", "Put any bodies of the solar system in one picture: drag, size, turn and light them, arrange them in a row, an arc or a grid, then copy the code or save a PNG or SVG.");

/** The colouring sheets' page. */
export const renderKids = (): string => render("kids.html", "Wakusei Planets 惑星: colouring sheets for children", "Printable colouring sheets of the Sun, the planets and the big moons, with the real colours and three facts, on A4 or US Letter, in English and Japanese. Print them or save a PDF.");

/** The space view's page. */
export const renderSpace = (): string =>
  render("space.html", "Wakusei Planets 惑星: the space view", "The Earth, the Moon, the Sun and the planets in their places for any date and time, with the Moon's phase and the Earth's day side coming out of the light. Zoom from the Earth out to the whole solar system.");

/** The full-screen space page: the element on its own, filling the window. */
export const renderSpaceFull = (): string =>
  render("space-full.html", "Wakusei Planets 惑星: the space view, full screen", "The Earth, the Moon, the Sun and the planets filling the whole window: drag anywhere to turn, the wheel to zoom, from the Earth out to the whole solar system.");

/** The spacecraft page. */
export const renderCraft = (): string =>
  render("craft.html", "Wakusei Planets 惑星: spacecraft", "Nineteen spacecraft, from Pioneer 10 to Solar Orbiter, and Starman in the Tesla Roadster: the path and the place on a date, the facts and the voyage, in English and Japanese. Each craft's table loads only when it is chosen.");

/** The star page. */
export const renderStar = (): string =>
  render("star.html", "Wakusei Planets 惑星: a star from its numbers", "Any star drawn from a few numbers: its temperature gives the colour, its radius the size, its class the grain of the surface, its rotation how it turns. Line or shaded, turnable, with each part marked measured or drawn for looks, and the code to put it in your page.");

/** The size line-up page. */
export const renderLineup = (): string =>
  render("lineup.html", "Wakusei Planets 惑星: the size line-up", "The Sun and the largest stars known side by side at true relative size, each drawn from its numbers and labelled with its radius, its error and its source. Zoom from the Sun up to the largest star, turn each star by hand, add the Earth and Jupiter, then save a picture or print a poster.");

/** The plan page. */
export const renderPlan = (): string =>
  moonLinks(render("plan.html", "Wakusei Planets 惑星: the top-down plan", "A small plan of the solar system from above, or of one planet's moons from above its pole, with one body marked, for any date: squeezed with a logarithm so the inner planets show, or to scale. SVG, no WebGL, light enough for an inset."));

/** The flat map page. */
export const renderFlat = (): string =>
  render("flat.html", "Wakusei Planets 惑星: flat maps of the Moon and Mars", "The Moon and Mars as flat maps with day and night for any time, the landing, rover and crash sites marked, and the spacecraft in orbit moving over them with their coverage and ground tracks. English and Japanese, no WebGL.");

/** The flat solar system page. */
export const renderSystem = (): string =>
  render("system.html", "Wakusei Planets 惑星: the flat solar system", "The Sun, the planets, the belts, the comets and our spacecraft, the Tesla Roadster among them, from above for any time, with squeezed distances so the inner planets show. English and Japanese, no WebGL.");

/** The planet's edge with its moons I to XVI as dots sized by diameter. */
export const renderDots = (): string =>
  render("dots.html", "Wakusei Planets 惑星: moons by distance", "A giant planet's edge, and the moons numbered I to XVI as dots sized by their diameters, nearest at the top. English and Japanese. The moons are not photographs.");

/** The standing page. */
export const renderSurface = (): string =>
  render("surface.html", "Wakusei Planets 惑星: standing on the Moon", "A person at the Apollo 17 landing site, drawn from the measured ground, with the Sun and the Earth where they are, hard shadows, and made detail that says it is made.");

/** A link to each giant planet's moon page, by the planet's name. */
const moonLinks = (html: string): string => html.replace("<!--moons:links-->", () => MOON_PAGE_HOSTS.map((host) => `<a href="${host}.html" data-host="${host}" data-say="gi_${host}">${BODIES[host].name.en}</a>`).join(""));

/** A giant planet's moon page: demo/moons.html with <wakusei-moon-pages> set to the planet, and the row of links to the four. */
export function renderMoons(host: MoonPageHost): string {
  const data = moonPage(host);
  const planets = MOON_PAGE_HOSTS.map((one) => `<a href="${one}.html" data-host="${one}" data-en="${BODIES[one].name.en}" data-ja="${BODIES[one].name.ja}"${one === host ? ' aria-current="page"' : ""}>${BODIES[one].name.en}</a>`).join("");
  const title = `Wakusei Planets 惑星: ${data.name.en} and its ${data.counts.total} moons`;
  const description = `Every known moon of ${data.name.en}, ${data.counts.total} of them: their orbits drawn with the prograde and retrograde ones in two colours, a map from above and a family portrait, the ${data.counts.featured} moons drawn in full, and a table to sort by size, distance, period and discovery. English and Japanese.`;
  return render("moons.html", title, description)
    .replace('<wakusei-moon-pages id="moons"', `<wakusei-moon-pages id="moons" planet="${host}"`)
    .replace("<!--moons:planets-->", () => planets);
}

/** demo/embed.html, the frame a page puts in an iframe: plain, no family blocks. */
export function renderEmbed(): string {
  return readFileSync(new URL("../demo/embed.html", import.meta.url), "utf8");
}
