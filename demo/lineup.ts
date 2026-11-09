// The size line-up page: one <wakusei-lineup> with the stars (and, if asked, the Earth and Jupiter) at true relative size, the choices in rows of clicks kept in the address, a card for the body in frame with its radius,
// error, method and paper, "Save as an image" and "Print as a poster" (kazoku-ui's save-image and print parts), and "Put it in your page" with the code for what is on the screen.
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { buildSheet, printSheet, type PageName } from "@johnmorrisdotca/kazoku-ui/print";
import { saveImage, type Format } from "@johnmorrisdotca/kazoku-ui/save-image";
import { EMBED_KINDS, lineupCode, lineupCredit, type EmbedKind, type LineupEmbed } from "../src/embed.ts";
import { LINEUP_SETS, type LineupSet } from "../src/lineup/data.ts";
import { lineupText, type LineupLang } from "../src/lineup/labels.ts";
import { LINEUP_LAYOUTS, lineupZoomOf, placeLineup, type LineupLayout } from "../src/lineup/layout.ts";
import { VERSION } from "../src/version.ts";
import "../src/lineup/element.ts";
import { setThreeLoader, type WakuseiLineup } from "../src/lineup/element.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: LineupLang; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: LineupLang; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): LineupLang => chooser()?.lang ?? "en";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
const pressed = (button: HTMLElement, on: boolean): void => {
  button.setAttribute("aria-pressed", String(on));
  button.classList.toggle("on", on);
};

setThreeLoader(() => import("./three-subset.ts"));

const lineup = $<WakuseiLineup>("#lineup");
const panel = $<EmbedPanelElement>("#embed-panel");
const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const PAPERS: readonly PageName[] = ["a4", "letter"];

const state = {
  stars: pick<LineupSet>(address.get("stars"), LINEUP_SETS, "all"),
  planets: address.get("planets") === "1",
  layout: pick<LineupLayout>(address.get("layout"), LINEUP_LAYOUTS, "row"),
  turn: address.get("turn") !== "off",
  paper: pick<PageName>(address.get("paper"), PAPERS, "a4"),
};

function setAttributes(): void {
  lineup.setAttribute("stars", state.stars);
  if (state.planets) lineup.setAttribute("planets", "");
  else lineup.removeAttribute("planets");
  lineup.setAttribute("layout", state.layout);
  // turning is the element's default (and stays off under reduced motion, which the reader chose); only "off" is written
  if (state.turn) lineup.removeAttribute("turn");
  else lineup.setAttribute("turn", "off");
  lineup.setAttribute("lang", lang());
  lineup.setAttribute("texture-base", "textures/");
}
setAttributes();
const first = Number(address.get("zoom"));
if (address.get("zoom") !== null && Number.isFinite(first)) lineup.zoom = first;

/** The zoom at which the camera is exactly on a body, if it is, else `undefined`. */
const onBody = (): string | undefined => {
  const near = lineup.bodies.find((body) => Math.abs((lineupZoomOf(placeLineup(lineup.bodies, state.layout), body.id) ?? -1) - lineup.zoom) < 0.0005);
  return near?.id;
};

const status = $("#status");
const goBox = $("#go");

function renderChips(): void {
  const lng = lang();
  const ids = lineup.bodies.map((body) => body.id);
  if ([...goBox.children].map((child) => (child as HTMLElement).dataset["go"]).join() !== ids.join()) {
    goBox.replaceChildren(
      ...lineup.bodies.map((body) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset["go"] = body.id;
        button.addEventListener("click", () => void lineup.zoomTo(body.id));
        return button;
      }),
    );
  }
  for (const button of $$("#go [data-go]")) {
    const body = lineup.bodies.find((one) => one.id === button.dataset["go"])!;
    button.textContent = body.name[lng];
    pressed(button, button.dataset["go"] === lineup.focused);
  }
}

/** One fact of the card: a term and its description. */
const fact = (term: string, ...parts: (string | Node)[]): [HTMLElement, HTMLElement] => {
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.append(...parts);
  return [dt, dd];
};

