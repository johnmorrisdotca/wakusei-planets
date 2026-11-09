// The colouring sheets page: pick a sheet and the paper, see the sheet as it will print, press Print / save PDF. The sheet is the same DOM that is printed (kazoku-ui's print part).
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { printCss, printSheet, wordsFor } from "@johnmorrisdotca/kazoku-ui/print";
import type { PageName } from "@johnmorrisdotca/kazoku-ui/print";
import { PLANET_IDS } from "../src/facts.ts";
import { kidsLayout, kidsSheet, kidsTitle } from "../src/kids/sheet.ts";
import { KIDS_BODIES, KIDS_SHEETS, type KidsSheet } from "../src/kids/data.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): "en" | "ja" => chooser()?.lang ?? "en";
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

const PAPERS: readonly PageName[] = ["a4", "letter", "a3", "tabloid"];
const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const state = { sheet: pick<KidsSheet>(address.get("sheet"), KIDS_SHEETS, "saturn"), paper: pick<PageName>(address.get("paper"), PAPERS, "a4") };

const groups: [string, readonly KidsSheet[]][] = [
  ["#bodies", ["sun", ...PLANET_IDS] as KidsSheet[]],
  ["#moons", KIDS_BODIES.filter((id) => !["sun", ...PLANET_IDS].includes(id))],
  ["#all", ["lineup"]],
];
for (const [selector, ids] of groups) {
  for (const id of ids) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["sheet"] = id;
    $(selector).append(button);
  }
}

let sheet: HTMLElement | undefined;

function fit(): void {
  const inner = $("#paper-inner");
  inner.style.transform = "none";
  inner.style.width = "";
  inner.style.marginLeft = "0";
  const first = inner.querySelector<HTMLElement>(".kazoku-page");
  if (first === null) return;
  const natural = first.getBoundingClientRect().width;
  const scale = Math.min(1, $("#paper").clientWidth / natural);
  inner.style.width = `${natural}px`;
  inner.style.transform = `scale(${scale})`;
  inner.style.marginLeft = `${Math.max(0, ($("#paper").clientWidth - natural * scale) / 2)}px`;
  $("#paper").style.height = `${inner.scrollHeight * scale}px`;
}

function render(): void {
  const language = lang();
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-sheet]")) {
    const id = button.dataset["sheet"] as KidsSheet;
    button.textContent = kidsTitle(id, language);
    button.setAttribute("aria-pressed", String(id === state.sheet));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-paper]")) button.setAttribute("aria-pressed", String(button.dataset["paper"] === state.paper));
  $("#print").textContent = wordsFor(language).button;
  $<HTMLAnchorElement>("#pdfs").setAttribute("href", language === "ja" ? "pdf/ja.html" : "pdf/");
  const options = { page: state.paper, language };
  let style = document.getElementById("kids-style");
  if (style === null) {
    style = document.createElement("style");
    style.id = "kids-style";
    document.head.append(style);
  }
  style.textContent = printCss(kidsLayout(state.sheet, options));
  sheet = kidsSheet(state.sheet, options);
  $("#paper-inner").replaceChildren(sheet);
  const turn = kidsLayout(state.sheet, options).orientation === "landscape" ? "kd_wide" : "kd_tall";
  $("#info").textContent = say("kd_info", { paper: say(`kd_${state.paper}`), turn: say(turn), pages: say("kd_one") });
  fit();
}

function choose(change: Partial<typeof state>): void {
  Object.assign(state, change);
  address.set("sheet", state.sheet);
  address.set("paper", state.paper);
  render();
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-sheet]")) button.addEventListener("click", () => choose({ sheet: button.dataset["sheet"] as KidsSheet }));
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-paper]")) button.addEventListener("click", () => choose({ paper: button.dataset["paper"] as PageName }));
$("#print").addEventListener("click", () => {
  if (sheet !== undefined) printSheet(sheet);
});
window.addEventListener("wakusei-language", render);
window.addEventListener("resize", fit);
render();
