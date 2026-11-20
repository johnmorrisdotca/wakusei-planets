// Mercury through Pluto. The count is the catalogue's. A few moons are drawn; the rest of a world's moons are a number. An estimated rock keeps the star it already carries.
import { WORDS } from "./words.js";
import { setThreeLoader, type WakuseiBody } from "../src/element.ts";
import "../src/element.ts";
import "../src/bodies/mercury.ts";
import "../src/bodies/venus.ts";
import "../src/bodies/earth.ts";
import "../src/bodies/mars.ts";
import "../src/bodies/jupiter.ts";
import "../src/bodies/saturn.ts";
import "../src/bodies/uranus.ts";
import "../src/bodies/neptune.ts";
import "../src/bodies/pluto.ts";
import "../src/bodies/moons-earth.ts";
import "../src/bodies/moons-mars.ts";
import "../src/bodies/moons-jupiter.ts";
import "../src/bodies/moons-saturn.ts";
import "../src/bodies/moons-uranus.ts";
import "../src/bodies/moons-neptune.ts";
import "../src/bodies/moons-pluto.ts";
import { ALL_MOON_READ, allMoonPoster, type AllMoonRow, type AllMoonShown } from "../src/all-moons.ts";
import { BODIES, ringReach } from "../src/facts.ts";
import { estimatedRock } from "../src/scene/estimated-rock.ts";

setThreeLoader(() => import("./three-subset.ts"));

const rows = document.querySelector<HTMLElement>("#all-rows")!;
const legend = document.querySelector<HTMLElement>("#all-legend")!;
const source = document.querySelector<HTMLElement>("#all-source")!;
const CLIP = new Set(["uranus", "neptune"]);

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

function moonOf(moon: AllMoonShown): HTMLElement {
  const item = document.createElement("figure");
  item.className = "all-moon";
  item.dataset.moon = moon.id;
  const body = bodyOf(moon.id);
  item.append(body);
  const caption = document.createElement("figcaption");
  caption.textContent = lang() === "ja" ? moon.line.ja : moon.line.en;
  if (moon.estimated) caption.title = lang() === "ja" ? estimatedRock(moon.id)!.note.ja : estimatedRock(moon.id)!.note.en;
  item.append(caption);
  return item;
}

function rowOf(row: AllMoonRow): HTMLElement {
  const article = document.createElement("article");
  article.className = "all-row";
  article.dataset.host = row.id;
  if (row.most) article.dataset.most = "true";
  const frame = document.createElement("div");
  frame.className = CLIP.has(row.id) ? "all-planet clip-disc" : "all-planet";
  const globe = bodyOf(row.id);
  frame.append(globe);
  const copy = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = lang() === "ja" ? row.name.ja : row.name.en;
  const count = document.createElement("p");
  count.className = "all-count";
  count.textContent = row.total === 0 ? phrase("am_none") : row.total === 1 ? phrase("am_one") : phrase("am_count", { n: row.total });
  const moons = document.createElement("div");
  moons.className = "all-moons";
  moons.append(...row.shown.map(moonOf));
  if (row.more > 0) {
    const more = document.createElement("p");
    more.className = "all-more";
    more.textContent = phrase("am_more", { n: row.more });
    moons.append(more);
  }
  const note = document.createElement("p");
  note.className = "all-note";
  note.textContent = row.total === 0 ? phrase("am_none_note") : row.more === 0 ? phrase("am_all") : phrase("am_shown", { n: row.shown.length });
  if (row.most) note.textContent = `${note.textContent} ${phrase("am_most")}`;
  copy.append(heading, count, moons, note);
  article.append(frame, copy);
  return article;
}

function paint(): void {
  const rock = estimatedRock("kerberos")!;
  legend.textContent = lang() === "ja" ? rock.legend.ja : rock.legend.en;
  const poster = allMoonPoster();
  rows.replaceChildren(...poster.map(rowOf));
  for (const article of rows.querySelectorAll<HTMLElement>(".all-row")) {
    const host = article.dataset.host ?? "";
    const globe = article.querySelector<WakuseiBody>(".all-planet wakusei-body");
    if (globe === null || !(host in BODIES)) continue;
    const zoom = host === "saturn" ? 1 : CLIP.has(host) ? Math.max(1.06, ringReach(BODIES[host as keyof typeof BODIES]) * 1.04) : 1;
    globe.setView({ zoom });
  }
  for (const body of rows.querySelectorAll<WakuseiBody>(".all-moon wakusei-body")) body.setView({ zoom: 0.78 });
  const total = poster.reduce((sum, row) => sum + row.total, 0);
  source.textContent = `${phrase("am_total", { n: total })} ${phrase("am_source", { date: ALL_MOON_READ })}`;
  document.body.dataset.ready = "true";
}

paint();
window.addEventListener("wakusei-language", paint);
