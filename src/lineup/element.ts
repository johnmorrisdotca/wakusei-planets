// <wakusei-lineup>: the size line-up. Stars and, if asked, the Earth and Jupiter stand side by side (or one above the next) at TRUE relative size, each drawn with wakusei's star look, each labelled with its radius in Suns
// and kilometres, its error and its source. A slider zooms smoothly from the smallest body up to the largest; each body turns slowly, and a drag turns the one it takes hold of. All the bodies are in ONE three.js scene
// drawn through kazoku-ui's shared renderer (one WebGL context for the page): it draws only when something changes, nothing while it is out of sight, and it adds no frame cap of its own.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "../scene/shared.ts";
import { texturePaths } from "../scene/textures.ts";
import { starLook, type StarLook } from "../star.ts";
import { lineupBodies, LINEUP_SETS, type LineupBody, type LineupSet } from "./data.ts";
import { lineupFocus, lineupProject, lineupView, lineupZoomFor, lineupZoomOf, LINEUP_LAYOUTS, placeLineup, type LineupDot, type LineupLayout, type LineupPlace, type LineupView } from "./layout.ts";
import { lineupLabels, lineupLabelsSvg, lineupText, type LineupLang } from "./labels.ts";
import { createLineupItem, type LineupDraw, type LineupHand, type LineupScene } from "./scene3d.ts";

export { setThreeLoader };

/**
 * What the element is doing: `loading`, `still`, `live`, `lost` or `unavailable` (no WebGL: flat discs are drawn instead).
 *
 * @example
 * ```ts no-run
 * import type { LineupState } from "@johnmorrisdotca/wakusei-planets/lineup";
 *
 * const done = (state: LineupState): boolean => state === "live" || state === "unavailable";
 * console.log(done("still"));
 * ```
 */
export type LineupState = "loading" | "still" | "live" | "lost" | "unavailable";

