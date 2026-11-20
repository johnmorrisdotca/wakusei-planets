// <wakusei-moon-pages>: one giant planet's moons in four tabs, each one screen. Orbits: every orbit of /moon-catalogue in SVG, from above, at an angle or from the side, coloured by direction or by family.
// Map and portrait: <wakusei-plan> and <wakusei-portrait>. Main moons: a card with a picture for each moon drawn in full. Every moon: the whole list in a table that sorts. Every number is worked out from the
// package's data (moonPage). The hero above the tabs draws the planet and its main moons as soon as the element connects. The other WebGL parts are fetched when their tab is first opened. Nothing runs on a timer; it never writes the page's address: a choice is reflected on its
// own attributes and sent as `wakusei-moon-pages-change`, for the page to keep where it likes.
import { MOONS_OF, type BodyId } from "../facts.ts";
import { addBody, addMoons, defaultPortrait, encodeScene } from "../portrait/model.ts";
import { moonPage, MOON_PAGE_HOSTS, type MoonPage, type MoonPageHost, type PageMoon } from "./data.ts";
import { HERO_POSE, heroMoons, heroScale, heroSmall, heroZoom } from "./hero.ts";
import { MOON_PAGE_WORDS } from "./words.ts";

type Lang = "en" | "ja";
type Word = keyof (typeof MOON_PAGE_WORDS)["en"];

/**
 * The four tabs of `<wakusei-moon-pages>`, in their order: `orbits`, `views` (the map and the portrait), `cards` (the moons drawn in full) and `table` (every moon).
 *
 * @example
 * ```ts no-run
 * import { MOON_PAGE_TABS } from "@johnmorrisdotca/wakusei-planets/moon-pages/element";
 *
 * console.log(MOON_PAGE_TABS.join(", "));
 * ```
 */
export const MOON_PAGE_TABS = ["orbits", "views", "cards", "table"] as const;
const VIEWS = ["above", "tilted", "side"] as const;
const REACHES = ["all", "inner"] as const;
const COLOURS = ["direction", "group"] as const;
const COLUMNS = ["name", "family", "size", "distance", "period", "year", "where", "by", "direction"] as const;
const TEXT_COLUMNS: readonly string[] = ["name", "where", "by"];
const ELEVATION = { above: 90, tilted: 30, side: 0 } as const;
const NONE = "—";

/**
 * What `<wakusei-moon-pages>` shows, as its attributes say it and as `wakusei-moon-pages-change` sends it: the planet, the tab, how the orbits are seen (`above`, `tilted` or `side`), how far (`all` or `inner`) and
 * coloured (`direction` or `group`), and the table's column and order (`up` or `down`).
 *
 * @example
 * ```ts no-run
 * import type { MoonPagesState } from "@johnmorrisdotca/wakusei-planets/moon-pages/element";
 *
 * const pages = document.querySelector("wakusei-moon-pages")!;
 * pages.addEventListener("wakusei-moon-pages-change", (event) => {
 *   const state: MoonPagesState = (event as CustomEvent<MoonPagesState>).detail;
 *   console.log(state.planet, state.tab, state.sort, state.order);
 * });
 * ```
 */
export interface MoonPagesState {
  planet: MoonPageHost;
  tab: (typeof MOON_PAGE_TABS)[number];
  view: (typeof VIEWS)[number];
  reach: (typeof REACHES)[number];
  colour: (typeof COLOURS)[number];
  sort: (typeof COLUMNS)[number];
  order: "up" | "down";
}
const DEFAULTS: MoonPagesState = { planet: "jupiter", tab: "orbits", view: "tilted", reach: "all", colour: "direction", sort: "distance", order: "up" };
const ALLOWED: { [K in keyof MoonPagesState]: readonly string[] } = { planet: MOON_PAGE_HOSTS, tab: MOON_PAGE_TABS, view: VIEWS, reach: REACHES, colour: COLOURS, sort: COLUMNS, order: ["up", "down"] };
const STATE_KEYS = Object.keys(DEFAULTS) as (keyof MoonPagesState)[];

/** Each planet's own look and its moons' looks, fetched for the portrait and the cards. */
const LOOKS: Record<MoonPageHost, () => Promise<unknown>> = {
  jupiter: () => Promise.all([import("../bodies/jupiter.ts"), import("../bodies/moons-jupiter.ts")]),
  saturn: () => Promise.all([import("../bodies/saturn.ts"), import("../bodies/moons-saturn.ts")]),
  uranus: () => Promise.all([import("../bodies/uranus.ts"), import("../bodies/moons-uranus.ts")]),
  neptune: () => Promise.all([import("../bodies/neptune.ts"), import("../bodies/moons-neptune.ts")]),
};

const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ink = (name: string, light: string, dark: string): string => `var(--${name}, light-dark(${light}, ${dark}))`;

