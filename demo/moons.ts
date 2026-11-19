// A giant planet's moon page: four tabs over one planet's moons. Every number is in the page as JSON, worked out from the package's data when the site was built (scripts/moon-pages.ts).
// Orbits: every orbit of the moon list drawn in SVG, seen from above, at an angle or from the side, coloured by direction or by family. Map and portrait: <wakusei-plan> and <wakusei-portrait>.
// Main moons: a card with a picture for each moon drawn in full. Every moon: the list in a table that sorts. The 3D parts are made only when their tab is first opened. The choices are kept in the address.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import { BODIES, MOONS_OF, type BodyId } from "../src/facts.ts";
import { addBody, addMoons, defaultPortrait, encodeScene } from "../src/portrait/model.ts";
import "../src/element.ts";
import "../src/plan/element.ts";
import "../src/portrait/element.ts";
import "../src/bodies/all.ts";
import { setThreeLoader } from "../src/element.ts";
import { setThreeLoader as setPortraitThreeLoader } from "../src/portrait/element.ts";
import type { PlanPick } from "../src/plan/element.ts";
import type { MoonPage, PageMoon } from "../scripts/moon-pages.ts";
import { WORDS } from "./words.js";

type Lang = "en" | "ja";
const chooser = (): { lang: Lang; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: Lang; word(key: string): string | undefined } | undefined;
const lang = (): Lang => chooser()?.lang ?? "en";
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const $ = <T extends Element = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const $$ = <T extends Element = HTMLButtonElement>(selector: string): T[] => [...document.querySelectorAll<T>(selector)];
const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pressed = (button: Element, on: boolean): void => button.setAttribute("aria-pressed", String(on));

setThreeLoader(() => import("./three-subset.ts"));
setPortraitThreeLoader(() => import("./three-subset.ts"));

const data = JSON.parse($("#moon-data").textContent!) as MoonPage;
const host = data.host;
const planetName = (): string => data.name[lang()];
const moonName = (m: Pick<PageMoon, "en" | "ja">): string => (lang() === "ja" && m.ja !== null ? m.ja : m.en);
const number = (n: number, digits = 0): string => n.toLocaleString(lang() === "ja" ? "ja-JP" : "en-CA", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const dayText = (): string => new Date(data.time).toLocaleDateString(lang() === "ja" ? "ja-JP" : "en-CA", { dateStyle: "long", timeZone: "UTC" });
const NONE = "—";
const diameter = (radius: number): string => {
  const d = 2 * radius;
  return number(d, d < 10 ? 1 : 0);
};
const period = (days: number): string => number(days, days < 10 ? 2 : 1);

// --- the choices, kept in the address --------------------------------------------------------------------------------------------------------------------
const TABS = ["orbits", "views", "cards", "table"] as const;
const VIEWS = ["above", "tilted", "side"] as const;
const REACHES = ["all", "inner"] as const;
const COLOURS = ["direction", "group"] as const;
const COLUMNS = ["name", "family", "size", "distance", "period", "year", "where", "by", "direction"] as const;
type Tab = (typeof TABS)[number];
type View = (typeof VIEWS)[number];
type Column = (typeof COLUMNS)[number];
const address = createAddressState({ defaults: {} });
const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const state = {
  tab: pick<Tab>(address.get("tab"), TABS, "orbits"),
  view: pick<View>(address.get("view"), VIEWS, "tilted"),
  reach: pick(address.get("reach"), REACHES, "all"),
  colour: pick(address.get("colour"), COLOURS, "direction"),
  sort: pick<Column>(address.get("sort"), COLUMNS, "distance"),
  down: address.get("order") === "down",
  picked: null as string | null,
};
/** The choices that differ from the defaults, as the address writes them. */
const choices = (): [string, string | null][] => [
  ["tab", state.tab === "orbits" ? null : state.tab],
  ["view", state.view === "tilted" ? null : state.view],
  ["reach", state.reach === "all" ? null : state.reach],
  ["colour", state.colour === "direction" ? null : state.colour],
  ["sort", state.sort === "distance" ? null : state.sort],
  ["order", state.down ? "down" : null],
];
const keep = (): void => {
  for (const [key, value] of choices()) address.set(key, value);
  // the other planets' links carry the same choices (and a language asked for in the address), so a move to Saturn keeps the tab and the view
  const query = new URLSearchParams();
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked !== null) query.set("lang", asked);
  for (const [key, value] of choices()) if (value !== null) query.set(key, value);
  const tail = query.toString();
  for (const link of $$<HTMLAnchorElement>("#planets a")) link.href = `${link.dataset["host"]}.html${tail === "" ? "" : `?${tail}`}`;
};

