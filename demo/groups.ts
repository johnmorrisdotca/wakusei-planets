// The planet on top, and every moon below it in the catalogue's families. A moon the package draws in full uses that picture. The rest are estimated rocks, named with the star the rock already carries.
import { WORDS } from "./words.js";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import "../src/element.ts";
import "../src/bodies/jupiter.ts";
import "../src/bodies/saturn.ts";
import "../src/bodies/uranus.ts";
import "../src/bodies/neptune.ts";
import "../src/bodies/moons-jupiter.ts";
import "../src/bodies/moons-saturn.ts";
import "../src/bodies/moons-uranus.ts";
import "../src/bodies/moons-neptune.ts";
import { BODIES, ringReach } from "../src/facts.ts";
import { moonGroupPoster, MOON_PAGE_HOSTS, type GroupMoon, type MoonGroup } from "../src/moon-groups.ts";
import type { MoonPageHost } from "../src/moon-pages/data.ts";
import { estimatedRock } from "../src/scene/estimated-rock.ts";

setThreeLoader(() => import("./three-subset.ts"));

const planets = document.querySelector<HTMLElement>("#group-planets")!;
const planet = document.querySelector<HTMLElement>("#group-planet")!;
const groups = document.querySelector<HTMLElement>("#groups")!;
const legend = document.querySelector<HTMLElement>("#groups-legend")!;

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

function hostFromAddress(): MoonPageHost {
  const asked = new URLSearchParams(location.search).get("planet");
  return (MOON_PAGE_HOSTS as readonly string[]).includes(asked ?? "") ? asked as MoonPageHost : "jupiter";
}

function bodyOf(id: string): WakuseiBody {
  const body = document.createElement("wakusei-body") as WakuseiBody;
  body.setAttribute("body", id);
  body.setAttribute("look", "painted");
  body.setAttribute("live", "off");
  body.setAttribute("fit", "tight");
  body.setAttribute("labels", "off");
  body.setAttribute("texture-base", "textures/");
  return body;
}

function moonOf(moon: GroupMoon): HTMLElement {
  const item = document.createElement("figure");
  item.className = "group-moon";
  item.dataset.moon = moon.id;
  item.append(bodyOf(moon.id));
  const caption = document.createElement("figcaption");
  const line = lang() === "ja" ? moon.line.ja : moon.line.en;
  caption.textContent = `${moon.number}. ${line}`;
  if (moon.estimated) caption.title = lang() === "ja" ? estimatedRock(moon.id)!.note.ja : estimatedRock(moon.id)!.note.en;
  item.append(caption);
  return item;
}

function groupOf(group: MoonGroup): HTMLElement {
  const section = document.createElement("section");
  section.className = "moon-group";
  section.dataset.group = group.id;
  const heading = document.createElement("h3");
  heading.textContent = `${lang() === "ja" ? group.name.ja : group.name.en} · ${phrase("gp_count", { n: group.count })}`;
  const list = document.createElement("div");
  list.className = "group-moons";
  list.append(...group.moons.map(moonOf));
  section.append(heading, list);
  return section;
}

function paint(): void {
  const host = hostFromAddress();
  const rock = estimatedRock("himalia")!;
  legend.textContent = lang() === "ja" ? rock.legend.ja : rock.legend.en;
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
  const globe = bodyOf(host);
  planet.classList.toggle("clip-disc", host === "jupiter");
  planet.replaceChildren(globe);
  globe.setView({ zoom: Math.max(1.06, ringReach(BODIES[host]) * 1.04) });
  groups.replaceChildren(...moonGroupPoster(host).map(groupOf));
  for (const body of groups.querySelectorAll("wakusei-body")) {
    if (body.getAttribute("data-shape") === "estimated") (body as WakuseiBody).setView({ zoom: 0.72 });
  }
  document.body.dataset.ready = "true";
  document.body.dataset.planet = host;
}

paint();
window.addEventListener("wakusei-language", paint);