const TEMPLATE = `<style>
:host { display: block; color: ${ink("ink", "#1f2320", "#ece8dc")}; font-family: var(--font, system-ui, -apple-system, "Segoe UI", sans-serif); }
:host([hidden]), [hidden] { display: none !important; }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; }
.top { display: grid; gap: 8px; margin-bottom: 12px; }
h2 { margin: 0; font-size: 1.5rem; }
.fine { font-size: .75rem; color: ${ink("muted", "#6b6f68", "#a09d93")}; margin: 0; }
.lede { font-size: .9rem; max-width: 80ch; }
.short { display: none; }
.panels { border: 1px solid ${ink("rule", "#ddd6c6", "#3a3d38")}; border-radius: var(--radius, 16px); background: ${ink("surface", "#fbf8f1", "#1d201e")}; overflow: hidden; }
.tabs { display: flex; border-bottom: 1px solid ${ink("rule", "#ddd6c6", "#3a3d38")}; }
.tabs button { flex: 1; border: 0; background: transparent; min-height: 48px; padding: 0 6px; font-size: .9rem; font-weight: 600; color: ${ink("muted", "#6b6f68", "#a09d93")}; border-bottom: 3px solid transparent; }
.tabs button[aria-selected="true"] { color: inherit; border-bottom-color: ${ink("accent", "#b5452c", "#b5452c")}; }
.panel { padding: 14px; display: grid; gap: 14px; }
.panel > * { min-width: 0; max-width: 100%; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.seg { display: inline-flex; flex-wrap: wrap; gap: 4px; background: ${ink("surface", "#fbf8f1", "#1d201e")}; border: 1px solid ${ink("rule", "#ddd6c6", "#3a3d38")}; border-radius: 26px; padding: 3px; }
.seg button { border: 0; background: transparent; border-radius: 999px; min-width: 48px; min-height: 48px; padding: 0 10px; font-weight: 600; }
.seg button[aria-pressed="true"] { background: ${ink("ink", "#1f2320", "#ece8dc")}; color: ${ink("surface", "#fbf8f1", "#1d201e")}; }
button:focus-visible, [tabindex]:focus-visible { outline: 3px solid ${ink("accent", "#b5452c", "#b5452c")}; outline-offset: 2px; }
.stage { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
svg.orbits { flex: 0 1 auto; width: min(100%, 640px, calc(60vh * var(--ratio, 1))); aspect-ratio: var(--ratio, 1); display: block; border-radius: 12px; background: #06080d; color: #c9d4e3; touch-action: manipulation; }
svg.orbits path { vector-effect: non-scaling-stroke; stroke-opacity: var(--line, .6); }
svg.orbits path[data-full] { stroke-opacity: .9; }
svg.orbits .lit path { stroke-opacity: 1; }
svg.orbits .planet { stroke: rgba(255,255,255,.5); stroke-width: 1; vector-effect: non-scaling-stroke; }
.side { flex: 1 1 220px; display: grid; gap: 10px; align-content: start; min-width: 0; }
.key { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: .85rem; }
.key li { display: flex; align-items: center; gap: 8px; }
.key b { font-variant-numeric: tabular-nums; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; flex: none; }
.pick { min-height: 2.6em; color: inherit; font-size: .85rem; }
.views { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; }
figure { margin: 0; display: grid; gap: 6px; min-width: 0; }
.plan { flex: 0 1 300px; }
.plan .box { min-height: 300px; display: grid; place-items: center; }
.portrait { flex: 1 1 420px; }
.portrait .box { border-radius: 12px; background: #06080d; overflow: hidden; }
.portrait wakusei-portrait { --wakusei-size: 100%; width: 100%; max-width: none; }
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 10px; max-height: 70vh; overflow-y: auto; }
.moons-card { display: grid; grid-template-columns: 88px 1fr; gap: 10px; align-items: start; border: 1px solid ${ink("rule", "#ddd6c6", "#3a3d38")}; border-radius: 12px; padding: 10px; }
.picture { width: 88px; height: 88px; border-radius: 10px; background: #06080d; position: relative; overflow: hidden; }
.picture wakusei-body { --wakusei-size: 88px; width: 88px; pointer-events: none; }
.moons-card h3 { margin: 0 0 4px; font-size: 1rem; }
.moons-card dl { display: grid; grid-template-columns: max-content 1fr; gap: 1px 10px; margin: 0 0 4px; font-size: .8rem; }
.moons-card dt { color: ${ink("muted", "#6b6f68", "#a09d93")}; }
.moons-card dd { margin: 0; overflow-wrap: anywhere; }
.table-box { position: relative; max-width: 100%; max-height: 62vh; overflow: auto; border: 1px solid ${ink("rule", "#ddd6c6", "#3a3d38")}; border-radius: 12px; }
table { border-collapse: collapse; width: 100%; font-size: .85rem; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid ${ink("rule", "#ddd6c6", "#3a3d38")}; vertical-align: top; white-space: nowrap; }
td[data-number="true"], th[data-number="true"] { text-align: right; }
thead th { position: sticky; top: 0; z-index: 1; background: ${ink("surface", "#fbf8f1", "#1d201e")}; padding: 0; font-size: .75rem; letter-spacing: .06em; color: ${ink("muted", "#6b6f68", "#a09d93")}; font-weight: 600; }
thead button { width: 100%; min-height: 44px; padding: 6px 10px; border: 0; background: transparent; text-align: inherit; white-space: nowrap; }
th[aria-sort] button { color: ${ink("ink", "#1f2320", "#ece8dc")}; }
th[aria-sort="ascending"] button::after { content: " ▲"; }
th[aria-sort="descending"] button::after { content: " ▼"; }
tbody th { font-weight: 400; }
td:nth-child(7), td:nth-child(8) { white-space: normal; min-width: 9rem; max-width: 16rem; }
tr:last-child > * { border-bottom: 0; }
.credits { margin-top: 20px; }
.hero-wrap { display: grid; gap: 8px; margin: 0 0 14px; }
.hero { position: relative; overflow: hidden; height: min(78vh, 720px); min-height: 520px; background: #000; border-radius: 16px; }
.hero:fullscreen { width: 100%; height: 100%; min-height: 0; border-radius: 0; }
.hero-planet { position: absolute; z-index: 1; top: 50%; right: -70%; width: 124%; aspect-ratio: 1; transform: translateY(-50%); pointer-events: none; }
.hero-planet wakusei-body, .hero-disc wakusei-body { --wakusei-size: 100%; width: 100%; height: 100%; display: block; }
.hero-moons { position: absolute; inset: 0; z-index: 2; }
.hero-moon { position: absolute; transform: translate(-50%, -50%); display: block; margin: 0; padding: 0; border: 0; background: none; color: #fff; touch-action: manipulation; }
.hero-disc { display: block; width: calc(var(--disc) * 1px); aspect-ratio: 1; border-radius: 50%; }
.hero-disc wakusei-body { pointer-events: none; }
.hero-name { position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); font-size: 13px; font-weight: 650; line-height: 1.2; text-shadow: 0 1px 2px #000, 0 0 4px #000; white-space: nowrap; }
.hero-moon:hover .hero-disc, .hero-moon:focus-visible .hero-disc, .hero-moon[aria-pressed="true"] .hero-disc { outline: 2px solid #fff; outline-offset: 3px; }
.hero-small { position: absolute; z-index: 2; left: 10px; bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px; align-items: end; max-width: 52%; }
.hero-small .hero-moon { position: static; transform: none; display: grid; justify-items: center; gap: 1px; min-width: 36px; min-height: 44px; }
.hero-small .hero-name, .hero-small .hero-est { position: static; transform: none; left: auto; top: auto; font-size: 9px; line-height: 1.1; }
.hero-est { color: #d7d2c6; font-weight: 500; }
.hero-scale { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: end; margin: 0; }
.scale-moon { display: grid; justify-items: center; align-content: end; gap: 2px; min-width: 44px; min-height: 44px; margin: 0; padding: 2px; border: 0; border-radius: 8px; background: none; color: inherit; font: 600 11px/1.2 system-ui, sans-serif; }
.scale-moon svg { display: block; }
.scale-moon:hover, .scale-moon:focus-visible, .scale-moon[aria-pressed="true"] { outline: 2px solid currentColor; outline-offset: 2px; }
.fs { position: absolute; z-index: 3; top: 10px; left: 10px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.5); background: rgba(0,0,0,.45); color: #fff; font: 600 14px/1 system-ui, sans-serif; }
.hero-fact { margin: 0; min-height: 1.4em; font-size: .9rem; }
@media (max-width: 600px) {
  .top { gap: 6px; margin-bottom: 8px; }
  h2 { font-size: 1.2rem; }
  .lede { display: none; }
  .short { display: block; }
  .hero { height: min(68vh, 640px); min-height: 420px; border-radius: 12px; }
  .hero-disc { width: calc(var(--disc) * 0.78px); }
  .hero-name { font-size: 12px; }
  .hero-small { max-width: 62%; }
  .hero-small .hero-moon { min-width: 28px; }
}
</style>
<section class="top" part="top">
  <h2 id="moons-h" part="title"></h2>
  <slot name="planets"></slot>
  <p class="fine lede" id="lede"></p>
  <p class="fine short" id="short"></p>
</section>
<section class="hero-wrap" part="hero">
  <div class="hero" id="hero">
    <button type="button" class="fs" id="full-screen"></button>
    <div class="hero-planet" id="hero-planet"></div>
    <div class="hero-moons" id="hero-moons" data-w-label="hero_moons"></div>
    <div class="hero-small" id="hero-small"></div>
  </div>
  <p class="hero-fact" id="hero-fact" role="status"></p>
  <div class="hero-scale" id="hero-scale" data-w-label="hero_scale"></div>
</section>
<div class="panels" part="panels">
  <div class="tabs" role="tablist" id="tabs" data-w-label="tabs">
    <button type="button" role="tab" id="tab-orbits" aria-controls="panel-orbits" data-tab="orbits" data-w="tab_orbits"></button>
    <button type="button" role="tab" id="tab-views" aria-controls="panel-views" data-tab="views" data-w="tab_views"></button>
    <button type="button" role="tab" id="tab-cards" aria-controls="panel-cards" data-tab="cards" data-w="tab_cards"></button>
    <button type="button" role="tab" id="tab-table" aria-controls="panel-table" data-tab="table" data-w="tab_table"></button>
  </div>
  <div class="panel" role="tabpanel" id="panel-orbits" aria-labelledby="tab-orbits">
    <div class="row">
      <div class="seg" id="view" role="group" data-w-label="view"><button type="button" data-view="above" data-w="above"></button><button type="button" data-view="tilted" data-w="tilted"></button><button type="button" data-view="side" data-w="side"></button></div>
      <div class="seg" id="reach" role="group" data-w-label="reach"><button type="button" data-reach="all" data-w="all"></button><button type="button" data-reach="inner" data-w="inner"></button></div>
      <div class="seg" id="colour" role="group" data-w-label="colour"><button type="button" data-colour="direction" data-w="direction"></button><button type="button" data-colour="group" data-w="family"></button></div>
    </div>
    <div class="stage">
      <svg id="orbits" class="orbits" role="img" aria-labelledby="orbit-caption"></svg>
      <div class="side">
        <ul class="key" id="key"></ul>
        <p class="fine pick" id="pick" role="status"></p>
        <p class="fine" id="orbit-caption"></p>
        <p class="fine" data-w="orbits_hint"></p>
      </div>
    </div>
  </div>
  <div class="panel" role="tabpanel" id="panel-views" aria-labelledby="tab-views" hidden>
    <div class="views">
      <figure class="plan"><div class="box" id="plan-box"></div><figcaption class="fine" id="plan-caption"></figcaption></figure>
      <figure class="portrait"><div class="box" id="portrait-box"></div><figcaption class="fine" id="portrait-caption"></figcaption></figure>
    </div>
  </div>
  <div class="panel" role="tabpanel" id="panel-cards" aria-labelledby="tab-cards" hidden>
    <p class="fine" id="cards-intro"></p>
    <ul class="cards" id="cards"></ul>
  </div>
  <div class="panel" role="tabpanel" id="panel-table" aria-labelledby="tab-table" hidden>
    <p class="fine" id="table-intro" role="status"></p>
    <div class="table-box" tabindex="0" role="region" aria-labelledby="tab-table">
      <table id="table"><thead><tr>
        <th scope="col" data-col="name"><button type="button" data-sort="name" data-w="col_name"></button></th>
        <th scope="col" data-col="family"><button type="button" data-sort="family" data-w="col_family"></button></th>
        <th scope="col" data-col="size" data-number="true"><button type="button" data-sort="size" data-w="col_size"></button></th>
        <th scope="col" data-col="distance" data-number="true"><button type="button" data-sort="distance" data-w="col_distance"></button></th>
        <th scope="col" data-col="period" data-number="true"><button type="button" data-sort="period" data-w="col_period"></button></th>
        <th scope="col" data-col="year" data-number="true"><button type="button" data-sort="year" data-w="col_year"></button></th>
        <th scope="col" data-col="where"><button type="button" data-sort="where" data-w="col_where"></button></th>
        <th scope="col" data-col="by"><button type="button" data-sort="by" data-w="col_by"></button></th>
        <th scope="col" data-col="direction"><button type="button" data-sort="direction" data-w="col_direction"></button></th>
      </tr></thead><tbody id="rows"></tbody></table>
    </div>
    <p class="fine" data-w="table_note"></p>
  </div>
</div>
<p class="fine credits" id="credits" part="credits"></p>`;