// --- the orbits --------------------------------------------------------------------------------------------------------------------------------------------
const ELEVATION: Record<View, number> = { above: 90, tilted: 30, side: 0 };
const svg = $<SVGSVGElement>("#orbits");
const placed = data.moons.filter((m) => m.orbit !== null);
const reachAll = Math.max(...placed.map((m) => Math.max(...m.orbit!.map(Math.abs))));
/** A point of the planet's frame on the screen: x along the equator, y up the screen, for a viewer `elevation` degrees above the equator. */
const project = (x: number, y: number, z: number, elevation: number): [number, number] => {
  const e = (elevation * Math.PI) / 180;
  return [x, y * Math.sin(e) + z * Math.cos(e)];
};
let drawn: { id: string; points: [number, number][] }[] = [];
/** Half the picture's width and half its height, in the page's units. */
let extent = 1;
let tall = 1;

function drawOrbits(): void {
  const elevation = ELEVATION[state.view];
  const rad = (elevation * Math.PI) / 180;
  const reach = state.reach === "all" ? reachAll : data.inner;
  // the picture is as tall as the orbits that fit across it reach up and down from this angle, so a tilted view is not mostly empty
  let up = 0;
  for (const moon of placed) {
    const o = moon.orbit!;
    let fits = true;
    let high = 0;
    for (let k = 0; k < o.length; k += 3) {
      if (Math.abs(o[k]!) > reach * 1.001) fits = false;
      high = Math.max(high, Math.abs(project(o[k]!, o[k + 1]!, o[k + 2]!, elevation)[1]));
    }
    if (fits) up = Math.max(up, high);
  }
  extent = reach * 1.06;
  tall = Math.min(extent, Math.max(up * 1.06, extent * 0.4));
  svg.style.setProperty("--ratio", String(extent / tall));
  // the more lines, the fainter each: Saturn's 292 would otherwise be a solid block
  svg.style.setProperty("--line", String(Math.min(0.6, 6 / Math.sqrt(placed.length))));
  svg.setAttribute("viewBox", `${-extent} ${-tall} ${2 * extent} ${2 * tall}`);
  const size = svg.getBoundingClientRect().width || 600;
  const px = (2 * extent) / size;
  const parts: string[] = [];
  const planetR = Math.max(data.radiusKm / data.unit, 4 * px);
  // the far half of each orbit is drawn first, the planet, then the near half: a moon in front of the planet is in front of it
  const front: string[] = [];
  drawn = [];
  // the irregular moons first and the moons drawn in full last, so the big moons' lines lie on top
  const order = [...placed].sort((a, b) => Number(a.full) - Number(b.full) || (b.a ?? 0) - (a.a ?? 0));
  for (const moon of order) {
    const o = moon.orbit!;
    const points: [number, number][] = [];
    const depth: number[] = [];
    for (let k = 0; k < o.length; k += 3) {
      const [sx, sy] = project(o[k]!, o[k + 1]!, o[k + 2]!, elevation);
      points.push([sx, -sy]);
      depth.push(-o[k + 1]! * Math.cos(rad) + o[k + 2]! * Math.sin(rad));
    }
    drawn.push({ id: moon.id, points });
    const colour = moon.colour[state.colour];
    const width = moon.full ? 1.8 : 1;
    // seen from above everything is one path; otherwise the half nearer the viewer than the planet is drawn after it
    const path = (side: "all" | "far" | "near"): string => {
      // each step of the line goes to the side its middle is on, so the two halves meet with no gap
      const n = points.length;
      const inside = (k: number): boolean => side === "all" || (depth[k % n]! + depth[(k + 1) % n]! > 0) === (side === "near");
      let d = "";
      for (let k = 0; k < n; k += 1) {
        if (!inside(k)) continue;
        if (k === 0 || !inside(k - 1)) d += `M${points[k]![0]} ${points[k]![1]}`;
        const [x, y] = points[(k + 1) % n]!;
        d += `L${x} ${y}`;
      }
      return d === "" ? "" : `<path d="${d}" stroke="${colour}" stroke-width="${width}" data-id="${moon.id}" data-dir="${moon.retro === 1 ? "retrograde" : "prograde"}"${moon.full ? ' data-full=""' : ""}/>`;
    };
    if (elevation === 90) parts.push(path("all"));
    else {
      parts.push(path("far"));
      front.push(path("near"));
    }
  }
  const dots: string[] = [];
  const names: string[] = [];
  const dotR = 2.6 * px;
  for (const moon of placed) {
    if (moon.at === null) continue;
    const [sx, sy] = project(moon.at[0], moon.at[1], moon.at[2], elevation);
    if (Math.abs(sx) > extent || Math.abs(sy) > tall) continue;
    dots.push(`<circle cx="${sx}" cy="${-sy}" r="${moon.full ? dotR * 1.4 : dotR}" fill="${moon.colour[state.colour]}" data-id="${moon.id}"/>`);
    if (moon.full && (state.reach === "inner" || (moon.a ?? 0) / data.unit > extent / 8)) names.push(`<text x="${sx + 5 * px}" y="${-sy - 5 * px}" font-size="${12 * px}">${escape(moonName(moon))}</text>`);
  }
  const title = say(`mn_view_${state.view}`, { planet: planetName() });
  svg.innerHTML = `<title>${escape(title)}</title><g class="lines" fill="none" stroke-linejoin="round">${parts.join("")}</g><circle class="planet" cx="0" cy="0" r="${planetR}" fill="${data.colour}"/><g class="lines" fill="none" stroke-linejoin="round">${front.join("")}</g><g class="dots">${dots.join("")}</g><g class="names" fill="currentColor">${names.join("")}</g><g class="lit" fill="none"></g>`;
  svg.dataset["view"] = state.view;
  svg.dataset["reach"] = state.reach;
  svg.dataset["colour"] = state.colour;
  svg.dataset["orbits"] = String(placed.length);
  light(state.picked);
}