const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 720px); max-width: 100%; aspect-ratio: var(--wakusei-ratio, 16 / 9); position: relative; overflow: hidden; contain: layout style; touch-action: pan-y; user-select: none; -webkit-user-select: none; background: radial-gradient(ellipse at 50% 40%, #0a1120, #04060b); color: #fff; border-radius: var(--wakusei-radius, 10px); }
:host(:focus-visible) { outline: 3px solid #6cd0ff; outline-offset: -3px; }
:host([data-hand]) { cursor: grab; }
:host([data-held]) { cursor: grabbing; }
#stage, #flat, #over { position: absolute; inset: 0; width: 100%; height: 100%; }
#flat, #over { pointer-events: none; overflow: visible; }
#bar { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); width: min(440px, 78%); display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: rgba(5, 7, 13, 0.72); border: 1px solid rgba(255, 255, 255, 0.2); }
#bar[hidden] { display: none; }
input[type="range"] { flex: 1; min-width: 0; margin: 0; height: 28px; accent-color: #6cd0ff; background: transparent; touch-action: none; }
input[type="range"]:focus-visible { outline: 2px solid #6cd0ff; outline-offset: 2px; border-radius: 4px; }
</style><div id="stage"></div><svg id="flat" aria-hidden="true"></svg><svg id="over" aria-hidden="true"></svg><div id="bar"><input id="zoom" type="range" min="0" max="1000" step="1" value="0" /></div>`;

const num = (value: string | null, fallback: number): number => {
  const n = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const on = (value: string | null): boolean => value !== null && !["off", "0", "false", "no"].includes(value.trim().toLowerCase());
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** A device that should get the cheaper star: little memory or two cores or fewer. */
const weakDevice = (): boolean => {
  const nav = typeof navigator === "undefined" ? undefined : (navigator as Navigator & { deviceMemory?: number });
  return nav !== undefined && ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2);
};

/**
 * The `<wakusei-lineup>` custom element: the size line-up of stars (and, with `planets`, the Earth and Jupiter) at true relative size.
 *
 * Attributes: `stars` (`all`, `bright` or `largest`, or ids from `LINEUP_STARS` separated by commas; `all` by default), `planets` (add the Earth and Jupiter), `layout` (`row` or `stack`), `zoom` (0 to 1, the framed size on a
 * logarithmic scale of radius) or `at` (the id of a body to frame: the Sun by default), `turn` (`off` stops the bodies turning by themselves; they do not under reduced motion unless it is `on`), `look` (`realistic` or `painted`: the
 * planets'), `labels` (`off` hides the words), `controls` (`none` hides the zoom slider), `size` (pixels across), `lang` (`en` or `ja`), `quality` (`full` or `low`), `live` (`always`, `hover` or `off`: when it takes the page's one WebGL
 * context), `texture-base` and `texture-far-base`.
 *
 * A drag on a body turns it (a horizontal swipe on a touch screen); Ctrl, Command or Alt with the wheel zooms; with the element focused the arrow keys go to the next body, + and - zoom a little, Home and End go to the ends,
 * and a double click puts every body back.
 *
 * @example
 * ```ts no-run
 * import { WakuseiLineup } from "@johnmorrisdotca/wakusei-planets/lineup";
 *
 * const lineup = document.createElement("wakusei-lineup") as WakuseiLineup;
 * lineup.setAttribute("stars", "bright");
 * lineup.setAttribute("planets", "");
 * document.body.append(lineup);
 * void lineup.zoomTo("betelgeuse");
 * ```
 */
export class WakuseiLineup extends HTMLElement {
  static observedAttributes = ["stars", "planets", "layout", "zoom", "at", "turn", "look", "size", "lang", "live", "labels", "controls", "quality", "texture-base", "texture-far-base"];

  #root!: ShadowRoot;
  #stage!: HTMLElement;
  #over!: SVGElement;
  #flat!: SVGElement;
  #bar!: HTMLElement;
  #input!: HTMLInputElement;
  #bodies: LineupBody[] = [];
  #places: LineupPlace[] = [];
  #looks = new Map<string, StarLook>();
  #computed = "";
  #zoom = 0;
  #hands = new Map<string, LineupHand>();
  #held: string | undefined;
  #state: LineupState = "loading";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #viewKey = "";
  #stilled = false;
  #wantLive = false;
  #visible = typeof IntersectionObserver !== "function";
  #io: IntersectionObserver | undefined;
  #queued = false;
  #reduce = false;
  #anim: number | undefined;
  #animDone: (() => void) | undefined;
  #overKey = "";
  #drag: { id: string; x: number; y: number; pointer: number } | undefined;
  #hover = (): void => void this.goLive();
  #onContext = (state: ContextState): void => {
    if (state === "unavailable") this.#set("unavailable");
    else if (state === "lost") this.#set("lost");
    else if (this.#view?.live) this.#set("live");
  };
  #onHidden = (): void => {
    if (document.visibilityState !== "hidden") this.#sync();
  };

  /** What the element is doing now. */
  get state(): LineupState {
    return this.#state;
  }

  /** The zoom now, 0 to 1. Setting it moves the camera at once; `zoomTo` moves it smoothly. */
  get zoom(): number {
    return this.#zoom;
  }
  set zoom(value: number) {
    this.#cancelAnimation();
    this.#setZoom(value);
  }

  /** The body the camera frames now: its id. */
  get focused(): string | undefined {
    return lineupFocus(this.#places, this.#zoom)?.body.id;
  }

  /** The bodies drawn, smallest first. */
  get bodies(): readonly LineupBody[] {
    return this.#bodies;
  }

  /** Numbers for a test or a status line. */
  get stats(): { state: LineupState; bodies: number; drawn: readonly string[]; renderer: SharedRenderer<ThreeParts>["stats"] | undefined } {
    return { state: this.#state, bodies: this.#bodies.length, drawn: (this.#view?.scene as LineupScene | undefined)?.drawn ?? [], renderer: this.#renderer?.stats };
  }

  /** Where everything is on the page now: the picture's size in pixels, the camera, and the bodies' centres and radii in pixels. */
  get metrics(): { width: number; height: number; view: LineupView; dots: readonly { id: string; cx: number; cy: number; r: number }[] } {
    const { width, height } = this.#size();
    const view = this.#viewNow();
    return { width, height, view, dots: lineupProject(this.#places, view, width, height).map((dot) => ({ id: dot.place.body.id, cx: dot.cx, cy: dot.cy, r: dot.r })) };
  }

  connectedCallback(): void {
    this.#root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    this.#root.innerHTML = TEMPLATE;
    this.#stage = this.#root.getElementById("stage")!;
    this.#over = this.#root.getElementById("over") as unknown as SVGElement;
    this.#flat = this.#root.getElementById("flat") as unknown as SVGElement;
    this.#bar = this.#root.getElementById("bar")!;
    this.#input = this.#root.getElementById("zoom") as HTMLInputElement;
    this.#reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.hasAttribute("role")) this.setAttribute("role", "group");
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    if (!this.hasAttribute("data-state")) this.setAttribute("data-state", this.#state);
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        this.#visible = last.isIntersecting;
        if (this.#visible) {
          this.#still();
          if (this.#view?.live !== true && this.#priority()) void this.goLive();
        }
      });
      this.#io.observe(this);
    }
    document.addEventListener("visibilitychange", this.#onHidden);
    this.#applyHover();
    this.#input.addEventListener("input", this.#onSlider);
    this.addEventListener("pointerdown", this.#onDown);
    this.addEventListener("pointermove", this.#onMove);
    this.addEventListener("pointerup", this.#onUp);
    this.addEventListener("pointercancel", this.#onUp);
    this.addEventListener("keydown", this.#onKey);
    this.addEventListener("dblclick", this.#onDouble);
    this.addEventListener("wheel", this.#onWheel, { passive: false });
    this.#compute(true);
    this.#queue();
  }

  disconnectedCallback(): void {
    this.#cancelAnimation();
    this.#io?.disconnect();
    document.removeEventListener("visibilitychange", this.#onHidden);
    this.#applyHover(false);
    this.#input.removeEventListener("input", this.#onSlider);
    this.removeEventListener("pointerdown", this.#onDown);
    this.removeEventListener("pointermove", this.#onMove);
    this.removeEventListener("pointerup", this.#onUp);
    this.removeEventListener("pointercancel", this.#onUp);
    this.removeEventListener("keydown", this.#onKey);
    this.removeEventListener("dblclick", this.#onDouble);
    this.removeEventListener("wheel", this.#onWheel);
    this.#disposeView(true);
  }

  attributeChangedCallback(name: string, before: string | null, after: string | null): void {
    if (!this.isConnected || before === after) return;
    if (name === "live") this.#applyHover();
    if (name === "zoom") {
      this.#cancelAnimation();
      this.#setZoom(num(after, this.#zoom));
      return;
    }
    if (name === "at") {
      const at = after === null ? undefined : lineupZoomOf(this.#places, after);
      if (at !== undefined) {
        this.#cancelAnimation();
        this.#setZoom(at);
      }
      return;
    }
    if (name === "stars" || name === "planets" || name === "layout" || name === "quality") this.#compute(false);
    if (name === "look" || name === "texture-base" || name === "texture-far-base") this.#rebuild();
    if (name === "turn") {
      this.#sync();
      this.#changed();
      return;
    }
    this.#queue();
  }

  /**
   * Zoom to a body (its id) or to a number from 0 to 1, smoothly: the camera glides there along the logarithmic scale of radius, as fast as a reader can follow, or at once under reduced motion or with `smooth: false`.
   * Resolves when it has arrived (or been interrupted by a hand). An id that is not in the line-up resolves at once and moves nothing.
   */
  zoomTo(target: string | number, options: { smooth?: boolean } = {}): Promise<void> {
    const to = typeof target === "number" ? clamp(target, 0, 1) : lineupZoomOf(this.#places, target);
    this.#cancelAnimation();
    if (to === undefined) return Promise.resolve();
    if (options.smooth === false || this.#reduce || !this.isConnected || Math.abs(to - this.#zoom) < 1e-4) {
      this.#setZoom(to);
      return Promise.resolve();
    }
    const from = this.#zoom;
    const started = performance.now();
    const duration = 450 + 1100 * Math.abs(to - from);
    return new Promise<void>((resolve) => {
      this.#animDone = resolve;
      const step = (now: number): void => {
        const t = clamp((now - started) / duration, 0, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        this.#setZoom(from + (to - from) * eased);
        if (t < 1) this.#anim = requestAnimationFrame(step);
        else {
          this.#anim = undefined;
          this.#animDone = undefined;
          resolve();
        }
      };
      this.#anim = requestAnimationFrame(step);
    });
  }

  /** Turn a body by hand, in degrees, as a drag would; both are added to what is there. `pitch` stays within 85 degrees. */
  turnBy(id: string, yaw: number, pitch = 0): void {
    const hand = this.#hands.get(id) ?? { yaw: 0, pitch: 0 };
    this.#hands.set(id, { yaw: (hand.yaw + yaw) % 360, pitch: clamp(hand.pitch + pitch, -85, 85) });
    this.#changed();
  }

  /** Put every body back as it was turned. */
  resetTurns(): void {
    this.#hands.clear();
    this.#changed();
  }

  /** Take the page's one WebGL context and draw the line-up on it. Resolves true when it is live. */
  async goLive(): Promise<boolean> {
    if (this.getAttribute("live") === "off" && !this.#wantLive) return this.#view?.live === true;
    this.#wantLive = true;
    await this.#ensureView();
    const ok = (await this.#view?.focus()) === true;
    if (ok) {
      this.#set("live");
      this.#sync();
    } else if (this.#state !== "unavailable" && this.#state !== "lost") this.#set("still");
    return ok;
  }

  /** Give the WebGL context back: the picture stays as a still. */
  rest(): void {
    this.#wantLive = false;
    if (this.#view === undefined) return;
    this.#view.blur();
    if (this.#state !== "unavailable") {
      this.#set("still");
      this.#rekey();
    }
  }

  /**
   * The picture as it is now, as an SVG element that stands alone: a dark background, the bodies as a picture (or flat discs when there is no WebGL) and the labels as vector text. It is the same picture that is saved and printed.
   * The element is not in the page; put it in one (out of sight) before saving it, so its styles can be read.
   */
  async picture(): Promise<SVGSVGElement> {
    const { width, height } = this.#size();
    const view = this.#viewNow();
    let body: string;
    if (this.#state === "unavailable") body = this.#flatMarkup(width, height);
    else {
      const href = await this.#pixels();
      body = `<image x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" href="${href}"/>`;
    }
    const dots = lineupProject(this.#places, view, width, height);
    const labels = this.#labelsOn() ? lineupLabelsSvg(lineupLabels(dots, width, height, this.#lang(), { keep: this.focused, font: this.#font(width) }), this.#font(width)) : "";
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${this.#label().replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"><rect width="${width}" height="${height}" fill="#05070d"/>${body}${labels}</svg>`;
    return new DOMParser().parseFromString(markup, "image/svg+xml").documentElement as unknown as SVGSVGElement;
  }

  /** The picture as SVG text. */
  async toSvg(): Promise<string> {
    return new XMLSerializer().serializeToString(await this.picture());
  }

  /** The picture as a PNG, `scale` times the size it is on the page (1 to 4). */
  async toPng(scale = 2): Promise<Blob> {
    const svg = await this.picture();
    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));
    const ratio = clamp(scale, 1, 4);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const made = new Image(width, height);
      made.onload = () => resolve(made);
      made.onerror = () => reject(new Error("the picture could not be drawn"));
      made.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob === null ? reject(new Error("the picture could not be made")) : resolve(blob)), "image/png"));
  }

  // --- what is drawn --------------------------------------------------------------------------------------------------------------------------------------

  #lang(): LineupLang {
    return this.getAttribute("lang") === "ja" ? "ja" : "en";
  }

  #labelsOn(): boolean {
    return on(this.getAttribute("labels") ?? "on");
  }

  /** The label text size: a little smaller on a narrow picture. */
  #font(width: number): number {
    return width < 520 ? 10.5 : 12;
  }

  #spin(): boolean {
    const turn = this.getAttribute("turn");
    if (turn === null) return !this.#reduce;
    return on(turn === "" ? "on" : turn);
  }

  #size(): { width: number; height: number } {
    const width = Math.max(1, Math.round(this.clientWidth || num(this.getAttribute("size"), 720)));
    const height = Math.max(1, Math.round(this.clientHeight || (width * 9) / 16));
    return { width, height };
  }

  #viewNow(): LineupView {
    const { width, height } = this.#size();
    return lineupView(this.#places, this.#zoom, width / height);
  }

  /** The bodies, their places and their star looks for the attributes; a change of the set or the layout keeps the camera on the body it was framing. */
  #compute(first: boolean): void {
    const stars = this.getAttribute("stars") ?? "all";
    const planets = this.hasAttribute("planets") && on(this.getAttribute("planets") === "" ? "on" : this.getAttribute("planets"));
    const layout: LineupLayout = (LINEUP_LAYOUTS as readonly string[]).includes(this.getAttribute("layout") ?? "") ? (this.getAttribute("layout") as LineupLayout) : "row";
    const quality = this.getAttribute("quality") === "low" || (this.getAttribute("quality") !== "full" && weakDevice()) ? "low" : "full";
    const key = JSON.stringify([stars, planets, layout, quality]);
    if (key === this.#computed) return;
    const focus = lineupFocus(this.#places, this.#zoom);
    const before = focus === undefined ? undefined : { id: focus.body.id, r: focus.r };
    this.#computed = key;
    this.removeAttribute("data-error");
    try {
      const set: LineupSet | string[] = (LINEUP_SETS as readonly string[]).includes(stars) ? (stars as LineupSet) : stars.split(",").map((one) => one.trim()).filter((one) => one !== "");
      this.#bodies = lineupBodies({ set, planets });
    } catch (error) {
      this.setAttribute("data-error", error instanceof Error ? error.message : String(error));
      this.#bodies = [];
    }
    this.#places = placeLineup(this.#bodies, layout);
    this.#looks = new Map();
    for (const body of this.#bodies) {
      if (body.row === undefined) continue;
      const estimated = body.row.basis === "luminosity" || body.row.basis === "weak-distance" ? (["radiusSun"] as const) : [];
      this.#looks.set(body.id, starLook({ ...body.row.look, name: body.row.name.en, radiusSun: body.row.radiusSun, estimated }, { quality }));
    }
    for (const id of [...this.#hands.keys()]) if (!this.#bodies.some((body) => body.id === id)) this.#hands.delete(id);
    // the camera: the attribute's, on the first look; after a change the body it was on, or the Sun
    const attribute = this.getAttribute("zoom");
    const at = this.getAttribute("at");
    const zoom =
      first
        ? attribute !== null
          ? num(attribute, 0)
          : (lineupZoomOf(this.#places, at ?? "sun") ?? 0)
        : before === undefined
          ? (lineupZoomOf(this.#places, "sun") ?? 0)
          : (lineupZoomOf(this.#places, before.id) ?? lineupZoomFor(this.#places, before.r));
    this.#zoom = clamp(zoom, 0, 1);
    this.#syncSlider();
    if (!first) {
      this.#rebuild();
      this.dispatchEvent(new CustomEvent("wakusei-lineup-zoom", { detail: { zoom: this.#zoom, focus: this.focused } }));
    }
    this.#queue();
  }

  /** The scene is built for one set of bodies and one look: a new set or look makes a new view, and a view that was live takes the context again. */
  #rebuild(): void {
    if (this.#view === undefined) return;
    if (this.#view.live) this.#wantLive = true;
    this.#disposeView();
  }

  #setZoom(value: number): void {
    const next = clamp(Number.isFinite(value) ? value : 0, 0, 1);
    if (next === this.#zoom) return;
    this.#zoom = next;
    this.#syncSlider();
    this.dispatchEvent(new CustomEvent("wakusei-lineup-zoom", { detail: { zoom: next, focus: this.focused } }));
    this.#changed();
  }

  #syncSlider(): void {
    if (this.#input === undefined) return;
    this.#input.value = String(Math.round(this.#zoom * 1000));
    const lang = this.#lang();
    const first = this.#bodies[0]?.name[lang] ?? "";
    const last = this.#bodies[this.#bodies.length - 1]?.name[lang] ?? "";
    this.#input.setAttribute("aria-label", lang === "ja" ? `ズーム: ${first}から${last}まで` : `Zoom: from ${first} up to ${last}`);
    const near = this.#places.length === 0 ? undefined : lineupFocus(this.#places, this.#zoom)?.body;
    if (near !== undefined) {
      const text = lineupText(near, lang);
      this.#input.setAttribute("aria-valuetext", `${text.name}: ${text.radius}`);
    }
    this.#bar.hidden = this.getAttribute("controls") === "none" || this.#places.length < 2;
  }

  #label(): string {
    const lang = this.#lang();
    const names = this.#bodies.map((body) => body.name[lang]);
    return lang === "ja" ? `大きさくらべ: ${names.join("、")} (大きさの比は実際のとおり)` : `Size line-up: ${names.join(", ")}, at true relative size`;
  }

  // --- drawing ------------------------------------------------------------------------------------------------------------------------------------------

  #draw(): LineupDraw {
    return { places: this.#places, view: this.#viewNow(), hands: this.#hands, spin: this.#spin(), ...(this.#held === undefined ? {} : { holding: this.#held }) };
  }

  #queue(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.isConnected) void this.#refresh();
    });
  }

  #changed(): void {
    if (!this.isConnected) return;
    if (this.#view?.live === true && !this.#queued) {
      this.#paintOver();
      this.#sync();
      this.#view.invalidate();
    } else this.#queue();
  }

  async #refresh(): Promise<void> {
    if (!this.isConnected) return;
    this.#style();
    this.#syncSlider();
    this.setAttribute("aria-label", this.#label());
    this.#paintOver();
    if (this.#bodies.length === 0 || this.#state === "unavailable") {
      if (this.#state === "unavailable") this.#paintFlat();
      return;
    }
    if (this.#view === undefined || this.#viewKey === "") await this.#ensureView();
    if (this.#view?.live !== true && this.#wantLive) {
      void this.goLive();
      return;
    }
    if (this.#view?.live === true) {
      this.#sync();
      this.#view.invalidate();
    } else {
      this.#rekey();
      if (this.#wantLive || this.#priority()) void this.goLive();
    }
  }

  #style(): void {
    if (this.hasAttribute("size")) this.style.setProperty("--wakusei-size", `${num(this.getAttribute("size"), 720)}px`);
  }

  #priority(): boolean {
    return (this.getAttribute("live") ?? "always") === "always" && this.#visible;
  }

  #applyHover(allow = true): void {
    const events = ["pointerenter", "focusin", "pointerdown"];
    for (const name of events) this.removeEventListener(name, this.#hover);
    if (allow && (this.getAttribute("live") ?? "always") === "hover") for (const name of events) this.addEventListener(name, this.#hover);
  }

  #dots(): LineupDot[] {
    const { width, height } = this.#size();
    return lineupProject(this.#places, this.#viewNow(), width, height);
  }

  #paintOver(): void {
    if (this.#over === undefined) return;
    const { width, height } = this.#size();
    const dots = this.#dots();
    const markup = this.#labelsOn() ? lineupLabelsSvg(lineupLabels(dots, width, height, this.#lang(), { keep: this.focused, font: this.#font(width) }), this.#font(width)) : "";
    const key = `${width}x${height}|${markup}`;
    if (key === this.#overKey) return;
    this.#overKey = key;
    this.#over.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.#over.innerHTML = markup;
  }

  /** Flat discs, for a page with no WebGL: each body a disc in the colour of its star (a planet in its own colour), shaded a little to the edge. */
  #flatMarkup(width: number, height: number): string {
    const dots = this.#dots();
    const defs: string[] = [];
    const discs: string[] = [];
    for (const dot of dots) {
      if (dot.r < 0.4 || dot.cx + dot.r < 0 || dot.cx - dot.r > width || dot.cy + dot.r < 0 || dot.cy - dot.r > height) continue;
      const id = dot.place.body.id;
      const look = this.#looks.get(id);
      const centre = look?.tone ?? (id === "earth" ? "#5d9bd8" : "#e0c39a");
      const edge = look?.colour ?? (id === "earth" ? "#2a5d96" : "#9b7a52");
      defs.push(`<radialGradient id="flat-${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${centre}"/><stop offset="0.8" stop-color="${edge}"/><stop offset="1" stop-color="${edge}" stop-opacity="0.85"/></radialGradient>`);
      discs.push(`<circle cx="${dot.cx.toFixed(2)}" cy="${dot.cy.toFixed(2)}" r="${Math.max(dot.r, 0.4).toFixed(2)}" fill="url(#flat-${id})"/>`);
    }
    return `<defs>${defs.join("")}</defs>${discs.join("")}`;
  }

  #paintFlat(): void {
    const { width, height } = this.#size();
    this.#flat.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.#flat.innerHTML = this.#state === "unavailable" ? this.#flatMarkup(width, height) : "";
  }

  #key(): string {
    const { width } = this.#size();
    const hands = [...this.#hands].map(([id, hand]) => `${id}:${Math.round(hand.yaw)}/${Math.round(hand.pitch)}`).join(",");
    return `${this.#computed}|${this.getAttribute("look") ?? ""}|${width}|${this.#zoom.toFixed(4)}|${hands}`;
  }

  // Replacing a view keeps the renderer lease; leaving 3D gives it back.
  #disposeView(releaseRenderer = false): void {
    this.#view?.dispose();
    this.#view = undefined;
    this.#viewKey = "";
    if (releaseRenderer) {
      this.#release?.();
      this.#release = undefined;
      this.#renderer = undefined;
    }
  }

  async #ensureView(): Promise<void> {
    if (this.#renderer === undefined) {
      const taken = takeRenderer(this.#onContext);
      this.#renderer = taken.renderer;
      this.#release = taken.release;
    }
    if (this.#view === undefined) this.#makeView();
  }

  #makeView(): void {
    this.#viewKey = this.#key();
    this.#stilled = false;
    this.#stage.innerHTML = "";
    const item = createLineupItem({
      key: this.#viewKey,
      bodies: this.#bodies,
      stars: this.#looks,
      look: this.getAttribute("look") === "painted" ? "painted" : "realistic",
      state: () => this.#draw(),
      ...texturePaths(this),
      redraw: () => this.#view?.invalidate(),
    });
    this.#view = this.#renderer!.view(this.#stage, item);
    this.#set("loading");
    if (this.#visible) this.#still();
  }

  #still(): void {
    if (this.#stilled || this.#view === undefined) return;
    this.#stilled = true;
    void this.#view.showStill().then(() => {
      if (this.#state === "loading") this.#set("still");
    });
  }

  #rekey(): void {
    if (this.#renderer === undefined || this.#view === undefined || this.#view.live) return;
    if (this.#key() === this.#viewKey) return;
    this.#disposeView();
    this.#makeView();
  }

  #sync(): void {
    const scene = this.#view?.scene as LineupScene | undefined;
    if (scene === undefined || typeof scene.apply !== "function") return;
    scene.apply(this.#draw());
  }

  #set(state: LineupState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.setAttribute("data-state", state);
    this.dispatchEvent(new CustomEvent("wakusei-state", { detail: { state } }));
    if (state === "unavailable") this.#paintFlat();
    else if (this.#flat !== undefined) this.#flat.innerHTML = "";
  }

  // --- reading the picture ------------------------------------------------------------------------------------------------------------------------------

  /** The canvas as a PNG address, taken right after a draw, in the same task, while it still holds the picture. */
  async #pixels(): Promise<string> {
    if (this.#view?.live !== true && !(await this.goLive())) throw new Error("the 3D picture is not available here");
    return new Promise<string>((done, reject) => {
      const view = this.#view;
      const scene = view?.scene as LineupScene | undefined;
      const canvas = this.#stage.querySelector("canvas");
      if (view === undefined || scene?.afterDraw === undefined || canvas === null) {
        reject(new Error("the 3D picture is not available here"));
        return;
      }
      const timeout = setTimeout(() => reject(new Error("the picture was not drawn")), 8000);
      scene.afterDraw(() => {
        clearTimeout(timeout);
        try {
          done(canvas.toDataURL("image/png"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("the picture could not be read"));
        }
      });
      this.#sync();
      view.invalidate();
    });
  }

  // --- hands --------------------------------------------------------------------------------------------------------------------------------------------

  #onSlider = (): void => {
    this.#cancelAnimation();
    this.#setZoom(Number(this.#input.value) / 1000);
  };

  #cancelAnimation(): void {
    if (this.#anim !== undefined) cancelAnimationFrame(this.#anim);
    this.#anim = undefined;
    const done = this.#animDone;
    this.#animDone = undefined;
    done?.();
  }

  /** The body under a point (client coordinates): the one the point is nearest the middle of, within a few pixels of its edge. */
  #hit(clientX: number, clientY: number): string | undefined {
    const box = this.getBoundingClientRect();
    const { width, height } = this.#size();
    const x = ((clientX - box.left) / Math.max(1, box.width)) * width;
    const y = ((clientY - box.top) / Math.max(1, box.height)) * height;
    let best: { id: string; score: number } | undefined;
    for (const dot of this.#dots()) {
      if (dot.r < 0.2) continue;
      const slop = 6;
      const d = Math.hypot(x - dot.cx, y - dot.cy);
      if (d > dot.r + slop) continue;
      const score = d / Math.max(dot.r, 1);
      if (best === undefined || score < best.score) best = { id: dot.place.body.id, score };
    }
    return best?.id;
  }

  #onDown = (event: PointerEvent): void => {
    if (event.composedPath().includes(this.#bar) || (event.pointerType === "mouse" && event.button !== 0)) return;
    const id = this.#hit(event.clientX, event.clientY);
    if (id === undefined) return;
    this.#drag = { id, x: event.clientX, y: event.clientY, pointer: event.pointerId };
    this.#held = id;
    this.setAttribute("data-held", "");
    try {
      this.setPointerCapture(event.pointerId);
    } catch {
      /* a pointer that is already gone */
    }
    void this.goLive();
    this.#changed();
  };

  #onMove = (event: PointerEvent): void => {
    if (this.#drag === undefined) {
      if (event.pointerType === "mouse") this.toggleAttribute("data-hand", this.#hit(event.clientX, event.clientY) !== undefined);
      return;
    }
    if (event.pointerId !== this.#drag.pointer) return;
    const dx = event.clientX - this.#drag.x;
    const dy = event.clientY - this.#drag.y;
    this.#drag.x = event.clientX;
    this.#drag.y = event.clientY;
    const hand = this.#hands.get(this.#drag.id) ?? { yaw: 0, pitch: 0 };
    // the surface follows the hand: a drag right turns the front to the right, a drag down brings the pole toward you
    this.#hands.set(this.#drag.id, { yaw: (hand.yaw + dx * 0.4) % 360, pitch: clamp(hand.pitch + dy * 0.4, -85, 85) });
    this.#changed();
  };

  #onUp = (event: PointerEvent): void => {
    if (this.#drag === undefined || event.pointerId !== this.#drag.pointer) return;
    this.#drag = undefined;
    this.#held = undefined;
    this.removeAttribute("data-held");
    this.#changed();
  };

  #onDouble = (event: MouseEvent): void => {
    if (event.composedPath().includes(this.#bar)) return;
    this.resetTurns();
  };

  #onWheel = (event: WheelEvent): void => {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) return;
    event.preventDefault();
    this.#cancelAnimation();
    this.#setZoom(this.#zoom - event.deltaY * 0.0006);
  };

  #onKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const at = lineupFocus(this.#places, this.#zoom);
    const index = at === undefined ? 0 : this.#places.indexOf(at);
    const go = (i: number): void => {
      const to = this.#places[clamp(i, 0, this.#places.length - 1)];
      if (to !== undefined) void this.zoomTo(to.body.id);
    };
    const key = event.key;
    if (key === "ArrowRight" || key === "ArrowUp") go(index + 1);
    else if (key === "ArrowLeft" || key === "ArrowDown") go(index - 1);
    else if (key === "+" || key === "=") this.zoom = this.#zoom + 0.03;
    else if (key === "-" || key === "_") this.zoom = this.#zoom - 0.03;
    else if (key === "Home") go(0);
    else if (key === "End") go(this.#places.length - 1);
    else return;
    event.preventDefault();
  };
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-lineup")) customElements.define("wakusei-lineup", WakuseiLineup);