function renderCard(): void {
  const lng = lang();
  const body = lineup.bodies.find((one) => one.id === lineup.focused);
  if (body === undefined) return;
  const text = lineupText(body, lng);
  $("#card-h").textContent = text.name;
  $("#card-lead").textContent = `${text.radius} · ${text.km}`;
  const facts: [HTMLElement, HTMLElement][] = [fact(say("lu_card_radius"), text.radius), fact(say("lu_card_km"), text.km)];
  const row = body.row;
  if (row === undefined) facts.push(fact(say("lu_card_method"), say("lu_planet_method")));
  else {
    const basis = document.createElement("span");
    basis.className = "fam-badge";
    basis.dataset["tone"] = text.estimated ? "bad" : "good";
    basis.dataset["basis"] = row.basis;
    basis.textContent = say(row.basis === "defined" ? "lu_defined" : text.estimated ? "lu_estimated" : "lu_measured");
    facts.push(fact(say("lu_card_basis"), basis), fact(say("lu_card_method"), text.method));
    const links = row.bibcodes.flatMap((code, i) => {
      const a = document.createElement("a");
      a.href = `https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(code)}/abstract`;
      a.textContent = code;
      a.rel = "noopener";
      return i === 0 ? [a] : [", ", a];
    });
    facts.push(fact(say("lu_card_source"), `${row.cite} (`, ...links, ")"), fact(say("lu_card_read"), row.read));
  }
  $("#card-facts").replaceChildren(...facts.flat());
  const note = $("#card-note");
  note.textContent = text.note === "" ? "" : `${say("lu_card_note")}: ${text.note}`;
  note.hidden = text.note === "";
  const others = $("#card-others");
  others.replaceChildren(
    ...(row?.others ?? []).map((other) => {
      const item = document.createElement("li");
      item.textContent = `${other.radiusSun.toLocaleString("en-US")} ${lng === "ja" ? "" : "Suns "}· ${other.cite}: ${other.why[lng]}`;
      return item;
    }),
  );
  others.hidden = (row?.others ?? []).length === 0;
  $("#caption").textContent = say("lu_caption", { name: text.name, radius: text.radius, km: text.km });
}

function render(): void {
  lineup.setAttribute("lang", lang());
  for (const b of $$("#stars [data-stars]")) pressed(b, b.dataset["stars"] === state.stars);
  for (const b of $$("#planets [data-planets]")) pressed(b, (b.dataset["planets"] === "1") === state.planets);
  for (const b of $$("#layouts [data-layout]")) pressed(b, b.dataset["layout"] === state.layout);
  for (const b of $$("#turns [data-turn]")) pressed(b, (b.dataset["turn"] === "on") === state.turn);
  for (const b of $$("#papers [data-paper]")) pressed(b, b.dataset["paper"] === state.paper);
  renderChips();
  renderCard();
  address.set("stars", state.stars === "all" ? null : state.stars);
  address.set("planets", state.planets ? "1" : null);
  address.set("layout", state.layout === "row" ? null : state.layout);
  address.set("turn", state.turn ? null : "off");
  address.set("paper", state.paper === "a4" ? null : state.paper);
  const at = onBody();
  address.set("zoom", at === "sun" ? null : String(Math.round(lineup.zoom * 1000) / 1000));
  renderEmbed();
}

// --- choices ------------------------------------------------------------------------------------------------------------------------------------------
for (const b of $$("#stars [data-stars]")) b.addEventListener("click", () => ((state.stars = pick<LineupSet>(b.dataset["stars"] ?? null, LINEUP_SETS, "all")), setAttributes(), render()));
for (const b of $$("#planets [data-planets]")) b.addEventListener("click", () => ((state.planets = b.dataset["planets"] === "1"), setAttributes(), render()));
for (const b of $$("#layouts [data-layout]")) b.addEventListener("click", () => ((state.layout = pick<LineupLayout>(b.dataset["layout"] ?? null, LINEUP_LAYOUTS, "row")), setAttributes(), render()));
for (const b of $$("#turns [data-turn]")) b.addEventListener("click", () => ((state.turn = b.dataset["turn"] === "on"), setAttributes(), render()));
for (const b of $$("#papers [data-paper]")) b.addEventListener("click", () => ((state.paper = pick<PageName>(b.dataset["paper"] ?? null, PAPERS, "a4")), render()));
lineup.addEventListener("wakusei-lineup-zoom", () => render());
window.addEventListener("wakusei-language", () => render());

// --- save as an image, print as a poster -----------------------------------------------------------------------------------------------------------------
const say2 = (text: string): void => {
  status.textContent = text;
};

