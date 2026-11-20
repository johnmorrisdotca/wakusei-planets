// The moon-count grid: nine painted planets, Mercury through Pluto, each with its count from the catalogue.
import { WORDS } from "./words.js";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import "../src/element.ts";
import "../src/bodies/mercury.ts";
import "../src/bodies/venus.ts";
import "../src/bodies/earth-look.ts";
import "../src/bodies/mars.ts";
import "../src/bodies/jupiter.ts";
import "../src/bodies/saturn.ts";
import "../src/bodies/uranus.ts";
import "../src/bodies/neptune.ts";
import "../src/bodies/pluto.ts";
import { BODIES, ringReach } from "../src/facts.ts";
import { MOON_COUNT_READ, moonCountGrid, moonCountHref, type MoonCountRow } from "../src/moon-counts.ts";

setThreeLoader(() => import("./three-subset.ts"));

const list = document.querySelector<HTMLOListElement>("#counts")!;

function lang(): "en" | "ja" {
  return document.documentElement.lang === "ja" ? "ja" : "en";
}

function phrase(key: string, vars?: Record<string, string | number>): string {
  let text = WORDS[lang()][key] ?? WORDS.en[key] ?? key;
  if (vars !== undefined) {
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function countText(total: number): string {
  if (total === 0) return phrase("ct_none");
  if (total === 1) return phrase("ct_one");
  return phrase("ct_moons", { n: total });
}

function card(row: MoonCountRow): HTMLLIElement {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "count";
  link.href = moonCountHref(row.id);
  link.dataset.host = row.id;
  if (row.most) link.dataset.most = "true";
  const globe = document.createElement("div");
  globe.className = row.id === "jupiter" ? "count-globe clip-disc" : "count-globe";
  const body = document.createElement("wakusei-body") as WakuseiBody;
  body.setAttribute("body", row.id);
  body.setAttribute("look", "painted");
  body.setAttribute("live", "off");
  body.setAttribute("fit", "tight");
  body.setAttribute("labels", "off");
  body.setAttribute("texture-base", "textures/");
  globe.append(body);
  const name = document.createElement("b");
  name.className = "count-name";
  const total = document.createElement("span");
  total.className = "count-n";
  link.append(globe, name, total);
  if (row.most) {
    const mark = document.createElement("span");
    mark.className = "count-most";
    link.append(mark);
  }
  item.append(link);
  return item;
}

const rows = moonCountGrid();
list.replaceChildren(...rows.map(card));
for (const body of list.querySelectorAll<WakuseiBody>("wakusei-body")) {
  const id = body.getAttribute("body");
  // The globe fills the tile. Rings run to the tile's edge and the tile crops them. Jupiter's ring plane is a faint rectangle beside the disc, so that one globe is clipped to a circle.
  if (id === "jupiter" || id === "saturn" || id === "uranus" || id === "neptune") body.setView({ zoom: Math.max(1.06, ringReach(BODIES[id]) * 1.04) });
}

function paint(): void {
  for (const row of rows) {
    const item = list.querySelector<HTMLLIElement>(`[data-host="${row.id}"]`);
    if (item === null) continue;
    item.querySelector(".count-name")!.textContent = lang() === "ja" ? row.name.ja : row.name.en;
    item.querySelector(".count-n")!.textContent = countText(row.total);
    const mark = item.querySelector(".count-most");
    if (mark !== null) mark.textContent = phrase("ct_most");
  }
  const source = document.querySelector("#counts-source");
  if (source !== null) source.textContent = phrase("ct_source", { date: MOON_COUNT_READ });
  document.body.dataset.ready = "true";
}

paint();
window.addEventListener("wakusei-language", paint);
