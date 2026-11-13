// <wakusei-surface>: a person standing on the Moon, at a site with measured heights. The ground is drawn from the heights, lit by the Sun where it really is and shadowed by the ground itself, under a
// black sky with the Earth where it really is. It draws through kazoku-ui's shared renderer (one WebGL context for the page), only when something changes (a look, a step, a new time) and at most
// thirty times a second while a key is held, and nothing at rest or out of sight. The heights come from tiles (`tiles`), not from the package: see the surface guide.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { createGate, frameCap, type Gate } from "../gate.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "../scene/shared.ts";
import { TILES_BASE } from "../scene/textures.ts";
import { madeGround, standingPlace } from "./detail.ts";
import { drop, groundAt, type HeightLevel, type TerrainManifest } from "./height.ts";
import { loadTerrain, type Terrain, type TerrainProgress } from "./load.ts";
import { createSurfaceItem, type SurfaceScene } from "./scene.ts";
import { moonSky, type MoonSky } from "./sky.ts";
import { siteById } from "./site.ts";
import { clampLook, EYE_HEIGHT, stepOver, WALK_SPEED, type Look } from "./view.ts";

export { setThreeLoader };

/**
 * What the element is doing: `loading` (the heights are on their way), `live` (drawn), `lost` (the page's graphics context was lost and will come back), `unavailable` (no WebGL, or no heights for
 * the site: nothing can be drawn) or `idle` (not yet asked to).
 *
 * @example
 * ```ts no-run
 * import type { SurfaceState } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const ready = (state: SurfaceState): boolean => state === "live";
 * console.log(ready("loading"));
 * ```
 */
export type SurfaceState = "idle" | "loading" | "live" | "lost" | "unavailable";