/**
 * The `<wakusei-moon-pages>` custom element: one giant planet's moons in four tabs, each one screen.
 *
 * - **Orbits**: every orbit of `/moon-catalogue` in SVG, seen from above the planet's pole, at an angle or from the side, every moon or the inner ones, coloured prograde and retrograde or by family, with the key and a dot
 *   where each moon is on `MOON_PAGE_TIME`; pointing at an orbit, or a press on it, says whose it is.
 * - **Map and portrait**: `<wakusei-plan>` from above the pole and a `<wakusei-portrait>` of the planet with the moons drawn in full.
 * - **Main moons**: a card with a painted picture for each moon drawn in full, its size (three axes for a shaped one), distance, period, discovery and how its shape is known.
 * - **Every moon**: the whole list in a table that sorts by any column, both ways; a size worked out from brightness is marked ≈, and — is a value no source gives.
 *
 * Attributes: `planet` (`jupiter`, the default, `saturn`, `uranus` or `neptune`; a change draws the other planet), `lang` (`en` or `ja`; the nearest `lang` up the page when left out, and it follows that one),
 * `tab`, `view` (`above`, `tilted` or `side`), `reach` (`all` or `inner`), `colour` (`direction` or `group`), `sort` (`name`, `family`, `size`, `distance`, `period`, `year`, `where`, `by` or `direction`) and `order`
 * (`up` or `down`), and `texture-base` and `texture-far-base`, handed to the bodies it draws. A slot named `planets` sits under the title, for a page's own row of links to the other planets.
 *
 * It never writes the page's address. A choice made in it is reflected on its attribute and sent as `wakusei-moon-pages-change` (bubbling, composed) with `detail` the whole `MoonPagesState`; a page that keeps its
 * address writes the detail there and sets the attributes back from it when it loads. Setting an attribute sends no event. The numbers are `moonPage(planet)`'s, worked out in a few milliseconds. The plan, the
 * portrait and the cards' bodies are fetched only when their tab is first opened. The hero above the tabs is always there: the planet cropped at the right and its main moons in an arc, each a painted sphere, and it loads those looks when the element connects. Nothing runs on a timer; the orbits are drawn
 * again only when a choice, the language or the element's width changes. `data-state` is `ready` once it has drawn.
 *
 * @example
 * ```ts no-run
 * import "@johnmorrisdotca/wakusei-planets/moon-pages/element";
 * import type { MoonPagesState, WakuseiMoonPages } from "@johnmorrisdotca/wakusei-planets/moon-pages/element";
 *
 * const pages = document.createElement("wakusei-moon-pages") as WakuseiMoonPages;
 * pages.setAttribute("planet", "saturn");
 * pages.setAttribute("tab", "table");
 * pages.addEventListener("wakusei-moon-pages-change", (event) => console.log((event as CustomEvent<MoonPagesState>).detail));
 * document.body.append(pages);
 * ```
 */
