// A giant planet's moon page: the family's header, then <wakusei-moon-pages> for the planet the page is about, with the page's own row of links to the other three in its slot. The element never writes the
// address; this page does: it sets the element's attributes from the address when it loads, and writes the address (and the links, so a move to another planet keeps the choices) from each change it sends.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "../src/moon-pages/element.ts";
import { setThreeLoader } from "../src/element.ts";
import type { MoonPagesState, WakuseiMoonPages } from "../src/moon-pages/element.ts";

setThreeLoader(() => import("./three-subset.ts"));

const pages = document.querySelector<WakuseiMoonPages>("#moons")!;
const address = createAddressState({ defaults: {} });
const KEYS = ["tab", "view", "reach", "colour", "sort", "order"] as const;
const DEFAULTS: Partial<MoonPagesState> = { tab: "orbits", view: "tilted", reach: "all", colour: "direction", sort: "distance", order: "up" };

for (const key of KEYS) {
  const value = address.get(key);
  if (value !== null) pages.setAttribute(key, value);
}

/** The choices that differ from the element's defaults. */
const choices = (state: MoonPagesState): [string, string | null][] => KEYS.map((key) => [key, state[key] === DEFAULTS[key] ? null : state[key]]);
function keep(state: MoonPagesState): void {
  const query = new URLSearchParams();
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked !== null) query.set("lang", asked);
  for (const [key, value] of choices(state)) if (value !== null) query.set(key, value);
  const tail = query.toString();
  for (const link of document.querySelectorAll<HTMLAnchorElement>("#planets a")) link.href = `${link.dataset["host"]}.html${tail === "" ? "" : `?${tail}`}`;
}
pages.addEventListener("wakusei-moon-pages-change", (event) => {
  const state = (event as CustomEvent<MoonPagesState>).detail;
  for (const [key, value] of choices(state)) address.set(key, value);
  // written now, before a tab's 3D parts are made and hold the page for a moment
  address.flush();
  keep(state);
});
// the planets' names follow the page's language
const name = (): void => {
  const ja = document.documentElement.lang.startsWith("ja");
  for (const link of document.querySelectorAll<HTMLAnchorElement>("#planets a")) link.textContent = (ja ? link.dataset["ja"] : link.dataset["en"]) ?? link.textContent;
};
window.addEventListener("wakusei-language", name);
name();
keep(pages.state);
document.body.dataset["ready"] = "true";