/** The orbit under a point of the picture (within 10 CSS pixels), or null. */
function nearest(clientX: number, clientY: number): string | null {
  const box = svg.getBoundingClientRect();
  if (box.width === 0) return null;
  const k = (2 * extent) / box.width;
  const x = (clientX - box.left) * k - extent;
  const y = (clientY - box.top) * k - tall;
  let best: string | null = null;
  let bestD = 10 * k;
  for (const orbit of drawn) {
    const p = orbit.points;
    for (let i = 0; i < p.length; i += 1) {
      const [ax, ay] = p[i]!;
      const [bx, by] = p[(i + 1) % p.length]!;
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      if (d < bestD) {
        bestD = d;
        best = orbit.id;
      }
    }
  }
  return best;
}

/** Light one orbit and say whose it is. */
function light(id: string | null): void {
  state.picked = id;
  const lit = svg.querySelector(".lit");
  const moon = id === null ? undefined : data.moons.find((m) => m.id === id);
  const orbit = id === null ? undefined : drawn.find((o) => o.id === id);
  if (lit !== null) {
    lit.innerHTML = moon === undefined || orbit === undefined ? "" : `<path d="M${orbit.points.map(([x, y]) => `${x} ${y}`).join("L")}Z" stroke="${moon.colour[state.colour]}" stroke-width="3.2"/>`;
  }
  svg.dataset["picked"] = id ?? "";
  $("#pick").textContent =
    moon === undefined || moon.a === null || moon.p === null
      ? ""
      : say("mn_pick", { name: moonName(moon), direction: say(moon.retro === 1 ? "mn_retrograde" : "mn_prograde"), distance: number(moon.a), planet: planetName(), period: period(moon.p) });
}

