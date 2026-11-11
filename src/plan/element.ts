// <wakusei-plan>: a small top-down plan, in SVG with no WebGL: the solar system from above with one body marked, or one planet's moons from above its north pole with one moon marked. Positions are the package's own for the `time` it is
// given. It draws when an input changes (the time, the mark, the system, the spacing, the names, the language, its size) and never on a timer, and nothing while it is out of sight. A press on a dot sends `wakusei-plan-pick`.
import { DWARF_IDS, MINOR_IDS } from "../facts.ts";
import { SPACECRAFT_IDS, type SpacecraftId } from "../spacecraft-facts.ts";
import { PLAN_AU_KM, planAt, PLAN_SYSTEMS, type Plan, type PlanExtra, type PlanSpacing, type PlanSystem } from "./layout.ts";
import { planSvg, type PlanLang } from "./svg.ts";

const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 240px); max-width: 100%; aspect-ratio: 1; overflow: hidden; contain: layout style; border-radius: var(--wakusei-radius, 10px); background: var(--wakusei-plan-bg, light-dark(#fbf8f1, #1d201e)); }
:host([hidden]) { display: none; }
:host([theme="light"]) { color-scheme: light; }
:host([theme="dark"]) { color-scheme: dark; }
#plan { width: 100%; height: 100%; }
</style><div id="plan"></div>`;

type Spacecraft = typeof import("../spacecraft.ts");

const READ_TIME = (value: string | null): number | "now" => {
  if (value === null || value.trim() === "" || value.trim() === "now") return "now";
  const text = value.trim();
  const ms = /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Date.parse(text);
  return Number.isFinite(ms) ? ms : "now";
};
const off = (value: string | null): boolean => value !== null && ["off", "0", "false", "no"].includes(value.trim().toLowerCase());

/**
 * What the pick event carries: the body's id and what kind of body it is.
 *
 * @example
 * ```ts no-run
 * import type { PlanPick } from "@johnmorrisdotca/wakusei-planets/plan/element";
 *
 * const describe = (pick: PlanPick): string => `${pick.id} (${pick.kind})`;
 * console.log(describe({ id: "mars", kind: "planet" }));
 * ```
 */
export interface PlanPick {
  id: string;
  kind: string;
}

/**
 * The `<wakusei-plan>` custom element: a small plan seen from above, in SVG, light enough for an inset of 200 to 280 pixels.
 *
 * Attributes: `system` (`sun`, the default, draws the solar system from above the ecliptic's north pole; a planet or dwarf planet with moons, such as `jupiter`, draws its moons from above its north pole), `mark` (the body the plan is about: its
 * id in any case, such as `mars`, `ceres`, `halley`, `io` or a craft such as `voyager1`; in the solar system a moon marks its planet. A craft's path, or the fitted table of a dwarf planet or minor body, is fetched the first time it is marked), `time` (an ISO date or milliseconds since 1970, and a bare number is always milliseconds, so `2026` is two seconds past the start of 1970 and not a year; the moment it is read when left out or `now`, and then it stands still:
 * set `time` again to move it), `spacing` (`squeezed`, the default, puts each body at the logarithm of its distance so inner and outer both show; `true` is to scale), `names` (`off` hides every name but the marked body's), `lang` (`en` or `ja`;
 * the page's `lang` when left out), `size` (pixels across, 240 by default; also `--wakusei-size`) and `theme` (`light` or `dark`; the page's colour scheme when left out). The colours are `--wakusei-plan-bg`, `-ink`, `-muted`, `-line`, `-sun`, `-dot` and `-mark`.
 *
 * It draws only when one of these changes, and not while it is out of sight, and it has no timer: a page that moves time sets `time` as often as it likes. A press or Enter on a dot sends `wakusei-plan-pick` with `detail: { id, kind }`.
 *
 * @example
 * ```ts no-run
 * import type { WakuseiPlan } from "@johnmorrisdotca/wakusei-planets/plan/element";
 *
 * const plan = document.createElement("wakusei-plan") as WakuseiPlan;
 * plan.setAttribute("mark", "mars");
 * plan.setAttribute("time", "2026-11-11T12:00Z");
 * plan.addEventListener("wakusei-plan-pick", (event) => console.log((event as CustomEvent).detail.id));
 * document.body.append(plan);
 * ```
 */
export class WakuseiPlan extends HTMLElement {
  static observedAttributes = ["system", "mark", "time", "spacing", "names", "lang", "size", "theme"];

  #root!: ShadowRoot;
  #box!: HTMLElement;
  #time: number | "now" = "now";
  #size = 0;
  #draws = 0;
  #plan: Plan | undefined;
  #queued = false;
  #dirty = true;
  #visible = typeof IntersectionObserver !== "function";
  #resize: ResizeObserver | undefined;
  #io: IntersectionObserver | undefined;
  #watch: MutationObserver | undefined;
  #craft: Spacecraft | undefined;
  /** The craft whose paths are loaded, and those being fetched: each is fetched once, when it is first marked. */
  #craftLoaded = new Set<string>();
  #craftLoading = new Set<string>();
  /** The fitted tables fetched for a marked dwarf planet or minor body, by entry point. */
  #tablesAsked = new Set<string>();

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = TEMPLATE;
    this.#box = this.#root.getElementById("plan")!;
    this.#box.addEventListener("click", (event) => this.#pick(event.target));
    this.#box.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.#pick(event.target);
      }
    });
  }

  /** How many times it has drawn: it moves only when an input changes, so a test can check that nothing draws while nothing changes. */
  get draws(): number {
    return this.#draws;
  }

  /** The plan last drawn, or `undefined` before the first draw. */
  get plan(): Plan | undefined {
    return this.#plan;
  }

  /** The moment shown: milliseconds since 1970, or `"now"` (the moment it draws). Setting it draws again. */
  get time(): number | "now" {
    return this.#time;
  }
  set time(value: number | "now") {
    this.#time = value === "now" || !Number.isFinite(value) ? "now" : value;
    this.#queue();
  }

  connectedCallback(): void {
    if (this.hasAttribute("time")) this.#time = READ_TIME(this.getAttribute("time"));
    if (this.hasAttribute("size")) this.#applySize();
    if (typeof ResizeObserver === "function") {
      this.#resize = new ResizeObserver((entries) => {
        const width = Math.round(entries[0]?.contentRect.width ?? 0);
        if (width > 0 && width !== this.#size) {
          this.#size = width;
          this.#queue();
        }
      });
      this.#resize.observe(this);
    } else this.#size = Math.round(this.getBoundingClientRect().width) || 240;
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const seen = entries[entries.length - 1]?.isIntersecting ?? this.#visible;
        if (seen !== this.#visible) {
          this.#visible = seen;
          if (seen) this.#queue();
        }
      });
      this.#io.observe(this);
    }
    // the page's language, when this element has none of its own
    this.#watch = new MutationObserver(() => {
      if (!this.hasAttribute("lang")) this.#queue();
    });
    this.#watch.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    // and the nearest ancestor that sets one, which is the language it reads when it has none
    const near = this.parentElement?.closest("[lang]");
    if (near !== null && near !== undefined && near !== document.documentElement) this.#watch.observe(near, { attributes: true, attributeFilter: ["lang"] });
    this.#queue();
  }

  disconnectedCallback(): void {
    this.#resize?.disconnect();
    this.#io?.disconnect();
    this.#watch?.disconnect();
    this.#resize = this.#io = this.#watch = undefined;
    this.#visible = typeof IntersectionObserver !== "function";
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    // writing the value it already has is not a change
    if (old === value) return;
    if (name === "time") this.#time = READ_TIME(value);
    if (name === "size") this.#applySize();
    this.#queue();
  }

  #applySize(): void {
    const n = Number(this.getAttribute("size"));
    if (Number.isFinite(n) && n >= 120) this.style.setProperty("--wakusei-size", `${Math.round(n)}px`);
    else this.style.removeProperty("--wakusei-size");
  }

  #lang(): PlanLang {
    const own = this.getAttribute("lang") ?? this.closest("[lang]")?.getAttribute("lang") ?? "en";
    return own.toLowerCase().startsWith("ja") ? "ja" : "en";
  }

  /** Ask for a draw: any number of changes in one go make one. */
  #queue(): void {
    this.#dirty = true;
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      this.#draw();
    });
  }

  /** The mark, in lower case. */
  #mark(): string | undefined {
    return this.getAttribute("mark")?.trim().toLowerCase() || undefined;
  }

  /** The craft marked, if the mark is one. */
  #craftMarked(): SpacecraftId | undefined {
    const mark = this.#mark();
    return mark !== undefined && (SPACECRAFT_IDS as readonly string[]).includes(mark) ? (mark as SpacecraftId) : undefined;
  }

  /** The place of the craft marked, once its path has been fetched (each craft's the first time it is marked); until then, nothing. */
  #extras(id: SpacecraftId | undefined, time: number): PlanExtra[] {
    if (id === undefined) return [];
    if (!this.#craftLoaded.has(id) || this.#craft === undefined) {
      if (!this.#craftLoading.has(id)) {
        this.#craftLoading.add(id);
        void import("../spacecraft.ts").then(async (module) => {
          await module.loadSpacecraft(id);
          this.#craft = module;
          this.#craftLoaded.add(id);
          this.#queue();
        }, () => undefined);
      }
      return [];
    }
    try {
      const km = this.#craft.spacecraftPosition(id, time);
      return [{ id, au: [km[0] / PLAN_AU_KM, km[1] / PLAN_AU_KM, km[2] / PLAN_AU_KM] }];
    } catch {
      return [];
    }
  }

  /** A marked dwarf planet or minor body is drawn from its fitted table once that has been fetched; until then from the elements of one epoch. */
  #tables(mark: string | undefined): void {
    if (mark === undefined) return;
    const entry = mark === "ceres" ? "ceres" : (DWARF_IDS as readonly string[]).includes(mark) ? "dwarfs" : (MINOR_IDS as readonly string[]).includes(mark) ? "minor" : undefined;
    if (entry === undefined || this.#tablesAsked.has(entry)) return;
    this.#tablesAsked.add(entry);
    const load = entry === "ceres" ? import("../tables/ceres.ts") : entry === "dwarfs" ? import("../tables/dwarfs.ts") : import("../tables/minor.ts");
    void load.then(() => this.#queue(), () => undefined);
  }

  #draw(): void {
    if (!this.isConnected || !this.#dirty) return;
    if (!this.#visible || this.#size <= 0) return;
    this.#dirty = false;
    const time = this.#time === "now" ? Date.now() : this.#time;
    const wanted = this.getAttribute("system") ?? "sun";
    const system: PlanSystem = (PLAN_SYSTEMS as readonly string[]).includes(wanted) ? (wanted as PlanSystem) : "sun";
    const spacing: PlanSpacing = this.getAttribute("spacing") === "true" ? "true" : "squeezed";
    const craft = this.#craftMarked();
    this.#tables(this.#mark());
    const plan = planAt(time, { system, spacing, mark: this.#mark(), extras: system === "sun" ? this.#extras(craft, time) : [] });
    const held = this.#root.activeElement?.getAttribute("data-id");
    this.#box.innerHTML = planSvg(plan, { size: this.#size, lang: this.#lang(), names: !off(this.getAttribute("names")) });
    if (held !== null && held !== undefined) this.#box.querySelector<SVGElement>(`g[data-id="${held}"]`)?.focus();
    this.#plan = plan;
    this.#draws += 1;
    this.setAttribute("data-state", "ready");
  }

  #pick(target: EventTarget | null): void {
    const body = (target as Element | null)?.closest?.("g[data-id]");
    const id = body?.getAttribute("data-id");
    if (id === null || id === undefined) return;
    this.dispatchEvent(new CustomEvent<PlanPick>("wakusei-plan-pick", { detail: { id, kind: body?.getAttribute("data-kind") ?? "" }, bubbles: true, composed: true }));
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-plan")) customElements.define("wakusei-plan", WakuseiPlan);
