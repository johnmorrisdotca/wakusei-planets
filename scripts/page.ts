// The demo's page, made from demo/index.html and the family's shared head, header, footer and language chooser (family-template.mjs). The Pages build (site.ts) writes it
// into site/, and the dev server serves the same files, so the tests play the page that is published. The page's words, in both languages, are demo/words.js.
import { readFileSync } from "node:fs";

import { WORDS } from "../demo/words.js";
import { FAMILY_SCRIPT, familyFooter, familyHead, familyHeader, familyUnreviewed } from "./family-template.mjs";

const id = "wakusei-planets";
const TITLE = "Wakusei Planets 惑星: the Sun, planets and moons for the web";
const DESCRIPTION = "The Sun, the planets and their moons as a clean line drawing, a shaded realistic drawing or a painted surface map, with real sizes, axial tilt and rotation, and the moons where they are at any date and time. A web component and an SVG string.";
const LINKS = [{ href: "portrait.html", say: "pagePortrait" }, { href: "space.html", say: "pageSpace" }, { href: "docs/index.html", say: "pageDocs" }, { href: "embed.html", say: "pageEmbed" }, { href: "kids.html", say: "pageKids" }];

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
    .replace("<!--family:footer-->", familyFooter({ id }))
    .replace(/<!--family:scripts ([\w.-]+)-->/, (_, script: string) => scripts(script));
}

/** The demo's page. */
export const renderIndex = (): string => render("index.html", TITLE, DESCRIPTION);

/** The portrait builder's page. */
export const renderPortrait = (): string =>
  render("portrait.html", "Wakusei Planets 惑星: portrait builder", "Put any bodies of the solar system in one picture: drag, size, turn and light them, arrange them in a row, an arc or a grid, then copy the code or save a PNG or SVG.");

/** The space view's page. */
export const renderSpace = (): string =>
  render("space.html", "Wakusei Planets 惑星: the space view", "The Earth, the Moon, the Sun and the planets in their places for any date and time, with the Moon's phase and the Earth's day side coming out of the light. Zoom from the Earth out to the whole solar system.");

/** The kids' page: your weight and age on other worlds. */
export const renderKids = (): string =>
  render("kids.html", "Wakusei Planets 惑星: your weight and age on other worlds", "For children: type your weight and your birthday and see what you weigh and how old you are on the Sun, the planets, Pluto and the big moons.");

/** demo/embed.html, the frame a page puts in an iframe: plain, no family blocks. */
export function renderEmbed(): string {
  return readFileSync(new URL("../demo/embed.html", import.meta.url), "utf8");
}