svg.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse") light(nearest(event.clientX, event.clientY));
});
svg.addEventListener("pointerdown", (event) => light(nearest(event.clientX, event.clientY)));

function drawKey(): void {
  const entries = data.key[state.colour];
  $("#key").innerHTML = entries
    .filter((entry) => entry.count > 0)
    .map((entry) => `<li data-key="${entry.id}"><span class="moons-swatch" style="background:${entry.color}"></span><span>${escape(entry.names[lang()])}</span> <b>${number(entry.count)}</b></li>`)
    .join("");
}

// --- the map and the portrait --------------------------------------------------------------------------------------------------------------------------
let plan: HTMLElement | undefined;
let portrait: HTMLElement | undefined;
const featured = MOONS_OF[host] as readonly string[];
function mountViews(): void {
  if (plan === undefined) {
    plan = document.createElement("wakusei-plan");
    plan.setAttribute("system", host);
    plan.setAttribute("size", "300");
    plan.setAttribute("time", String(data.time));
    plan.setAttribute("mark", featured[0]!);
    plan.dataset["testid"] = "plan";
    plan.addEventListener("wakusei-plan-pick", (event) => plan!.setAttribute("mark", (event as CustomEvent<PlanPick>).detail.id));
    $("#plan-box").append(plan);
  }
  if (portrait === undefined) {
    portrait = document.createElement("wakusei-portrait");
    const scene = { ...addMoons(addBody(defaultPortrait(), host as BodyId), host as BodyId), arrange: "row" as const, scale: "readable" as const, orbits: false };
    portrait.setAttribute("scene", encodeScene(scene));
    portrait.setAttribute("texture-base", "textures/");
    portrait.dataset["testid"] = "portrait";
    $("#portrait-box").append(portrait);
  }
  plan.setAttribute("lang", lang());
  portrait.setAttribute("lang", lang());
  $("#plan-caption").textContent = say("mn_plan_caption", { planet: planetName(), date: dayText() });
  $("#portrait-caption").textContent = say("mn_portrait_caption", { planet: planetName() });
}