const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 960px); max-width: 100%; aspect-ratio: var(--wakusei-ratio, 16 / 9); position: relative; overflow: hidden; background: #000; contain: layout style; touch-action: none; user-select: none; cursor: grab; }
:host(:focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
:host([data-dragging]) { cursor: grabbing; }
#stage { position: absolute; inset: 0; }
#note { position: absolute; left: 8px; right: 8px; bottom: 6px; margin: 0; font: 400 11px/1.35 system-ui, sans-serif; color: #c8ccd4; text-shadow: 0 1px 2px #000; pointer-events: none; }
#status { position: absolute; inset: 0; display: grid; place-items: center; font: 500 13px system-ui, sans-serif; color: #c8ccd4; pointer-events: none; }
#status[hidden] { display: none; }
</style><div id="stage"></div><p id="note"></p><p id="status" role="status"></p>`;

const num = (value: string | null, fallback: number): number => {
  const n = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * The `<wakusei-surface>` custom element: standing on a body.
 *
 * Attributes: `body` (`moon`), `site` (a name from `SURFACE_SITES`, `apollo-17`), `time` (an ISO date and time, or milliseconds since 1970; the site's own landing moment when left out; `now` for the real time),
 * `heading` (degrees clockwise from north to look toward), `pitch` (degrees up), `fov` (the view's height in degrees: zoom), `tiles` (the folder the height tiles are served from; the demo site's `tiles/` by default),
 * `lang` (`en` or `ja`: the words on the picture).
 *
 * A drag turns the view; the keys W, A, S, D and the arrow keys walk (1.4 metres a second, over the real ground: it rises and falls under the eyes), Q and E turn, + and - zoom, and Ctrl with the wheel or a
 * pinch zooms. Nothing is drawn at rest.
 *
 * @example
 * ```ts no-run
 * import { WakuseiSurface } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const view = document.createElement("wakusei-surface") as WakuseiSurface;
 * view.setAttribute("site", "apollo-17");
 * document.body.append(view);
 * ```
 */
export class WakuseiSurface extends HTMLElement {
  static observedAttributes = ["shadows", "detail", "exposure", "site", "time", "heading", "pitch", "fov", "tiles", "lang", "body"];

  #root!: ShadowRoot;
  #stage!: HTMLElement;
  #noteEl!: HTMLElement;
  #statusEl!: HTMLElement;
  #state: SurfaceState = "idle";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #terrain: Terrain | undefined;
  #loading: Promise<void> | undefined;
  #abort: AbortController | undefined;
  #gate: Gate | undefined;
  #look: Look = { azimuth: 232, pitch: 13, fov: 74 };
  #at = { east: 0, north: 0 };
  #time = 0;
  #sky: MoonSky | undefined;
  #visible = typeof IntersectionObserver !== "function";
  #io: IntersectionObserver | undefined;
  #keys = new Set<string>();
  #walkTimer: ReturnType<typeof setTimeout> | undefined;
  #walkAt = 0;
  #progress: TerrainProgress | undefined;
  #placed = false;
  #pointers = new Map<number, { x: number; y: number }>();
  #pinch = 0;
  #draws = 0;
  #onContext = (state: ContextState): void => {
    if (state === "unavailable") this.#set("unavailable");
    else if (state === "lost") this.#set("lost");
    else if (this.#view?.live) this.#set("live");
  };

  /** The state now. */
  get state(): SurfaceState {
    return this.#state;
  }

  /** The eyes' look now. Setting it turns the view (azimuth and pitch in degrees, `fov` the view's height in degrees); it is drawn at once. */
  get look(): Look {
    return { ...this.#look };
  }
  set look(value: Look) {
    this.#look = clampLook(value);
    this.#changed();
  }

  /** Where the eyes are: metres east and north of the site, and metres over the ground under them. */
  get position(): { east: number; north: number; up: number } {
    return { ...this.#at, up: EYE_HEIGHT };
  }

  /** The sky now: the Sun and the Earth in it. */
  get sky(): MoonSky | undefined {
    return this.#sky;
  }

  /** The moment shown, milliseconds since 1970. */
  get time(): number {
    return this.#time;
  }
  set time(value: number) {
    this.#time = value;
    this.#changed();
  }

  /** The height model as loaded, or `undefined` before: for a status line and a test. */
  get terrain(): { manifest: TerrainManifest; levels: readonly HeightLevel[]; bytes: number } | undefined {
    return this.#terrain;
  }

  /** Numbers for a test or a status line. */
  get stats(): { state: SurfaceState; draws: number; tiles: TerrainProgress | undefined; renderer: SharedRenderer<ThreeParts>["stats"] | undefined; mesh: SurfaceScene["mesh"] | undefined } {
    return { state: this.#state, draws: this.#draws, tiles: this.#progress, renderer: this.#renderer?.stats, mesh: (this.#view?.scene as SurfaceScene | undefined)?.mesh };
  }

  connectedCallback(): void {
    this.#root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    this.#root.innerHTML = TEMPLATE;
    this.#stage = this.#root.getElementById("stage")!;
    this.#noteEl = this.#root.getElementById("note")!;
    this.#statusEl = this.#root.getElementById("status")!;
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
    this.setAttribute("data-state", this.#state);
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency }), () => this.#draw());
    this.#readAttributes();
    this.addEventListener("pointerdown", this.#onPointerDown);
    this.addEventListener("pointermove", this.#onPointerMove);
    this.addEventListener("pointerup", this.#onPointerUp);
    this.addEventListener("pointercancel", this.#onPointerUp);
    this.addEventListener("wheel", this.#onWheel, { passive: false });
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("keyup", this.#onKeyUp);
    this.addEventListener("blur", this.#onBlur);
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        this.#visible = last.isIntersecting;
        if (this.#visible) void this.#start();
        else this.#view?.blur();
      });
      this.#io.observe(this);
    }
    void this.#start();
  }

  disconnectedCallback(): void {
    this.#io?.disconnect();
    this.#abort?.abort();
    this.#gate?.cancel();
    clearTimeout(this.#walkTimer);
    for (const [type, fn] of [["pointerdown", this.#onPointerDown], ["pointermove", this.#onPointerMove], ["pointerup", this.#onPointerUp], ["pointercancel", this.#onPointerUp], ["wheel", this.#onWheel], ["keydown", this.#onKeyDown], ["keyup", this.#onKeyUp], ["blur", this.#onBlur]] as const) this.removeEventListener(type, fn as EventListener);
    this.#view?.dispose();
    this.#view = undefined;
    this.#release?.();
    this.#release = undefined;
    this.#renderer = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "site" || name === "body" || name === "tiles") {
      this.#terrain = undefined;
      this.#loading = undefined;
      this.#view?.dispose();
      this.#view = undefined;
      this.#readAttributes();
      void this.#start();
      return;
    }
    this.#readAttributes();
    this.#changed();
  }

  /**
   * Walk: `ahead` metres along the heading (negative backs up) and `aside` to its right. The ground under the eyes is read from the heights, so the eyes rise and fall with it.
   *
   * @param ahead - Metres forward.
   * @param aside - Metres to the right.
   */
  walk(ahead: number, aside = 0): void {
    this.#at = stepOver(this.#at, this.#look.azimuth, ahead, aside);
    this.#changed();
  }

  #site() {
    return siteById(this.getAttribute("site") ?? "apollo-17");
  }

  #readAttributes(): void {
    const site = this.#site();
    if (site === undefined) {
      this.#set("unavailable", "no such site");
      return;
    }
    const look = site.look;
    this.#look = clampLook({ azimuth: num(this.getAttribute("heading"), look.azimuth), pitch: num(this.getAttribute("pitch"), look.pitch), fov: num(this.getAttribute("fov"), look.fov) });
    const time = this.getAttribute("time");
    this.#time = time === null || time === "" ? site.time : time === "now" ? Date.now() : Number.isFinite(Number(time)) ? Number(time) : Date.parse(time);
    if (!Number.isFinite(this.#time)) this.#time = site.time;
    this.#sky = moonSky(site.lat, site.lon, this.#time);
    this.setAttribute("aria-label", `${site.name[this.#lang()]}: ${this.#lang() === "ja" ? "月面に立った視点" : "standing on the Moon"}`);
  }

  #lang(): "en" | "ja" {
    return this.getAttribute("lang") === "ja" ? "ja" : "en";
  }

  #set(state: SurfaceState, text = ""): void {
    this.#state = state;
    this.setAttribute("data-state", state);
    if (this.#statusEl !== undefined) {
      this.#statusEl.textContent = state === "live" ? "" : text;
      this.#statusEl.hidden = state === "live" || text === "";
    }
    this.dispatchEvent(new CustomEvent("wakusei-surface-state", { detail: { state } }));
  }

  async #start(): Promise<void> {
    if (!this.isConnected || !this.#visible || this.#state === "unavailable") return;
    const site = this.#site();
    if (site === undefined) return;
    if (this.#terrain === undefined) {
      this.#loading ??= this.#load(site.body, site.id);
      await this.#loading;
    }
    if (this.#terrain === undefined) return;
    if (!this.#placed) {
      // a step or two from the landing point, out of any made crater
      const stand = this.getAttribute("detail") === "off" ? { x: 0, y: 0 } : standingPlace(0, 0);
      this.#at = { east: stand.x, north: stand.y };
      this.#placed = true;
    }
    if (this.#view === undefined) {
      if (this.#renderer === undefined) {
        const taken = takeRenderer(this.#onContext);
        this.#renderer = taken.renderer;
        this.#release = taken.release;
      }
      const item = createSurfaceItem({ levels: this.#terrain.levels, pictures: this.#terrain.pictures, manifest: this.#terrain.manifest, groundY: (east, north) => this.#groundAt(east, north), key: `surface:${site.id}` });
      this.#view = this.#renderer.view(this.#stage, item, { still: null });
    }
    const ok = await this.#view.focus();
    if (ok) {
      this.#set("live");
      this.#noteEl.textContent = this.#noteText();
      this.#changed();
    } else {
      const now = this.#state as SurfaceState;
      if (now !== "unavailable" && now !== "lost") this.#set("unavailable", this.#lang() === "ja" ? "この端末では3Dを描けません" : "This device cannot draw 3D");
    }
  }

  async #load(body: string, site: string): Promise<void> {
    this.#set("loading", this.#lang() === "ja" ? "地形を読み込んでいます" : "Loading the ground");
    this.#abort?.abort();
    this.#abort = new AbortController();
    try {
      const base = this.getAttribute("tiles");
      const folder = base === null || base === "" ? TILES_BASE : base;
      this.#terrain = await loadTerrain(folder, body, site, {
        signal: this.#abort.signal,
        onProgress: (progress) => {
          this.#progress = progress;
          this.#statusEl.textContent = `${this.#lang() === "ja" ? "地形を読み込んでいます" : "Loading the ground"} ${Math.round((100 * progress.done) / progress.total)} %`;
        },
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") this.#set("unavailable", this.#lang() === "ja" ? "この場所の地形がありません" : "No ground for this site yet");
    }
  }

  #noteText(): string {
    const m = this.#terrain?.manifest;
    if (m === undefined) return "";
    const made = this.getAttribute("detail") === "off" ? "" : this.#lang() === "ja" ? "5 m より細かい地形（小さなクレーター、砂塵、岩）は計算で作ったもので、実測ではありません。" : "Detail finer than the 5 m grid (small craters, dust, rocks) is made, not measured.";
    const picture = m.picture === null || m.picture === undefined ? "" : ` ${m.picture.credit}.`;
    return this.#lang() === "ja" ? `高さの実測: ${m.accuracy}。${m.credit}。${made}` : `Heights measured: ${m.accuracy}. ${m.credit}.${picture} ${made}`;
  }

  /** The ground's height at a point over the site's: the measured heights, the made craters on them (if the page has them on) and the Moon's curve taken off. */
  #groundAt(east: number, north: number): number {
    const t = this.#terrain!;
    const h = groundAt(t.levels, t.manifest.height, east, north) ?? t.manifest.ground;
    const made = this.getAttribute("detail") === "off" ? 0 : madeGround(east, north, 0.35).h;
    return h - t.manifest.ground - drop(Math.hypot(east, north), t.manifest.radius) + made;
  }

  /** The eyes' height over the site's origin: the ground under them (the made craters too: the feet follow them) and a person's height. */
  #eyeUp(): number {
    return this.#groundAt(this.#at.east, this.#at.north) + EYE_HEIGHT;
  }

  #changed(): void {
    if (this.#view?.live) this.#gate?.request();
  }

  #draw(): void {
    const scene = this.#view?.scene as SurfaceScene | undefined;
    if (scene === undefined || this.#terrain === undefined) return;
    const site = this.#site();
    if (site === undefined) return;
    this.#sky = moonSky(site.lat, site.lon, this.#time);
    scene.apply({ eye: { east: this.#at.east, north: this.#at.north, up: this.#eyeUp() }, look: this.#look, sky: this.#sky, shadows: this.getAttribute("shadows") !== "off", detail: this.getAttribute("detail") !== "off", exposure: num(this.getAttribute("exposure"), 1.6) });
    this.#view!.invalidate();
    this.#draws += 1;
  }

  // --- hands ---------------------------------------------------------------------------------------------------------------------------------------

  #onPointerDown = (event: PointerEvent): void => {
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.setPointerCapture(event.pointerId);
    this.setAttribute("data-dragging", "");
    this.#pinch = this.#pointers.size === 2 ? this.#spread() : 0;
  };

  #onPointerMove = (event: PointerEvent): void => {
    const was = this.#pointers.get(event.pointerId);
    if (was === undefined) return;
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pointers.size >= 2) {
      const now = this.#spread();
      if (this.#pinch > 0 && now > 0) this.#zoom(this.#pinch / now);
      this.#pinch = now;
      return;
    }
    const box = this.getBoundingClientRect();
    const perPixel = this.#look.fov / Math.max(1, box.height);
    this.#look = clampLook({ ...this.#look, azimuth: this.#look.azimuth - (event.clientX - was.x) * perPixel, pitch: this.#look.pitch + (event.clientY - was.y) * perPixel });
    this.#changed();
  };

  #onPointerUp = (event: PointerEvent): void => {
    this.#pointers.delete(event.pointerId);
    if (this.#pointers.size === 0) this.removeAttribute("data-dragging");
    this.#pinch = 0;
  };

  #spread(): number {
    const [a, b] = [...this.#pointers.values()];
    return a === undefined || b === undefined ? 0 : Math.hypot(a.x - b.x, a.y - b.y);
  }

  #zoom(factor: number): void {
    this.#look = clampLook({ ...this.#look, fov: this.#look.fov * factor });
    this.#changed();
  }

  #onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.#zoom(Math.exp(event.deltaY * 0.0015));
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === "+" || key === "=") return this.#zoom(0.85);
    if (key === "-" || key === "_") return this.#zoom(1 / 0.85);
    if (!["w", "a", "s", "d", "q", "e", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
    event.preventDefault();
    if (!this.#keys.has(key)) {
      this.#keys.add(key);
      this.#walkAt = performance.now();
      this.#walkTick();
    }
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    this.#keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  };

  #onBlur = (): void => {
    this.#keys.clear();
  };

  /** While a key is held: a step every frame at a walking pace (and a turn at a quarter turn a second), at most thirty a second; nothing when no key is held. */
  #walkTick = (): void => {
    clearTimeout(this.#walkTimer);
    if (this.#keys.size === 0) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.#walkAt) / 1000);
    this.#walkAt = now;
    const k = this.#keys;
    const ahead = (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0);
    const aside = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0);
    const turn = (k.has("e") || k.has("ArrowRight") ? 1 : 0) - (k.has("q") || k.has("ArrowLeft") ? 1 : 0);
    if (turn !== 0) this.#look = clampLook({ ...this.#look, azimuth: this.#look.azimuth + turn * 60 * dt });
    if (ahead !== 0 || aside !== 0) this.#at = stepOver(this.#at, this.#look.azimuth, ahead * WALK_SPEED * dt, aside * WALK_SPEED * dt);
    this.#changed();
    this.#walkTimer = setTimeout(this.#walkTick, 33);
  };
}

if (typeof customElements !== "undefined" && customElements.get("wakusei-surface") === undefined) customElements.define("wakusei-surface", WakuseiSurface);