export class WakuseiMoonPages extends HTMLElement {
  static observedAttributes = [...STATE_KEYS, "lang", "texture-base", "texture-far-base"];

  #root!: ShadowRoot;
  #state: MoonPagesState = { ...DEFAULTS };
  #data: MoonPage | undefined;
  #picked: string | null = null;
  #drawn: { id: string; points: [number, number][] }[] = [];
  #extent = 1;
  #tall = 1;
  #width = 0;
  #plan: HTMLElement | undefined;
  #portrait: HTMLElement | undefined;
  #cardsFor: MoonPageHost | undefined;
  #heroHost: MoonPageHost | undefined;
  #heroMoon: string | null = null;
  #onFull: (() => void) | undefined;
  #watch: MutationObserver | undefined;
  #resize: ResizeObserver | undefined;
  #reflecting = false;

  /** What it shows now. */
  get state(): MoonPagesState {
    return { ...this.#state };
  }

  /** The numbers it draws: `moonPage(planet)`. */
  get page(): MoonPage {
    return this.#page();
  }

  connectedCallback(): void {
    if (this.#root === undefined) {
      this.#root = this.attachShadow({ mode: "open" });
      this.#root.innerHTML = TEMPLATE;
      this.#bind();
    }
    this.#read();
    this.#watch = new MutationObserver(() => {
      if (!this.hasAttribute("lang")) this.#render();
    });
    this.#watch.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    const near = this.parentElement?.closest("[lang]");
    if (near !== null && near !== undefined && near !== document.documentElement) this.#watch.observe(near, { attributes: true, attributeFilter: ["lang"] });
    if (typeof ResizeObserver === "function") {
      this.#resize = new ResizeObserver(() => {
        const width = this.#$("#orbits").getBoundingClientRect().width;
        if (Math.abs(width - this.#width) > 1 && this.#state.tab === "orbits") this.#drawOrbits();
      });
      this.#resize.observe(this);
    }
    this.#onFull = () => this.#paintFullscreen();
    document.addEventListener("fullscreenchange", this.#onFull);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#watch?.disconnect();
    this.#resize?.disconnect();
    if (this.#onFull !== undefined) document.removeEventListener("fullscreenchange", this.#onFull);
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (this.#reflecting || before === after || this.#root === undefined) return;
    if ((STATE_KEYS as string[]).includes(name)) this.#read();
    this.#render();
  }

  // --- reading and writing the state --------------------------------------------------------------------------------------------------------------------
  #read(): void {
    const next = { ...DEFAULTS };
    for (const key of STATE_KEYS) {
      const value = this.getAttribute(key);
      if (value !== null && ALLOWED[key].includes(value)) (next as Record<string, string>)[key] = value;
    }
    if (next.planet !== this.#state.planet) {
      this.#picked = null;
      this.#heroMoon = null;
      this.#heroHost = undefined;
    }
    this.#state = next;
  }

  /** A choice made here: kept, reflected on the attributes, sent. */
  #choose(change: Partial<MoonPagesState>): void {
    this.#state = { ...this.#state, ...change };
    this.#reflecting = true;
    for (const key of STATE_KEYS) {
      const value = this.#state[key];
      if (value === DEFAULTS[key] && key !== "planet") this.removeAttribute(key);
      else if (this.getAttribute(key) !== value) this.setAttribute(key, value);
    }
    this.#reflecting = false;
    this.#render();
    this.dispatchEvent(new CustomEvent<MoonPagesState>("wakusei-moon-pages-change", { detail: this.state, bubbles: true, composed: true }));
  }

  #page(): MoonPage {
    if (this.#data?.host !== this.#state.planet) this.#data = moonPage(this.#state.planet);
    return this.#data;
  }