// --- the cards ---------------------------------------------------------------------------------------------------------------------------------------------
let cardsMade = false;
function drawCards(): void {
  const list = $("#cards");
  if (!cardsMade) {
    cardsMade = true;
    list.replaceChildren(
      ...data.cards.map((card) => {
        const item = document.createElement("li");
        item.className = "moons-card";
        item.dataset["id"] = card.id;
        const frame = document.createElement("div");
        frame.className = "moons-card-picture";
        const body = document.createElement("wakusei-body");
        body.setAttribute("body", card.id);
        body.setAttribute("look", "painted");
        body.setAttribute("live", "off");
        body.setAttribute("fit", "tight");
        body.setAttribute("texture-base", "textures/");
        frame.append(body);
        const words = document.createElement("div");
        words.className = "moons-card-words";
        item.append(frame, words);
        return item;
      }),
    );
  }
  const shaped = data.counts.shaped;
  $("#cards-intro").textContent = `${say("mn_cards_intro", { n: data.cards.length, planet: planetName() })}${shaped > 0 ? ` ${say("mn_cards_shaped", { shaped })}` : ""}`;
  for (const item of $$<HTMLElement>("#cards .moons-card")) {
    const card = data.cards.find((c) => c.id === item.dataset["id"])!;
    item.querySelector("wakusei-body")!.setAttribute("lang", lang());
    const size =
      card.axesKm === null
        ? [say("mn_card_size"), `${diameter(card.radiusKm)} km`]
        : [say("mn_card_axes"), `${card.axesKm.map((a) => number(2 * a, 2 * a < 10 ? 1 : 0)).join(" × ")} km`];
    const rows: [string, string][] = [
      [size[0]!, size[1]!],
      [say("mn_card_distance"), card.a === null ? NONE : `${number(card.a)} km`],
      [say("mn_card_period"), card.p === null ? NONE : `${say("mn_days", { n: period(card.p) })}${card.retro ? ` (${say("mn_retrograde")})` : ""}`],
      [say("mn_card_found"), card.date ?? NONE],
      [say("mn_card_where"), card.where ?? NONE],
      [say("mn_card_by"), card.by ?? NONE],
    ];
    const other = lang() === "ja" ? card.name.en : card.name.ja;
    item.querySelector(".moons-card-words")!.innerHTML =
      `<h3>${escape(card.name[lang()])} <span class="fam-fine">${escape(other)}</span></h3><dl>${rows.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl>` +
      (card.shape === null ? "" : `<p class="fam-fine">${escape(card.shape[lang()])}</p>`);
  }
}

// --- the table ---------------------------------------------------------------------------------------------------------------------------------------------
const familyName = (id: string): string => data.families.find((f) => f.id === id)?.names[lang()] ?? id;
const familyRank = (id: string): number => data.families.findIndex((f) => f.id === id);
const TEXT_COLUMNS: readonly Column[] = ["name", "where", "by"];
/** The value a column sorts by; null sorts last either way. */
function valueOf(m: PageMoon, column: Column): string | number | null {
  switch (column) {
    case "name": return moonName(m);
    case "family": return familyRank(m.family);
    case "size": return m.r;
    case "distance": return m.a;
    case "period": return m.p;
    case "year": return m.year;
    case "where": return m.where;
    case "by": return m.by;
    case "direction": return m.retro;
  }
}
function drawTable(): void {
  const collator = new Intl.Collator(lang() === "ja" ? "ja" : "en", { numeric: true, sensitivity: "base" });
  const rows = [...data.moons].sort((p, q) => {
    const a = valueOf(p, state.sort);
    const b = valueOf(q, state.sort);
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    const c = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
    return (state.down ? -c : c) || (p.a ?? Infinity) - (q.a ?? Infinity);
  });
  $("#rows").innerHTML = rows
    .map((m) => {
      const size = m.r === null ? NONE : `${m.est ? "≈ " : ""}${diameter(m.r)}`;
      const direction = m.retro === null ? NONE : `<span class="moons-swatch" style="background:${m.colour.direction}"></span>${escape(say(m.retro === 1 ? "mn_retrograde" : "mn_prograde"))}`;
      const name = escape(moonName(m));
      return (
        `<tr data-id="${m.id}"${m.full ? ' data-full=""' : ""}><th scope="row">${m.full ? `<b>${name}</b>` : name}</th><td>${escape(familyName(m.family))}</td>` +
        `<td data-number="true"${m.est ? ' data-estimate=""' : ""}>${size}</td><td data-number="true">${m.a === null ? NONE : number(m.a)}</td><td data-number="true">${m.p === null ? NONE : period(m.p)}</td>` +
        `<td data-number="true">${m.year ?? NONE}</td><td>${escape(m.where ?? NONE)}</td><td>${escape(m.by ?? NONE)}</td><td>${direction}</td></tr>`
      );
    })
    .join("");
  for (const th of $$<HTMLTableCellElement>("#table thead th")) {
    const on = th.dataset["col"] === state.sort;
    if (on) th.setAttribute("aria-sort", state.down ? "descending" : "ascending");
    else th.removeAttribute("aria-sort");
  }
  const text = TEXT_COLUMNS.includes(state.sort);
  const header = $$<HTMLButtonElement>(`#table thead button[data-sort="${state.sort}"]`)[0]?.textContent ?? state.sort;
  $("#table-intro").textContent = say("mn_table_intro", { n: data.moons.length, col: header, order: say(text ? (state.down ? "mn_za" : "mn_az") : state.down ? "mn_down" : "mn_up") });
}
for (const button of $$("#table thead button[data-sort]")) {
  button.addEventListener("click", () => {
    const column = button.dataset["sort"] as Column;
    if (column === state.sort) state.down = !state.down;
    else {
      state.sort = column;
      state.down = false;
    }
    drawTable();
    keep();
  });
}

