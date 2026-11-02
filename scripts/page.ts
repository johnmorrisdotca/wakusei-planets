// The demo's page, made from demo/index.html and the family's shared head, header, footer and language chooser (family-template.mjs). The Pages build (site.ts) writes it
// into site/, and the dev server serves the same files, so the tests play the page that is published. The page's words, in both languages, are demo/words.js.
import { readFileSync } from "node:fs";

import { WORDS } from "../demo/words.js";
import { FAMILY_SCRIPT, familyFooter, familyHead, familyHeader, familyUnreviewed } from "./family-template.mjs";

const id = "wakusei-planets";
const TITLE = "Wakusei Planets 惑星: the Sun, planets and moons for the web";
const DESCRIPTION = "The Sun, the planets and their moons as a clean line drawing, a shaded realistic drawing or a painted surface map, with real sizes, axial tilt and rotation, and the moons where they are at any date and time. A web component and an SVG string.";

/** The page's text with the family's blocks put in where its comments say. */
export function renderIndex(): string {
  const html = readFileSync(new URL("../demo/index.html", import.meta.url), "utf8");
  return html
    .replace("<!--family:head-->", familyHead({ id, title: TITLE, description: DESCRIPTION }))
    .replace("<!--family:header-->", familyHeader({ id, links: [{ href: "docs/index.html", say: "pageDocs" }, { href: "embed.html", say: "pageEmbed" }] }))
    .replace("<!--family:unreviewed-->", familyUnreviewed({ id }))
    .replace("<!--family:footer-->", familyFooter({ id }))
    .replace(
      /<!--family:scripts ([\w.-]+)-->/,
      (_, script: string) =>
        `<script>${FAMILY_SCRIPT}</script>\n<script>window.wakuseiLanguage = familyLanguage({ id: ${JSON.stringify(id)}, words: ${JSON.stringify(WORDS)}, onChange: function (lang) { window.dispatchEvent(new CustomEvent('wakusei-language', { detail: { lang: lang } })); } });</script>\n<script type="module" src="kazoku-parts.js"></script>\n<script type="module" src="${script}"></script>`,
    );
}

/** demo/embed.html, the frame a page puts in an iframe: plain, no family blocks. */
export function renderEmbed(): string {
  return readFileSync(new URL("../demo/embed.html", import.meta.url), "utf8");
}