  // --- words ---------------------------------------------------------------------------------------------------------------------------------------------
  #lang(): Lang {
    const own = this.getAttribute("lang") ?? this.closest("[lang]")?.getAttribute("lang") ?? "en";
    return own.toLowerCase().startsWith("ja") ? "ja" : "en";
  }
  #say(key: Word, values: Record<string, string | number> = {}): string {
    return (MOON_PAGE_WORDS[this.#lang()][key] as string).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
  }
  #number(n: number, digits = 0): string {
    return n.toLocaleString(this.#lang() === "ja" ? "ja-JP" : "en-CA", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }
  #day(ms: number): string {
    return new Date(ms).toLocaleDateString(this.#lang() === "ja" ? "ja-JP" : "en-CA", { dateStyle: "long", timeZone: "UTC" });
  }
  #diameter(radius: number): string {
    const d = 2 * radius;
    return this.#number(d, d < 10 ? 1 : 0);
  }
  #period(days: number): string {
    return this.#number(days, days < 10 ? 2 : 1);
  }
  #moonName(m: Pick<PageMoon, "en" | "ja">): string {
    return this.#lang() === "ja" && m.ja !== null ? m.ja : m.en;
  }
  #planetName(): string {
    return this.#page().name[this.#lang()];
  }

  #$<T extends Element = HTMLElement>(selector: string): T {
    return this.#root.querySelector<T>(selector)!;
  }
  #$$<T extends Element = HTMLButtonElement>(selector: string): T[] {
    return [...this.#root.querySelectorAll<T>(selector)];
  }

  // --- the events --------------------------------------------------------------------------------------------------------------------------------------------
  #bind(): void {
    const tabs = this.#$$("[role=tab]");
    for (const button of tabs) {
      button.addEventListener("click", () => this.#choose({ tab: button.dataset["tab"] as MoonPagesState["tab"] }));
      button.addEventListener("keydown", (event) => {
        const at = MOON_PAGE_TABS.indexOf(this.#state.tab);
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        let next: MoonPagesState["tab"] | undefined;
        if (event.key === "Home") next = MOON_PAGE_TABS[0];
        else if (event.key === "End") next = MOON_PAGE_TABS[MOON_PAGE_TABS.length - 1];
        else if (step !== 0) next = MOON_PAGE_TABS[(at + step + MOON_PAGE_TABS.length) % MOON_PAGE_TABS.length];
        if (next === undefined) return;
        event.preventDefault();
        this.#choose({ tab: next });
        this.#$(`#tab-${next}`).focus();
      });
    }
    for (const b of this.#$$("#view [data-view]")) b.addEventListener("click", () => this.#choose({ view: b.dataset["view"] as MoonPagesState["view"] }));
    for (const b of this.#$$("#reach [data-reach]")) b.addEventListener("click", () => this.#choose({ reach: b.dataset["reach"] as MoonPagesState["reach"] }));
    for (const b of this.#$$("#colour [data-colour]")) b.addEventListener("click", () => this.#choose({ colour: b.dataset["colour"] as MoonPagesState["colour"] }));
    for (const b of this.#$$("thead button[data-sort]")) {
      b.addEventListener("click", () => {
        const column = b.dataset["sort"] as MoonPagesState["sort"];
        this.#choose(column === this.#state.sort ? { order: this.#state.order === "down" ? "up" : "down" } : { sort: column, order: "up" });
      });
    }
    const svg = this.#$<SVGSVGElement>("#orbits");
    svg.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse") this.#light(this.#nearest(event.clientX, event.clientY));
    });
    svg.addEventListener("pointerdown", (event) => this.#light(this.#nearest(event.clientX, event.clientY)));
    this.#$("#full-screen").addEventListener("click", () => {
      const hero = this.#$("#hero");
      if (document.fullscreenElement === hero) void document.exitFullscreen();
      else void hero.requestFullscreen();
    });
    this.#$(".hero-wrap").addEventListener("click", (event) => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-moon]");
      if (button === null || button === undefined) return;
      this.#heroMoon = button.dataset["moon"] ?? null;
      this.#paintHero();
      this.dispatchEvent(new CustomEvent<MoonPagesState & { moon: string | null }>("wakusei-moon-pages-change", { detail: { ...this.state, moon: this.#heroMoon }, bubbles: true, composed: true }));
    });
  }

  // --- drawing -------------------------------------------------------------------------------------------------------------------------------------------
  #render(): void {
    if (this.#root === undefined || !this.isConnected) return;
    const data = this.#page();
    const planet = this.#planetName();
    const c = data.counts;
    for (const el of this.#$$<HTMLElement>("[data-w]")) el.textContent = this.#say(el.dataset["w"] as Word);
    for (const el of this.#$$<HTMLElement>("[data-w-label]")) el.setAttribute("aria-label", this.#say(el.dataset["wLabel"] as Word));
    this.#$("#moons-h").textContent = this.#say("title", { planet });
    this.#$("#lede").textContent = this.#say("lede", { total: this.#number(c.total), named: this.#number(c.named), prograde: this.#number(c.prograde), retrograde: this.#number(c.retrograde), planet, featured: this.#number(c.featured) });
    this.#$("#short").textContent = this.#say("short", { total: this.#number(c.total), named: this.#number(c.named), retrograde: this.#number(c.retrograde) });
    this.#$("#credits").textContent = this.#say("credits", { fetched: this.#day(Date.parse(`${data.fetched}T00:00:00Z`)) });
    for (const button of this.#$$("[role=tab]")) {
      const on = button.dataset["tab"] === this.#state.tab;
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      this.#$(`#${button.getAttribute("aria-controls")!}`).hidden = !on;
    }
    for (const b of this.#$$("#view [data-view]")) b.setAttribute("aria-pressed", String(b.dataset["view"] === this.#state.view));
    for (const b of this.#$$("#reach [data-reach]")) b.setAttribute("aria-pressed", String(b.dataset["reach"] === this.#state.reach));
    for (const b of this.#$$("#colour [data-colour]")) b.setAttribute("aria-pressed", String(b.dataset["colour"] === this.#state.colour));
    if (this.#state.tab === "orbits") {
      this.#drawOrbits();
      this.#drawKey();
      this.#$("#orbit-caption").textContent = this.#say("orbit_caption", { date: this.#day(data.time) });
    }
    if (this.#state.tab === "views") this.#mountViews();
    if (this.#state.tab === "cards") this.#drawCards();
    if (this.#state.tab === "table") this.#drawTable();
    this.#mountHero();
    this.#paintFullscreen();
    this.setAttribute("data-state", "ready");
  }

  /** The planet's edge and the arc. The spheres are made once a planet; a later draw only renames them. */
  #mountHero(): void {
    const host = this.#page().host;
    if (this.#heroHost !== host) {
      this.#heroHost = host;
      this.#heroMoon = null;
      void this.#loadHero(host);
      return;
    }
    this.#paintHero();
  }

  async #loadHero(host: MoonPageHost): Promise<void> {
    await LOOKS[host]();
    await import("../element.ts");
    if (!this.isConnected || this.#heroHost !== host) return;
    const pose = HERO_POSE[host];
    const planet = document.createElement("wakusei-body");
    planet.setAttribute("body", host);
    planet.setAttribute("look", "painted");
    planet.setAttribute("live", "off");
    planet.setAttribute("fit", "tight");
    planet.setAttribute("labels", "off");
    planet.setAttribute("meridian", String(pose.meridian));
    planet.setAttribute("tilt", String(pose.tilt));
    this.#textures(planet);
    this.#$("#hero-planet").replaceChildren(planet);
    const zoom = heroZoom(host);
    if (zoom !== 1) (planet as HTMLElement & { setView(view: { zoom: number }): void }).setView({ zoom });
    const cards = this.#page().cards;
    const moons = heroMoons(cards, host, this.#lang());
    const discButton = (id: string, px: number, look: "painted" | "illustrated"): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hero-moon";
      button.dataset["moon"] = id;
      const disc = document.createElement("span");
      disc.className = "hero-disc";
      disc.style.setProperty("--disc", String(px));
      const body = document.createElement("wakusei-body");
      body.setAttribute("body", id);
      body.setAttribute("look", look);
      body.setAttribute("live", "off");
      body.setAttribute("fit", "tight");
      body.setAttribute("labels", "off");
      this.#textures(body);
      const name = document.createElement("span");
      name.className = "hero-name";
      disc.append(body);
      button.append(disc, name);
      if (look === "illustrated") {
        const mark = document.createElement("span");
        mark.className = "hero-est";
        button.append(mark);
      }
      return button;
    };
    this.#$("#hero-moons").replaceChildren(...moons.map((moon) => {
      const button = discButton(moon.id, moon.px, "painted");
      button.style.left = `${moon.left}%`;
      button.style.top = `${moon.top}%`;
      return button;
    }));
    this.#$("#hero-small").replaceChildren(...heroSmall(cards, host, this.#lang()).map((moon) => discButton(moon.id, moon.px, "illustrated")));
    this.#$("#hero-scale").replaceChildren(...heroScale(cards, host).map((circle) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scale-moon";
      button.dataset["moon"] = circle.id;
      const r = Math.max(1.5, (circle.px / 56) * 26);
      button.innerHTML = `<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="${r}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><span class="scale-km"></span>`;
      return button;
    }));
    this.#paintHero();
  }

  #paintHero(): void {
    const page = this.#page();
    const lang = this.#lang();
    const named = new Map([...heroMoons(page.cards, page.host, lang), ...heroSmall(page.cards, page.host, lang)].map((moon) => [moon.id, moon.name]));
    for (const button of this.#$$<HTMLButtonElement>("[data-moon]")) {
      const id = button.dataset["moon"] ?? "";
      button.setAttribute("aria-pressed", String(id === this.#heroMoon));
      const name = button.querySelector(".hero-name");
      if (name !== null && named.has(id)) name.textContent = named.get(id) ?? "";
      const mark = button.querySelector(".hero-est");
      if (mark !== null) mark.textContent = this.#say("hero_estimated");
      const km = button.querySelector(".scale-km");
      if (km !== null) {
        const card = page.cards.find((item) => item.id === id);
        if (card !== undefined) km.textContent = `${this.#diameter(card.radiusKm)} km`;
      }
      button.querySelector("wakusei-body")?.setAttribute("lang", lang);
    }
    this.#$("#hero-planet").querySelector("wakusei-body")?.setAttribute("lang", lang);
    this.#paintFact();
    this.#paintFullscreen();
  }

  #paintFact(): void {
    const card = this.#page().cards.find((item) => item.id === this.#heroMoon);
    const fact = this.#$("#hero-fact");
    if (card === undefined) {
      fact.textContent = "";
      return;
    }
    const name = this.#lang() === "ja" ? card.name.ja : card.name.en;
    fact.textContent = this.#say("hero_fact", { name, diameter: this.#diameter(card.radiusKm), distance: card.a === null ? NONE : this.#number(card.a), planet: this.#planetName(), found: card.date ?? NONE });
  }

  #paintFullscreen(): void {
    if (this.#root === undefined) return;
    const on = document.fullscreenElement === this.#$("#hero");
    const button = this.#$("#full-screen");
    button.textContent = this.#say(on ? "leave_full_screen" : "full_screen");
    button.setAttribute("aria-pressed", String(on));
  }

  #drawOrbits(): void {
    const data = this.#page();
    const svg = this.#$<SVGSVGElement>("#orbits");
    const placed = data.moons.filter((m) => m.orbit !== null);
    const elevation = ELEVATION[this.#state.view];
    const rad = (elevation * Math.PI) / 180;
    const project = (x: number, y: number, z: number): [number, number] => [x, y * Math.sin(rad) + z * Math.cos(rad)];
    const reach = this.#state.reach === "all" ? Math.max(...placed.map((m) => Math.max(...m.orbit!.map(Math.abs)))) : data.inner;
    // the picture is as tall as the orbits that fit across it reach up and down from this angle, so a tilted view is not mostly empty
    let up = 0;
    for (const moon of placed) {
      const o = moon.orbit!;
      let fits = true;
      let high = 0;
      for (let k = 0; k < o.length; k += 3) {
        if (Math.abs(o[k]!) > reach * 1.001) fits = false;
        high = Math.max(high, Math.abs(project(o[k]!, o[k + 1]!, o[k + 2]!)[1]));
      }
      if (fits) up = Math.max(up, high);
    }
    const extent = reach * 1.06;
    const tall = Math.min(extent, Math.max(up * 1.06, extent * 0.4));
    this.#extent = extent;
    this.#tall = tall;
    svg.style.setProperty("--ratio", String(extent / tall));
    // the more lines, the fainter each: Saturn's 292 would otherwise be a solid block
    svg.style.setProperty("--line", String(Math.min(0.6, 6 / Math.sqrt(placed.length))));
    svg.setAttribute("viewBox", `${-extent} ${-tall} ${2 * extent} ${2 * tall}`);
    this.#width = svg.getBoundingClientRect().width;
    const px = (2 * extent) / (this.#width || 600);
    const colourOf = (m: PageMoon): string => m.colour[this.#state.colour];
    const back: string[] = [];
    const front: string[] = [];
    this.#drawn = [];
    // the irregular moons first and the moons drawn in full last, so the big moons' lines lie on top
    const order = [...placed].sort((a, b) => Number(a.full) - Number(b.full) || (b.a ?? 0) - (a.a ?? 0));
    for (const moon of order) {
      const o = moon.orbit!;
      const points: [number, number][] = [];
      const depth: number[] = [];
      for (let k = 0; k < o.length; k += 3) {
        const [sx, sy] = project(o[k]!, o[k + 1]!, o[k + 2]!);
        points.push([sx, -sy]);
        depth.push(-o[k + 1]! * Math.cos(rad) + o[k + 2]! * Math.sin(rad));
      }
      this.#drawn.push({ id: moon.id, points });
      // seen from above everything is one path; otherwise each step of the line goes to the side of the planet its middle is on (the far side drawn before the planet, the near side after it), with no gap
      const path = (side: "all" | "far" | "near"): string => {
        const n = points.length;
        const inside = (k: number): boolean => side === "all" || (depth[k % n]! + depth[(k + 1) % n]! > 0) === (side === "near");
        let d = "";
        for (let k = 0; k < n; k += 1) {
          if (!inside(k)) continue;
          if (k === 0 || !inside(k - 1)) d += `M${points[k]![0]} ${points[k]![1]}`;
          const [x, y] = points[(k + 1) % n]!;
          d += `L${x} ${y}`;
        }
        return d === "" ? "" : `<path d="${d}" stroke="${colourOf(moon)}" stroke-width="${moon.full ? 1.8 : 1}" data-id="${moon.id}" data-dir="${moon.retro === 1 ? "retrograde" : "prograde"}"${moon.full ? ' data-full=""' : ""}/>`;
      };
      if (elevation === 90) back.push(path("all"));
      else {
        back.push(path("far"));
        front.push(path("near"));
      }
    }
    const dots: string[] = [];
    const names: string[] = [];
    for (const moon of placed) {
      if (moon.at === null) continue;
      const [sx, sy] = project(moon.at[0], moon.at[1], moon.at[2]);
      if (Math.abs(sx) > extent || Math.abs(sy) > tall) continue;
      dots.push(`<circle cx="${sx}" cy="${-sy}" r="${(moon.full ? 1.4 : 1) * 2.6 * px}" fill="${colourOf(moon)}" data-id="${moon.id}"/>`);
      if (moon.full && (this.#state.reach === "inner" || (moon.a ?? 0) / data.unit > extent / 8)) names.push(`<text x="${sx + 5 * px}" y="${-sy - 5 * px}" font-size="${12 * px}">${escape(this.#moonName(moon))}</text>`);
    }
    const planetR = Math.max(data.radiusKm / data.unit, 4 * px);
    const title = this.#say(`view_${this.#state.view}`, { planet: this.#planetName() });
    svg.innerHTML = `<title>${escape(title)}</title><g class="lines" fill="none" stroke-linejoin="round">${back.join("")}</g><circle class="planet" cx="0" cy="0" r="${planetR}" fill="${data.colour}"/><g class="lines" fill="none" stroke-linejoin="round">${front.join("")}</g><g class="dots">${dots.join("")}</g><g class="names" fill="currentColor">${names.join("")}</g><g class="lit" fill="none"></g>`;
    svg.dataset["view"] = this.#state.view;
    svg.dataset["reach"] = this.#state.reach;
    svg.dataset["colour"] = this.#state.colour;
    svg.dataset["orbits"] = String(placed.length);
    this.#light(this.#picked);
  }

  /** The orbit under a point of the picture (within 10 CSS pixels), or null. */
  #nearest(clientX: number, clientY: number): string | null {
    const box = this.#$("#orbits").getBoundingClientRect();
    if (box.width === 0) return null;
    const k = (2 * this.#extent) / box.width;
    const x = (clientX - box.left) * k - this.#extent;
    const y = (clientY - box.top) * k - this.#tall;
    let best: string | null = null;
    let bestD = 10 * k;
    for (const orbit of this.#drawn) {
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
  #light(id: string | null): void {
    this.#picked = id;
    const svg = this.#$<SVGSVGElement>("#orbits");
    const lit = svg.querySelector(".lit");
    const moon = id === null ? undefined : this.#page().moons.find((m) => m.id === id);
    const orbit = id === null ? undefined : this.#drawn.find((o) => o.id === id);
    if (lit !== null) lit.innerHTML = moon === undefined || orbit === undefined ? "" : `<path d="M${orbit.points.map(([x, y]) => `${x} ${y}`).join("L")}Z" stroke="${moon.colour[this.#state.colour]}" stroke-width="3.2"/>`;
    svg.dataset["picked"] = id ?? "";
    this.#$("#pick").textContent =
      moon === undefined || moon.a === null || moon.p === null
        ? ""
        : this.#say("pick", { name: this.#moonName(moon), direction: this.#say(moon.retro === 1 ? "retrograde" : "prograde"), distance: this.#number(moon.a), planet: this.#planetName(), period: this.#period(moon.p) });
  }

  #drawKey(): void {
    this.#$("#key").innerHTML = this.#page()
      .key[this.#state.colour].filter((entry) => entry.count > 0)
      .map((entry) => `<li data-key="${entry.id}"><span class="swatch" style="background:${entry.color}"></span><span>${escape(entry.names[this.#lang()])}</span> <b>${this.#number(entry.count)}</b></li>`)
      .join("");
  }

  #textures(el: HTMLElement): void {
    for (const name of ["texture-base", "texture-far-base"]) {
      const value = this.getAttribute(name);
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    }
  }

  #mountViews(): void {
    const data = this.#page();
    const host = data.host;
    if (this.#plan?.getAttribute("system") !== host) {
      void import("../plan/element.ts");
      void LOOKS[host]().then(() => import("../portrait/element.ts"));
      const plan = document.createElement("wakusei-plan");
      plan.setAttribute("system", host);
      plan.setAttribute("size", "300");
      plan.setAttribute("time", String(data.time));
      plan.setAttribute("mark", MOONS_OF[host][0]);
      plan.addEventListener("wakusei-plan-pick", (event) => plan.setAttribute("mark", (event as CustomEvent<{ id: string }>).detail.id));
      this.#$("#plan-box").replaceChildren(plan);
      this.#plan = plan;
      const portrait = document.createElement("wakusei-portrait");
      const scene = { ...addMoons(addBody(defaultPortrait(), host as BodyId), host as BodyId), arrange: "row" as const, scale: "readable" as const, orbits: false };
      portrait.setAttribute("scene", encodeScene(scene));
      this.#$("#portrait-box").replaceChildren(portrait);
      this.#portrait = portrait;
    }
    for (const el of [this.#plan!, this.#portrait!]) el.setAttribute("lang", this.#lang());
    this.#textures(this.#portrait!);
    this.#$("#plan-caption").textContent = this.#say("plan_caption", { planet: this.#planetName(), date: this.#day(data.time) });
    this.#$("#portrait-caption").textContent = this.#say("portrait_caption", { planet: this.#planetName() });
  }

  #drawCards(): void {
    const data = this.#page();
    const list = this.#$("#cards");
    if (this.#cardsFor !== data.host) {
      this.#cardsFor = data.host;
      void LOOKS[data.host]().then(() => import("../element.ts"));
      list.replaceChildren(
        ...data.cards.map((card) => {
          const item = document.createElement("li");
          item.className = "moons-card";
          item.dataset["id"] = card.id;
          const frame = document.createElement("div");
          frame.className = "picture";
          const body = document.createElement("wakusei-body");
          body.setAttribute("body", card.id);
          body.setAttribute("look", "painted");
          body.setAttribute("live", "off");
          body.setAttribute("fit", "tight");
          frame.append(body);
          const words = document.createElement("div");
          words.className = "words";
          item.append(frame, words);
          return item;
        }),
      );
    }
    const shaped = data.counts.shaped;
    this.#$("#cards-intro").textContent = `${this.#say("cards_intro", { n: data.cards.length, planet: this.#planetName() })}${shaped > 0 ? ` ${this.#say("cards_shaped", { shaped })}` : ""}`;
    for (const item of this.#$$<HTMLElement>("#cards .moons-card")) {
      const card = data.cards.find((c) => c.id === item.dataset["id"])!;
      const body = item.querySelector<HTMLElement>("wakusei-body")!;
      body.setAttribute("lang", this.#lang());
      this.#textures(body);
      const size = card.axesKm === null ? [this.#say("card_size"), `${this.#diameter(card.radiusKm)} km`] : [this.#say("card_axes"), `${card.axesKm.map((a) => this.#number(2 * a, 2 * a < 10 ? 1 : 0)).join(" × ")} km`];
      const rows: [string, string][] = [
        [size[0]!, size[1]!],
        [this.#say("card_distance"), card.a === null ? NONE : `${this.#number(card.a)} km`],
        [this.#say("card_period"), card.p === null ? NONE : `${this.#say("days", { n: this.#period(card.p) })}${card.retro ? ` (${this.#say("retrograde")})` : ""}`],
        [this.#say("card_found"), card.date ?? NONE],
        [this.#say("card_where"), card.where ?? NONE],
        [this.#say("card_by"), card.by ?? NONE],
      ];
      const other = this.#lang() === "ja" ? card.name.en : card.name.ja;
      item.querySelector(".words")!.innerHTML =
        `<h3>${escape(card.name[this.#lang()])} <span class="fine">${escape(other)}</span></h3><dl>${rows.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl>` +
        (card.shape === null ? "" : `<p class="fine">${escape(card.shape[this.#lang()])}</p>`);
    }
  }

  #drawTable(): void {
    const data = this.#page();
    const { sort } = this.#state;
    const down = this.#state.order === "down";
    const familyName = (id: string): string => data.families.find((f) => f.id === id)?.names[this.#lang()] ?? id;
    const valueOf = (m: PageMoon): string | number | null => {
      switch (sort) {
        case "name": return this.#moonName(m);
        case "family": return data.families.findIndex((f) => f.id === m.family);
        case "size": return m.r;
        case "distance": return m.a;
        case "period": return m.p;
        case "year": return m.year;
        case "where": return m.where;
        case "by": return m.by;
        case "direction": return m.retro;
      }
    };
    const collator = new Intl.Collator(this.#lang() === "ja" ? "ja" : "en", { numeric: true, sensitivity: "base" });
    const rows = [...data.moons].sort((p, q) => {
      const a = valueOf(p);
      const b = valueOf(q);
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
      const c = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
      return (down ? -c : c) || (p.a ?? Infinity) - (q.a ?? Infinity);
    });
    this.#$("#rows").innerHTML = rows
      .map((m) => {
        const size = m.r === null ? NONE : `${m.est ? "≈ " : ""}${this.#diameter(m.r)}`;
        const direction = m.retro === null ? NONE : `<span class="swatch" style="background:${m.colour.direction}"></span>${escape(this.#say(m.retro === 1 ? "retrograde" : "prograde"))}`;
        const name = escape(this.#moonName(m));
        return (
          `<tr data-id="${m.id}"${m.full ? ' data-full=""' : ""}><th scope="row">${m.full ? `<b>${name}</b>` : name}</th><td>${escape(familyName(m.family))}</td>` +
          `<td data-number="true"${m.est ? ' data-estimate=""' : ""}>${size}</td><td data-number="true">${m.a === null ? NONE : this.#number(m.a)}</td><td data-number="true">${m.p === null ? NONE : this.#period(m.p)}</td>` +
          `<td data-number="true">${m.year ?? NONE}</td><td>${escape(m.where ?? NONE)}</td><td>${escape(m.by ?? NONE)}</td><td>${direction}</td></tr>`
        );
      })
      .join("");
    for (const th of this.#$$<HTMLTableCellElement>("thead th")) {
      if (th.dataset["col"] === sort) th.setAttribute("aria-sort", down ? "descending" : "ascending");
      else th.removeAttribute("aria-sort");
    }
    const header = this.#$(`thead button[data-sort="${sort}"]`).textContent ?? sort;
    const text = TEXT_COLUMNS.includes(sort);
    this.#$("#table-intro").textContent = this.#say("table_intro", { n: data.moons.length, col: header, order: this.#say(text ? (down ? "za" : "az") : down ? "down" : "up") });
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-moon-pages")) customElements.define("wakusei-moon-pages", WakuseiMoonPages);