// --- tabs and the rest -------------------------------------------------------------------------------------------------------------------------------------
const tabs = $$("#tabs [role=tab]");
function showTab(tab: Tab, focus = false): void {
  state.tab = tab;
  for (const button of tabs) {
    const on = button.dataset["tab"] === tab;
    button.setAttribute("aria-selected", String(on));
    button.tabIndex = on ? 0 : -1;
    if (on && focus) button.focus();
    $(`#${button.getAttribute("aria-controls")!}`).hidden = !on;
  }
  render();
}
for (const button of tabs) {
  button.addEventListener("click", () => showTab(button.dataset["tab"] as Tab));
  button.addEventListener("keydown", (event) => {
    const at = TABS.indexOf(state.tab);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      showTab(event.key === "Home" ? TABS[0] : TABS[TABS.length - 1]!, true);
    } else if (step !== 0) {
      event.preventDefault();
      showTab(TABS[(at + step + TABS.length) % TABS.length]!, true);
    }
  });
}
for (const b of $$("#view [data-view]")) b.addEventListener("click", () => ((state.view = b.dataset["view"] as View), render()));
for (const b of $$("#reach [data-reach]")) b.addEventListener("click", () => ((state.reach = b.dataset["reach"] as "all" | "inner"), render()));
for (const b of $$("#colour [data-colour]")) b.addEventListener("click", () => ((state.colour = b.dataset["colour"] as "direction" | "group"), render()));

function render(): void {
  const planet = planetName();
  $("#moons-h").textContent = say("mn_title", { planet });
  for (const link of $$<HTMLAnchorElement>("#planets a")) link.textContent = BODIES[link.dataset["host"] as BodyId].name[lang()];
  const c = data.counts;
  $("#lede").textContent = say("mn_lede", { total: number(c.total), named: number(c.named), prograde: number(c.prograde), retrograde: number(c.retrograde), planet, featured: number(c.featured) });
  $("#short").textContent = say("mn_short", { total: number(c.total), named: number(c.named), retrograde: number(c.retrograde) });
  $("#credits").textContent = say("mn_credits", { fetched: new Date(`${data.fetched}T00:00:00Z`).toLocaleDateString(lang() === "ja" ? "ja-JP" : "en-CA", { dateStyle: "long", timeZone: "UTC" }) });
  for (const b of $$("#view [data-view]")) pressed(b, b.dataset["view"] === state.view);
  for (const b of $$("#reach [data-reach]")) pressed(b, b.dataset["reach"] === state.reach);
  for (const b of $$("#colour [data-colour]")) pressed(b, b.dataset["colour"] === state.colour);
  if (state.tab === "orbits") {
    drawOrbits();
    drawKey();
    $("#orbit-caption").textContent = say("mn_orbit_caption", { date: dayText() });
  }
  if (state.tab === "views") mountViews();
  if (state.tab === "cards") drawCards();
  if (state.tab === "table") drawTable();
  keep();
}

window.addEventListener("wakusei-language", () => render());
let resized = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resized);
  resized = requestAnimationFrame(() => state.tab === "orbits" && drawOrbits());
});
showTab(state.tab);
document.body.dataset["ready"] = "true";