/** The picture on the screen as an SVG kept out of sight while kazoku-ui's save-image reads it (it needs the picture in the page to read its styles). */
async function offscreen<T>(use: (svg: SVGSVGElement) => Promise<T>): Promise<T> {
  const svg = await lineup.picture();
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none";
  holder.append(svg);
  document.body.append(holder);
  try {
    return await use(svg);
  } finally {
    holder.remove();
  }
}

async function save(format: Format): Promise<void> {
  say2(say("lu_saving"));
  try {
    await offscreen((svg) => saveImage(svg, { format, name: `size-lineup-${lineup.focused ?? "sun"}`, scale: 2 }));
    say2("");
  } catch {
    say2(say("lu_error"));
  }
}
for (const b of $$("#saves [data-save]")) b.addEventListener("click", () => void save(b.dataset["save"] as Format));

async function printPoster(): Promise<void> {
  say2(say("lu_saving"));
  try {
    const lng = lang();
    const svg = await lineup.picture();
    // the picture fills the page's body: the SVG scales to it, keeping its shape
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("style", "display:block;width:100%;height:100%");
    const holder = document.createElement("div");
    holder.style.cssText = "position:absolute;inset:0";
    holder.append(svg);
    const body = lineup.bodies.find((one) => one.id === lineup.focused);
    const text = body === undefined ? undefined : lineupText(body, lng);
    const sheet = buildSheet({
      page: state.paper,
      orientation: "landscape",
      type: "normal",
      language: lng,
      brand: "Space Program X",
      packageName: lng === "ja" ? "Wakusei Planets 惑星" : "Wakusei Planets",
      title: say("lu_poster_title", { name: text?.name ?? "" }),
      credits: say("lu_poster_credits"),
      version: VERSION,
      date: new Date(),
      address: location.href,
      nameBox: false,
      ...(text === undefined ? {} : { info: { more: [{ label: say("lu_card_radius"), value: text.radius }, { label: say("lu_card_km"), value: text.km }, { label: say("lu_card_source"), value: text.source }] } }),
      pages: [holder],
    });
    say2("");
    printSheet(sheet);
  } catch {
    say2(say("lu_error"));
  }
}
$("#print").addEventListener("click", () => void printPoster());

// --- "Put it in your page" ---------------------------------------------------------------------------------------------------------------------------
const embedOptions = (): LineupEmbed => {
  const at = onBody();
  return { stars: state.stars, planets: state.planets, layout: state.layout, turn: state.turn, lang: lang(), width: panel.size, ...(at === undefined ? { zoom: lineup.zoom } : { at }) };
};
panel.kinds = EMBED_KINDS;
const kept = address.get("embed");
if (EMBED_KINDS.includes(kept as EmbedKind)) panel.kind = kept as string;
panel.size = Number(address.get("size")) || 720;
panel.generate = ({ kind, preview }) => lineupCode(embedOptions(), kind as EmbedKind, preview ? { site: "" } : {});
panel.preview = ({ kind }) => {
  if (kind === "iframe") return undefined;
  const options = embedOptions();
  const element = document.createElement("wakusei-lineup") as WakuseiLineup;
  const query = new URLSearchParams(lineupCode(options, "iframe", { site: "" }).match(/src="([^"]*)"/)?.[1]?.split("?")[1] ?? "");
  for (const [name, value] of query) if (name !== "lineup") element.setAttribute(name, name === "planets" ? "" : value);
  for (const [name, value] of Object.entries({ size: String(panel.size), lang: lang(), live: "off", controls: "none", "texture-base": "textures/" })) element.setAttribute(name, value);
  return element;
};
panel.credits = () => lineupCredit(embedOptions());
panel.addEventListener("kazoku-embedchange", (event) => {
  const { kind, size } = (event as CustomEvent<EmbedChangeDetail>).detail;
  address.set("embed", kind === "html" ? null : kind);
  address.set("size", size === 720 ? null : String(size));
});
function renderEmbed(): void {
  const query = new URLSearchParams(lineupCode(embedOptions(), "iframe", { site: "" }).match(/src="([^"]*)"/)?.[1]?.split("?")[1] ?? "");
  panel.setAttribute("lang", lang());
  panel.openHref = `embed.html?${query.toString()}`;
  panel.update();
}

render();
