// The planet's edge, and its moons numbered I to XVI as dots sized by diameter. The moons are not pictures.
import { WORDS } from "./words.js";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import "../src/element.ts";
import "../src/bodies/jupiter.ts";
import "../src/bodies/saturn.ts";
import "../src/bodies/uranus.ts";
import "../src/bodies/neptune.ts";
import { BODIES, ringReach } from "../src/facts.ts";
import { moonDotColumn, MOON_PAGE_HOSTS, type MoonDot } from "../src/moon-dots.ts";
import type { MoonPageHost } from "../src/moon-pages/data.ts";

setThreeLoader(() => import("./three-subset.ts"));

const planets = document.querySelector<HTMLElement>("#dot-planets")!;
const edgePlanet = document.querySelector<HTMLElement>("#edge-planet")!;
const list = document.querySelector<HTMLOListElement>("#dots")!;

function lang(): "en" | "ja" {
  return document.documentElement.lang === "ja" ? "ja" : "en";
}

function phrase(key: string): string {
  return WORDS[lang()][key] ?? WORDS.en[key] ?? key;
}

function hostFromAddress(): MoonPageHost {
  const asked = new URLSearchParams(location.search).get("planet");
  return (MOON_PAGE_HOSTS as readonly string[]).includes(asked ?? "") ? asked as MoonPageHost : "jupiter";
}

function nameOf(row: MoonDot): string {
  return lang() === "ja" && row.ja !== null ? row.ja : row.label;
}

function rowOf(row: MoonDot, index: number): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "dot-row";
  item.dataset.moon = row.id;
  const n = document.createElement("span");
  n.className = "dot-n";
  n.textContent = String(index + 1);
  const mark = document.createElement("span");
  mark.className = "dot";
  mark.style.setProperty("--px", `${row.px}px`);
  mark.style.width = `${row.px}px`;
  mark.style.height = `${row.px}px`;
  if (row.radiusKm === null) mark.dataset.unknown = "true";
  const label = document.createElement("span");
  label.className = "dot-name";
  label.textContent = nameOf(row);
  if (row.estimate) {
    const est = document.createElement("span");
    est.className = "dot-est";
    est.textContent = phrase("dt_estimated");
    label.append(document.createTextNode(" "), est);
  } else if (row.radiusKm === null) {
    const unknown = document.createElement("span");
    unknown.className = "dot-est";
    unknown.textContent = phrase("dt_unknown");
    label.append(document.createTextNode(" "), unknown);
  }
  item.append(n, mark, label);
  return item;
}

function paint(): void {
  const host = hostFromAddress();
  planets.replaceChildren(...MOON_PAGE_HOSTS.map((id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.host = id;
    button.textContent = lang() === "ja" ? BODIES[id].name.ja : BODIES[id].name.en;
    button.setAttribute("aria-pressed", id === host ? "true" : "false");
    button.addEventListener("click", () => {
      const query = new URLSearchParams(location.search);
      query.set("planet", id);
      history.replaceState(null, "", `${location.pathname}?${query}`);
      paint();
    });
    return button;
  }));
  const body = document.createElement("wakusei-body") as WakuseiBody;
  body.setAttribute("body", host);
  body.setAttribute("look", "painted");
  body.setAttribute("live", "off");
  body.setAttribute("fit", "tight");
  body.setAttribute("labels", "off");
  body.setAttribute("texture-base", "textures/");
  edgePlanet.replaceChildren(body);
  body.setView({ zoom: Math.max(1.06, ringReach(BODIES[host]) * 1.04) });
  list.replaceChildren(...moonDotColumn(host).map(rowOf));
  document.body.dataset.ready = "true";
  document.body.dataset.planet = host;
}

paint();
window.addEventListener("wakusei-language", paint);
