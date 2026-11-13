// <wakusei-surface>: a person standing on the Moon, at a site with measured heights. The ground is drawn from the heights, lit by the Sun where it really is and shadowed by the ground itself, under a
// black sky with the Earth where it really is. It draws through kazoku-ui's shared renderer (one WebGL context for the page), only when something changes (a look, a step, a new time) and at most
// thirty times a second while a key is held, and nothing at rest or out of sight. The heights come from tiles (`tiles`), not from the package: see the surface guide.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { createGate, frameCap, type Gate } from "../gate.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "../scene/shared.ts";
import { TILES_BASE } from "../scene/textures.ts";
import { madeGround, rocksAround, setKeepOut, standingPlace } from "./detail.ts";
import { driveStep, driveView, ROVER, startDrive, toWorld, type DriveState } from "./drive.ts";
import { DustField } from "./dust.ts";
import { calloutsBy, clockText, LANDING, landingAt, type Callout } from "./landing.ts";
import { drop, groundAt, type HeightLevel, type TerrainManifest } from "./height.ts";
import { loadTerrain, type Terrain, type TerrainProgress } from "./load.ts";
import { createSurfaceItem, type SurfaceScene } from "./scene.ts";
import { objectsOf, traverseOf, type SiteObject } from "./objects.ts";
import { moonSky, type MoonSky } from "./sky.ts";
import { siteById } from "./site.ts";
import { clampLook, EYE_HEIGHT, stepOver, viewProjection, WALK_SPEED, type Look } from "./view.ts";

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
#labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.label { position: absolute; left: 0; top: 0; margin: 0; padding: 3px 8px; border: 1px solid rgba(255, 255, 255, 0.45); border-radius: 12px; background: rgba(0, 0, 0, 0.55); color: #e8ecf2; font: 500 11px/1.3 system-ui, sans-serif; white-space: nowrap; pointer-events: auto; cursor: pointer; will-change: transform; touch-action: manipulation; }
.label:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.label[hidden] { display: none; }
.label[aria-pressed="true"] { background: rgba(255, 255, 255, 0.85); color: #10141c; }
#about { position: absolute; left: 8px; right: 8px; top: 8px; margin: 0; padding: 6px 10px; border-radius: 8px; background: rgba(0, 0, 0, 0.62); color: #e8ecf2; font: 400 12px/1.4 system-ui, sans-serif; pointer-events: none; max-width: 32em; }
#about[hidden] { display: none; }
#landing { position: absolute; inset: 8px; margin: 0; color: #e8ecf2; font: 400 12px/1.4 system-ui, sans-serif; text-shadow: 0 1px 2px #000; pointer-events: none; }
#landing[hidden] { display: none; }
#clock { margin: 0 0 4px; font-weight: 600; }
#callouts { margin: 0; padding: 0; list-style: none; }
#callouts li { opacity: 0.75; }
#callouts li:last-child { opacity: 1; font-weight: 600; }
#curve { position: absolute; left: 0; right: 0; bottom: 50px; margin: 0; font-size: 11px; color: #c8ccd4; }
#stick { position: absolute; left: 18px; bottom: 44px; width: 104px; height: 104px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.4); background: rgba(255, 255, 255, 0.08); touch-action: none; }
#stick[hidden] { display: none; }
#knob { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(255, 255, 255, 0.55); pointer-events: none; }
</style><div id="stage"></div><p id="note"></p><p id="status" role="status"></p><div id="labels"></div><div id="landing" hidden><p id="clock"></p><ul id="callouts"></ul><p id="curve"></p></div><p id="about" role="status" hidden></p><div id="stick" part="stick" role="group" aria-label="Walk" hidden><div id="knob"></div></div>`;

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
 * import type { WakuseiSurface } from "@johnmorrisdotca/wakusei-planets/surface/element";
 *
 * const view = document.createElement("wakusei-surface") as WakuseiSurface;
 * view.setAttribute("site", "apollo-17");
 * document.body.append(view);
 * ```
 */
export class WakuseiSurface extends HTMLElement {
  static observedAttributes = ["quality", "shadows", "detail", "exposure", "site", "time", "heading", "pitch", "fov", "tiles", "lang", "body", "standby", "scale", "stick", "objects", "drive", "drive-camera", "watch", "watch-from", "watch-camera"];

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
  /** What has changed in the terrain since the card was last sent it, and the timer that sends it (the tiles come in dozens, the card is sent them at most every 300 ms). */
  #pending = new Set<string>();
  #flush: ReturnType<typeof setTimeout> | undefined;
  #placed = false;
  /** Whether the view is being moved now (a drag, a step, a zoom): drawn at the quality of motion, and once more at the quality of rest when it stops. */
  #moving = false;
  #settle: ReturnType<typeof setTimeout> | undefined;
  /** The quality of rest in `auto`: stepped down when a draw at rest takes too long on this machine. */
  #restQuality: "full" | "medium" | "fast" = "full";
  #drawMs: number | undefined;
  #measured = 0;
  /** The share the ground is drawn at while the view moves (1, or a half where the machine is slow), and the moving draws timed to decide it. */
  #moveScale = 1;
  #movingTimes: number[] = [];
  #movingPending = false;
  #drawScale = 1;
  #scaled = 0;
  /** The walking stick's push, east and north, each -1 to 1, and the finger that holds it. */
  #push = { x: 0, y: 0 };
  /** The things at the site and the buttons that name them, and the one chosen. */
  #objects: readonly SiteObject[] = [];
  #labelEls = new Map<string, HTMLButtonElement>();
  #chosen: string | undefined;
  /** The rover being driven (`drive="on"`), the view of it, the driver's own turn of the view, the path left, the dust thrown, and the places it cannot go. */
  #vehicle: DriveState | undefined;
  #driveCamera: "chase" | "seat" = "chase";
  #camOffset = { azimuth: 0, pitch: 0 };
  #driveEyeUp = 0;
  #trail: number[] = [];
  #dust = new DustField(900, 17);
  #blockers: { x: number; y: number; r: number }[] = [];
  #blockersAt: { east: number; north: number } | undefined;
  /** The descent being watched (`watch="landing"`): the clock in seconds from ignition, whether it runs, how fast, which camera, where the ground camera stands, and how far the callouts have got. */
  #landing: { t: number; playing: boolean; rate: number; camera: "lander" | "ground"; from: { distance: number; bearing: number }; passed: number; second: number } | undefined;
  #landingTimer: ReturnType<typeof setTimeout> | undefined;
  #landingAt = 0;
  #landingEyeUp = 0;
  #stickPointer = -1;
  #pointers = new Map<number, { x: number; y: number }>();
  #pinch = 0;
  #draws = 0;
  #onContext = (state: ContextState): void => {
    if (state === "unavailable") this.#set("unavailable");
    else if (state === "lost") this.#set("lost");
    else if (this.#view?.live) this.#set("live");
  };

  /** Whether the first view of the ground is in (the heights are fetched and the view could draw at once): true while on `standby` too, which is how a page makes ready without taking the renderer. */
  get loaded(): boolean {
    return this.#terrain !== undefined;
  }

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

  /** Numbers for a test or a status line: the draws, the tiles, the renderer's own counts, the mesh, the quality of the last draw and the milliseconds of the last measured one. */
  get stats(): { state: SurfaceState; draws: number; tiles: TerrainProgress | undefined; renderer: SharedRenderer<ThreeParts>["stats"] | undefined; mesh: SurfaceScene["mesh"] | undefined; quality: string; scale: number; scaled: number; landing: { t: number; playing: boolean; camera: string; altitude: number; speed: number } | undefined; vehicle: DriveState | undefined; drawMs: number | undefined; rocks: number } {
    const scene = this.#view?.scene as SurfaceScene | undefined;
    return { state: this.#state, draws: this.#draws, tiles: this.#progress, renderer: this.#renderer?.stats, mesh: scene?.mesh, quality: this.#quality(), scale: this.#drawScale, scaled: this.#scaled, landing: this.landing, vehicle: this.#vehicle === undefined ? undefined : { ...this.#vehicle, spin: [...this.#vehicle.spin] }, drawMs: scene?.drawMs ?? this.#drawMs, rocks: scene?.rocks ?? 0 };
  }

  /** The quality of the next draw: the `quality` attribute, or in `auto` the quality of motion while the view moves and the machine's own quality of rest otherwise. */
  #quality(): "full" | "medium" | "fast" {
    const own = this.getAttribute("quality");
    if (own === "full" || own === "medium" || own === "fast") return own;
    return this.#moving ? "fast" : this.#restQuality;
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
    const stick = this.#root.getElementById("stick")!;
    stick.addEventListener("pointerdown", this.#onStickDown);
    stick.addEventListener("pointermove", this.#onStickMove);
    stick.addEventListener("pointerup", this.#onStickUp);
    stick.addEventListener("pointercancel", this.#onStickUp);
    this.#showStick();
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
    clearTimeout(this.#flush);
    this.#flush = undefined;
    clearTimeout(this.#landingTimer);
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
    if (name === "drive") {
      this.#syncDrive();
      return;
    }
    if (name === "watch" || name === "watch-from" || name === "watch-camera") {
      this.#syncLanding(name !== "watch");
      return;
    }
    if (name === "drive-camera") {
      this.driveCamera = this.getAttribute("drive-camera") === "seat" ? "seat" : "chase";
      return;
    }
    if (name === "stick") {
      this.#showStick();
      return;
    }
    if (name === "standby") {
      if (!this.hasAttribute("standby")) void this.#start();
      return;
    }
    if (name === "site" || name === "body" || name === "tiles" || name === "objects") {
      this.#terrain = undefined;
      this.#loading = undefined;
      this.#pending.clear();
      this.removeAttribute("data-loading");
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
    // on standby the ground is loaded and nothing more: the renderer is another view's until the attribute goes
    if (this.hasAttribute("standby")) return;
    // the things at the site (and the made ground keeping away from them) are known before the place the eyes start from is chosen
    this.#objects = this.getAttribute("objects") === "off" ? [] : objectsOf(site.id);
    setKeepOut(this.#objects);
    if (!this.#placed) {
      // a step or two from the landing point, out of any made crater
      const stand = this.getAttribute("detail") === "off" ? { x: 0, y: 0 } : standingPlace(0, 0);
      this.#at = { east: stand.x, north: stand.y };
      this.#placed = true;
      this.#syncDrive();
      this.#syncLanding();
    }
    if (this.#view === undefined) {
      if (this.#renderer === undefined) {
        const taken = takeRenderer(this.#onContext);
        this.#renderer = taken.renderer;
        this.#release = taken.release;
      }
      this.#makeLabels();
      const item = createSurfaceItem({ objects: this.#objects, traverse: this.#objects.length > 0 ? traverseOf(site.id) : [], levels: this.#terrain.levels, pictures: this.#terrain.pictures, horizons: this.#terrain.horizons, manifest: this.#terrain.manifest, groundY: (east, north) => this.#groundAt(east, north), key: `surface:${site.id}` });
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
          if (this.#state === "loading") this.#statusEl.textContent = `${this.#lang() === "ja" ? "地形を読み込んでいます" : "Loading the ground"} ${Math.round((100 * Math.min(progress.done, progress.first)) / progress.first)} %`;
        },
        onChange: (id) => {
          this.#pending.add(id);
          this.#flush ??= setTimeout(() => this.#sendChanges(), 300);
        },
      });
      // the first view is in and the ground is whole; the rest comes in place, nearest first
      this.setAttribute("data-loading", "more");
      const terrain = this.#terrain;
      terrain.complete.then(
        () => {
          if (this.#terrain === terrain) this.setAttribute("data-loading", "done");
        },
        (error: unknown) => {
          if (this.#terrain === terrain && (error as Error).name !== "AbortError") this.setAttribute("data-loading", "failed");
        },
      );
    } catch (error) {
      if ((error as Error).name !== "AbortError") this.#set("unavailable", this.#lang() === "ja" ? "この場所の地形がありません" : "No ground for this site yet");
    }
  }

  /** Send the card what has changed in the terrain and draw it. */
  #sendChanges(): void {
    this.#flush = undefined;
    const ids = [...this.#pending];
    this.#pending.clear();
    const scene = this.#view?.scene as SurfaceScene | undefined;
    if (scene === undefined || ids.length === 0) return;
    scene.refresh(ids);
    this.#changed();
  }

  #noteText(): string {
    const m = this.#terrain?.manifest;
    if (m === undefined) return "";
    const made = this.getAttribute("detail") === "off" ? "" : this.#lang() === "ja" ? "5 m より細かい地形（小さなクレーター、砂塵、岩）は計算で作ったもので、実測ではありません。" : "Detail finer than the 5 m grid (small craters, dust, rocks) is made, not measured.";
    const things = this.#objects.length === 0 ? "" : this.#lang() === "ja" ? " 地面の物は、公表された座標の位置にこのパッケージが置いたもので、形は簡単な絵です。" : " The things on the ground are placed by this package at published positions, as plain drawings.";
    const picture = m.picture === null || m.picture === undefined ? "" : ` ${m.picture.credit}.`;
    return this.#lang() === "ja" ? `高さの実測: ${m.accuracy}。${m.credit}。${made}${things}` : `Heights measured: ${m.accuracy}. ${m.credit}.${picture} ${made}${things}`;
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
    if (this.#vehicle !== undefined) return this.#driveEyeUp;
    if (this.#landing !== undefined) return this.#landingEyeUp;
    return this.#groundAt(this.#at.east, this.#at.north) + EYE_HEIGHT;
  }

  /** Ask for a draw. A change of the view (`moving`, the default) is drawn at the quality of motion and followed, a moment after the last, by one at the quality of rest. */
  #changed(moving = true): void {
    if (!this.#view?.live) return;
    if (moving) {
      this.#moving = true;
      clearTimeout(this.#settle);
      this.#settle = setTimeout(() => {
        this.#moving = false;
        this.#gate?.request();
      }, 160);
    }
    this.#gate?.request();
  }

  #draw(): void {
    const scene = this.#view?.scene as SurfaceScene | undefined;
    if (scene === undefined || this.#terrain === undefined) return;
    const site = this.#site();
    if (site === undefined) return;
    this.#sky = moonSky(site.lat, site.lon, this.#time);
    // `auto`: a draw at rest is timed now and then, and a machine that takes too long at rest steps down (a card does a draw at full quality in a few milliseconds; a phone may not)
    const auto = this.getAttribute("quality") === null || this.getAttribute("quality") === "auto";
    const was = scene.drawMs;
    if (auto && !this.#moving && was !== undefined && this.#measured > 0) {
      if (was > 120 && this.#restQuality === "full") this.#restQuality = "medium";
      else if (was > 250 && this.#restQuality === "medium") this.#restQuality = "fast";
    }
    // the draws while the view moves are timed too (the first few), and a machine that takes over 24 ms for one is given a half size for them: a quarter of the pixels, stretched
    const scaleAttr = this.getAttribute("scale");
    if (this.#movingPending && was !== undefined) {
      this.#movingPending = false;
      this.#movingTimes.push(was);
      if (this.#movingTimes.length >= 2 && this.#moveScale === 1) {
        const sorted = [...this.#movingTimes].sort((a, b) => a - b);
        if (sorted[Math.floor(sorted.length / 2)]! > 24) this.#moveScale = 0.5;
      }
    }
    const forced = scaleAttr === null || scaleAttr === "auto" ? undefined : Number(scaleAttr);
    const timeMoving = auto && this.#moving && this.#movingTimes.length < 4 && forced === undefined;
    if (timeMoving) this.#movingPending = true;
    this.#drawScale = forced !== undefined && Number.isFinite(forced) ? Math.min(1, Math.max(0.25, forced)) : this.#moving ? this.#moveScale : 1;
    const measure = (auto && !this.#moving && this.#measured < 4) || timeMoving;
    if (measure && !this.#moving) this.#measured += 1;
    if (this.#drawScale < 1) this.#scaled += 1;
    scene.apply({ eye: { east: this.#at.east, north: this.#at.north, up: this.#eyeUp() }, look: this.#look, sky: this.#sky, shadows: this.getAttribute("shadows") !== "off", detail: this.getAttribute("detail") !== "off", exposure: num(this.getAttribute("exposure"), 1.6), quality: this.#quality(), scale: this.#drawScale, objects: this.#objects.length > 0, ...(this.#vehicle === undefined ? {} : { vehicle: this.#vehicle, trail: this.#trail, dust: this.#dust.position }), ...(this.#landing === undefined ? {} : { lander: this.#landerState(), dust: this.#dust.position }), measure: measure || this.getAttribute("measure") !== null });
    this.#view!.invalidate();
    this.#draws += 1;
    this.#placeLabels();
  }

  // --- driving the rover (`drive="on"`) ---------------------------------------------------------------------------------------------------------------

  /** Which view of the rover: `chase` (from behind and above, the default) or `seat` (the commander's). The key C turns from one to the other. */
  get driveCamera(): "chase" | "seat" {
    return this.#driveCamera;
  }
  set driveCamera(value: "chase" | "seat") {
    this.#driveCamera = value === "seat" ? "seat" : "chase";
    this.#syncDriveCamera();
    this.#changed();
  }

  /** The rover being driven, or `undefined` when it is not. */
  get vehicle(): DriveState | undefined {
    return this.#vehicle === undefined ? undefined : { ...this.#vehicle, spin: [...this.#vehicle.spin] };
  }

  /** Start or stop driving as the `drive` attribute says: the rover starts at its published place (where its last traverse ends), looking along its heading from behind; stopping puts the eyes back on the ground there. */
  #syncDrive(): void {
    const on = this.getAttribute("drive") === "on" && this.#terrain !== undefined && this.#placed;
    if (!on) {
      if (this.#vehicle === undefined) return;
      const v = this.#vehicle;
      this.#vehicle = undefined;
      this.#trail = [];
      this.#at = { east: v.east, north: v.north };
      this.#changed();
      return;
    }
    if (this.#vehicle !== undefined) return;
    const rover = this.#objects.find((o) => o.kind === "rover");
    const [east, north, heading] = rover === undefined ? [this.#at.east, this.#at.north, this.#look.azimuth] : [rover.east, rover.north, rover.heading ?? 0];
    this.#driveCamera = this.getAttribute("drive-camera") === "seat" ? "seat" : "chase";
    this.#vehicle = startDrive(east, north, heading, this.#groundAt(east, north));
    this.#trail = [east, north];
    this.#dust = new DustField(900, 17);
    this.#camOffset = { azimuth: 0, pitch: 0 };
    this.#blockersAt = undefined;
    for (const el of this.#labelEls.values()) el.hidden = true;
    this.choose(undefined);
    this.#syncDriveCamera();
    this.#changed();
  }

  /** The eyes where the view of the rover puts them. */
  #syncDriveCamera(): void {
    const v = this.#vehicle;
    if (v === undefined) return;
    const view = driveView(v, this.#driveCamera, this.#camOffset, (e, n) => this.#groundAt(e, n));
    this.#at = { east: view.eye.east, north: view.eye.north };
    this.#driveEyeUp = view.eye.up;
    this.#look = clampLook({ azimuth: view.azimuth, pitch: view.pitch, fov: this.#look.fov });
  }

  /** The big rocks and the things near the rover, as circles it cannot enter (found again when it has gone 8 m from where they were found). */
  #obstacles(): { x: number; y: number; r: number }[] {
    const v = this.#vehicle!;
    if (this.#blockersAt === undefined || Math.hypot(v.east - this.#blockersAt.east, v.north - this.#blockersAt.north) > 8) {
      this.#blockersAt = { east: v.east, north: v.north };
      const list: { x: number; y: number; r: number }[] = [];
      if (this.getAttribute("detail") !== "off") for (const rock of rocksAround(v.east, v.north, 28, 0.0024)) if (rock.size >= 0.6) list.push({ x: rock.x, y: rock.y, r: rock.size * 0.5 + 1.1 });
      const near: Record<string, number> = { lander: 6, flag: 1.6, station: 2.8, instrument: 1.8, rover: 0 };
      for (const o of this.#objects) if (near[o.kind]! > 0) list.push({ x: o.east, y: o.north, r: near[o.kind]! });
      this.#blockers = list;
    }
    return this.#blockers;
  }

  /** Advance the rover by `seconds` (in steps of at most a sixtieth), throwing dust from the wheels that are down and leaving tracks. */
  #advance(seconds: number, input: { throttle: number; steer: number }): void {
    let v = this.#vehicle!;
    const ground = (e: number, n: number): number => this.#groundAt(e, n);
    const blockers = this.#obstacles();
    const blocked = (e: number, n: number): boolean => blockers.some((b) => (e - b.x) ** 2 + (n - b.y) ** 2 < b.r * b.r);
    const steps = Math.max(1, Math.ceil(seconds * 60));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i += 1) {
      v = driveStep(v, input, dt, ground, blocked);
      // each wheel on the ground throws grains up and back: the faster, the more
      if (!v.airborne && Math.abs(v.speed) > 0.6) {
        const h = (v.heading * Math.PI) / 180;
        const [fx, fz] = [Math.sin(h), Math.cos(h)];
        const grains = Math.abs(v.speed) * dt * 26;
        const [rx, rz] = [Math.cos(h), -Math.sin(h)];
        for (const [wx, , wz] of ROVER.wheels) {
          const w = toWorld(v, [wx, 0, wz]);
          for (let k = 0; k < grains + Math.random() * 0.999; k += 1) {
            // thrown up and back from the tyre in a fan: the faster the rover, the wider and farther
            const back = -Math.sign(v.speed) * Math.abs(v.speed) * (0.3 + 0.3 * Math.random());
            const side = (Math.random() - 0.5) * 1.6 * Math.min(1, Math.abs(v.speed));
            this.#dust.emit([w[0], w[1] + 0.05, w[2]], [fx * back + rx * side, 0.5 + 0.18 * Math.abs(v.speed), fz * back + rz * side], 2);
          }
        }
      }
      this.#dust.step(dt, ground);
    }
    this.#vehicle = v;
    // the tracks: a point every 1.2 m
    const last = this.#trail.length >= 2 ? [this.#trail[this.#trail.length - 2]!, this.#trail[this.#trail.length - 1]!] : [Infinity, Infinity];
    if (Math.hypot(v.east - last[0]!, v.north - last[1]!) >= 1.2 && this.#trail.length < 12_000) this.#trail.push(v.east, v.north);
    this.#syncDriveCamera();
  }

  /** While a key or the stick is asked for, and while the rover is still rolling, settling on its springs or throwing dust: a step at most thirty times a second, and nothing once it is at rest. */
  #driveTick(): void {
    const k = this.#keys;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.#walkAt) / 1000);
    this.#walkAt = now;
    const throttle = Math.max(-1, Math.min(1, (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0) + this.#push.y));
    const steer = Math.max(-1, Math.min(1, (k.has("d") || k.has("ArrowRight") ? 1 : 0) - (k.has("a") || k.has("ArrowLeft") ? 1 : 0) + this.#push.x));
    this.#advance(dt, { throttle, steer });
    this.#changed();
    const v = this.#vehicle!;
    const rolling = Math.abs(v.speed) > 0.01 || v.airborne || Math.abs(v.vy) > 0.02 || Math.abs(v.steer) > 0.005 || this.#dust.live > 0;
    if (throttle !== 0 || steer !== 0 || rolling) this.#walkTimer = setTimeout(this.#walkTick, 33);
  }

  /**
   * Drive by a set time, whatever the clock says: advance the rover `seconds` with the throttle and steering given (each -1 to 1) and draw. For a test or a sequence of pictures taken one step at a time; the keys and the
   * stick do the same by the real time between frames.
   *
   * @param seconds - How long to drive.
   * @param input - The throttle and the steering.
   * @returns Whether the element is driving.
   */
  driveFor(seconds: number, input: { throttle: number; steer: number } = { throttle: 0, steer: 0 }): boolean {
    if (this.#vehicle === undefined) return false;
    this.#advance(seconds, input);
    this.#changed();
    return true;
  }

  // --- watching the landing (`watch="landing"`): Apollo 17's powered descent from the lunar module's window or from the ground ---------------------------------------------------------------------

  /** The descent being watched: its clock in seconds from ignition, whether it runs, the camera and what the lunar module is doing at that moment; `undefined` when it is not watched. */
  get landing(): { t: number; playing: boolean; rate: number; camera: "lander" | "ground"; altitude: number; speed: number; descent: number } | undefined {
    const l = this.#landing;
    if (l === undefined) return undefined;
    const pose = landingAt(l.t);
    return { t: l.t, playing: l.playing, rate: l.rate, camera: l.camera, altitude: pose.altitude, speed: pose.speed, descent: pose.descent };
  }

  /** The clock of the descent, in seconds from ignition (0 to 725). Setting it goes there at once, whether it runs or not. */
  get landingTime(): number {
    return this.#landing?.t ?? 0;
  }
  set landingTime(value: number) {
    const l = this.#landing;
    if (l === undefined) return;
    l.t = Math.min(LANDING.duration, Math.max(0, value));
    l.passed = calloutsBy(l.t).length;
    this.#dust = new DustField(900, 17);
    this.#landingAt = performance.now();
    this.#landingFrame(0, true);
  }

  /** How fast the descent runs: 1 is the real time of it (12 minutes 5 seconds); 2, 4 and 8 are quicker. */
  get landingRate(): number {
    return this.#landing?.rate ?? 1;
  }
  set landingRate(value: number) {
    if (this.#landing !== undefined) this.#landing.rate = Math.min(16, Math.max(0.25, value));
  }

  /** Run the descent from where the clock is (from the start again if it had ended). */
  playLanding(): void {
    const l = this.#landing;
    if (l === undefined) return;
    if (l.t >= LANDING.duration) this.landingTime = l.camera === "ground" ? 540 : LANDING.viewStart;
    l.playing = true;
    this.#landingAt = performance.now();
    this.#landingTick();
  }

  /** Hold the descent where it is. */
  pauseLanding(): void {
    if (this.#landing === undefined) return;
    this.#landing.playing = false;
    clearTimeout(this.#landingTimer);
    this.#landingFrame(0, true);
  }

  /** The touchdown point: where the lunar module stands at Apollo 17 (the published place), or the site point where it has none. */
  #touchdown(): { east: number; north: number } {
    const lm = this.#objects.find((o) => o.kind === "lander");
    return lm === undefined ? { east: 0, north: 0 } : { east: lm.east, north: lm.north };
  }

  /** The lunar module as the scene draws it now: its place, its height over the ground under it, its heading and its thrust. */
  #landerState(): { east: number; north: number; altitude: number; heading: number; throttle: number; inside: boolean } {
    const l = this.#landing!;
    const pose = landingAt(l.t);
    const td = this.#touchdown();
    return { east: td.east + pose.east, north: td.north + pose.north, altitude: pose.altitude, heading: pose.heading, throttle: l.t >= LANDING.duration ? 0 : pose.throttle, inside: l.camera === "lander" };
  }

  /** Start or stop watching as the `watch` attribute says; `again` re-reads the camera and the place the ground camera stands at. */
  #syncLanding(again = false): void {
    const on = this.getAttribute("watch") === "landing" && this.#terrain !== undefined && this.#placed;
    if (!on) {
      if (this.#landing === undefined) return;
      this.#landing = undefined;
      clearTimeout(this.#landingTimer);
      this.#root.getElementById("landing")!.hidden = true;
      this.#readAttributes();
      const td = this.#touchdown();
      this.#at = { east: td.east, north: td.north };
      this.#changed();
      return;
    }
    const camera = this.getAttribute("watch-camera") === "ground" ? "ground" : "lander";
    const [distance, bearing] = (this.getAttribute("watch-from") ?? "150 0").split(/[\s,]+/).map(Number);
    const from = { distance: Number.isFinite(distance) ? distance! : 150, bearing: Number.isFinite(bearing) ? bearing! : 0 };
    if (this.#landing !== undefined) {
      if (!again) return;
      if (this.#landing.camera !== camera) this.#look = clampLook({ ...this.#look, fov: camera === "ground" ? 27 : 74 });
      this.#landing.camera = camera;
      this.#landing.from = from;
      this.#camOffset = { azimuth: 0, pitch: 0 };
      this.#landingFrame(0, true);
      return;
    }
    this.#landing = { t: camera === "ground" ? 540 : LANDING.viewStart, playing: true, rate: 1, camera, from, passed: 0, second: -1 };
    this.#landing.passed = calloutsBy(this.#landing.t).length;
    this.#dust = new DustField(900, 17);
    this.#camOffset = { azimuth: 0, pitch: 0 };
    for (const el of this.#labelEls.values()) el.hidden = true;
    this.choose(undefined);
    this.#root.getElementById("landing")!.hidden = false;
    this.#root.getElementById("curve")!.textContent = this.#lang() === "ja" ? "報告された時刻のあいだの高度と速度は、こちらで作った滑らかな曲線です。" : "Altitude and speed between the reported moments are a smooth curve of ours.";
    if (camera === "ground") this.#look = clampLook({ ...this.#look, fov: 27 });
    this.#landingAt = performance.now();
    this.#landingFrame(0, true);
    this.#landingTick();
  }

  /** The frame of the descent at the clock: the eyes of the chosen camera, the sky of that real moment, the dust of the blast, the words on the picture and the event for a page; `seconds` is how far the clock has just moved. */
  #landingFrame(seconds: number, announce: boolean): void {
    const l = this.#landing;
    if (l === undefined) return;
    const pose = landingAt(l.t);
    const td = this.#touchdown();
    const ground = (e: number, n: number): number => this.#groundAt(e, n);
    const [lx, ly] = [td.east + pose.east, td.north + pose.north];
    const lz = ground(lx, ly);
    this.#time = LANDING.ignition + l.t * 1000;
    // the dust of the blast: from the altitude the Commander first saw it (60 to 70 ft), outward along the ground from under the engine, faster the nearer the ground
    if (seconds > 0 && pose.altitude < 21.3 && l.t < LANDING.duration) {
      const strength = Math.sqrt(1 - pose.altitude / 21.3) * pose.throttle;
      const grains = strength * 260 * seconds;
      for (let k = 0; k < grains + Math.random() * 0.999; k += 1) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 1.5 + Math.random() * 2;
        const v = 5 + Math.random() * 20;
        const [e, n] = [lx + Math.sin(a) * r0, ly + Math.cos(a) * r0];
        this.#dust.emit([e, ground(e, n) + 0.15, n], [Math.sin(a) * v, 0.5 + Math.random() * 2.5, Math.cos(a) * v], 3.5);
      }
    }
    if (seconds > 0) this.#dust.step(seconds, ground);
    if (l.camera === "lander") {
      this.#at = { east: lx, north: ly };
      this.#landingEyeUp = lz + pose.altitude + 4;
      this.#look = clampLook({ azimuth: (((pose.heading + this.#camOffset.azimuth) % 360) + 360) % 360, pitch: pose.pitch + this.#camOffset.pitch, fov: this.#look.fov });
    } else {
      const b = (l.from.bearing * Math.PI) / 180;
      const [ox, oy] = [td.east + Math.sin(b) * l.from.distance, td.north + Math.cos(b) * l.from.distance];
      this.#at = { east: ox, north: oy };
      this.#landingEyeUp = ground(ox, oy) + 1.7;
      const horizontal = Math.hypot(lx - ox, ly - oy) || 1;
      const azimuth = ((Math.atan2(lx - ox, ly - oy) * 180) / Math.PI + 360) % 360;
      const pitch = (Math.atan2(lz + pose.altitude + 3.4 - this.#landingEyeUp, horizontal) * 180) / Math.PI;
      this.#look = clampLook({ azimuth: azimuth + this.#camOffset.azimuth, pitch: pitch + this.#camOffset.pitch, fov: this.#look.fov });
    }
    // the words: the clock and what the lunar module is doing, and the reported moments as they pass
    const clock = clockText(l.t);
    const ja = this.#lang() === "ja";
    const metres = (v: number): string => Math.round(v).toLocaleString(ja ? "ja-JP" : "en-US");
    this.#root.getElementById("clock")!.textContent = `${clock.t}  ·  ${clock.get} ${ja ? "ミッション経過時間" : "ground elapsed"}  ·  ${ja ? "高度" : "altitude"} ${metres(pose.altitude)} m  ·  ${ja ? "対地速度" : "speed"} ${metres(pose.speed)} m/s`;
    const passed = calloutsBy(l.t);
    const list = this.#root.getElementById("callouts")!;
    if (announce || passed.length !== l.passed) {
      const show = passed.slice(-3);
      list.replaceChildren(
        ...show.map((c: Callout) => {
          const li = document.createElement("li");
          li.textContent = `${clockText(c.t).t}  ${ja ? c.ja : c.en}${c.reported ? "" : ja ? "（時刻はこちらの曲線による）" : " (the time is from our curve)"}`;
          return li;
        }),
      );
    }
    const newest = passed.length > l.passed ? passed[passed.length - 1] : undefined;
    l.passed = passed.length;
    const second = Math.floor(l.t);
    if (announce || newest !== undefined || second !== l.second) {
      l.second = second;
      this.dispatchEvent(new CustomEvent("wakusei-landing-clock", { detail: { t: l.t, clock, altitude: pose.altitude, speed: pose.speed, descent: pose.descent, playing: l.playing, callout: newest === undefined ? undefined : { id: newest.id, t: newest.t, en: newest.en, ja: newest.ja, reported: newest.reported } }, bubbles: true, composed: true }));
    }
    this.#changed(l.playing);
  }

  /** While the descent runs: the clock moves by the real time between frames (times the rate), at most thirty times a second; at the touchdown, or paused, nothing is drawn. */
  #landingTick = (): void => {
    clearTimeout(this.#landingTimer);
    const l = this.#landing;
    if (l === undefined || !l.playing) return;
    const now = performance.now();
    const dt = Math.min(0.25, (now - this.#landingAt) / 1000);
    this.#landingAt = now;
    const seconds = Math.min(dt * l.rate, LANDING.duration - l.t);
    l.t += seconds;
    if (l.t >= LANDING.duration - 1e-6) {
      l.t = LANDING.duration;
      l.playing = false;
    }
    this.#landingFrame(seconds, false);
    if (l.playing) this.#landingTimer = setTimeout(this.#landingTick, 33);
    else this.#changed(true);
  };

  // --- the things at the site: a small button on each, which goes to it and says what it is ----------------------------------------------------------------------------------------------------

  /** The things at the site, at their published places (none where the site has none or `objects="off"`). */
  get objects(): readonly SiteObject[] {
    return this.#objects;
  }

  /** The words on a thing's button and in the line that says what it is. */
  #objectWords(o: SiteObject): { short: string; about: string } {
    const ja = this.#lang() === "ja";
    const short: Record<SiteObject["kind"], [string, string]> = { lander: ["Lunar module", "月着陸船"], rover: ["Rover", "月面車"], flag: ["Flag", "旗"], station: ["ALSEP", "ALSEP"], instrument: ["Transmitter", "送信機"] };
    const placed = ja
      ? "このパッケージが、公表された座標（Haase ほか 2019）の位置に置きました。形はこちらで描いた簡単なもので、スキャンではありません。"
      : "Placed by this package at its published position (Haase et al. 2019). The shape is a plain one drawn here, not a scan.";
    const rover = ja ? "月面車は、最後の走行の記録の終点に置いています。向きと形はこちらで決めたものです。" : "The rover stands where the record of its last traverse ends; its heading and shape are ours.";
    return { short: short[o.kind][ja ? 1 : 0], about: `${o.name[ja ? "ja" : "en"]}. ${o.kind === "rover" ? rover : placed}` };
  }

  #makeLabels(): void {
    const box = this.#root.getElementById("labels")!;
    box.replaceChildren();
    this.#labelEls.clear();
    for (const o of this.#objects) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "label";
      button.hidden = true;
      button.setAttribute("aria-pressed", "false");
      button.textContent = this.#objectWords(o).short;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.choose(o.id);
      });
      // a press on the button is not a drag of the view
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      box.append(button);
      this.#labelEls.set(o.id, button);
    }
  }

  /** Put each button on its thing in the picture, or hide it behind the viewer, off the picture or too far to tell. Done at each draw: nothing moves by itself. */
  #placeLabels(): void {
    if (this.#labelEls.size === 0 || this.#vehicle !== undefined || this.#landing !== undefined) return;
    const box = this.getBoundingClientRect();
    const [w, h] = [box.width, box.height];
    const vp = viewProjection([this.#at.east, this.#eyeUp(), -this.#at.north], this.#look, w / Math.max(1, h));
    for (const o of this.#objects) {
      const el = this.#labelEls.get(o.id)!;
      const up = this.#groundAt(o.east, o.north) + (o.kind === "lander" ? 3.4 : o.kind === "flag" ? 2.6 : o.kind === "rover" ? 2.0 : 0.9);
      const [x, y, z] = [o.east, up, -o.north];
      const cw = vp[3]! * x + vp[7]! * y + vp[11]! * z + vp[15]!;
      const nx = (vp[0]! * x + vp[4]! * y + vp[8]! * z + vp[12]!) / cw;
      const ny = (vp[1]! * x + vp[5]! * y + vp[9]! * z + vp[13]!) / cw;
      const distance = Math.hypot(o.east - this.#at.east, o.north - this.#at.north);
      const shown = cw > 0 && Math.abs(nx) < 1 && Math.abs(ny) < 1 && distance < 400 && distance > 1.5;
      el.hidden = !shown;
      if (shown) el.style.transform = `translate(${((nx + 1) / 2) * w - el.offsetWidth / 2}px, ${((1 - ny) / 2) * h - el.offsetHeight - 4}px)`;
    }
  }

  /**
   * Choose a thing at the site: the eyes go to a few metres from it, looking at it, its button is pressed and a line says what it is and that it was placed by this package. `wakusei-surface-object` is sent
   * with its id. Choosing the same one again, or `undefined`, puts the line away.
   *
   * @param id - A thing's id (`lm`, `rover`, `flag`, `alsep`, `sep`), or `undefined` for none.
   * @returns Whether there is such a thing here.
   */
  choose(id: string | undefined): boolean {
    if (this.#vehicle !== undefined || this.#landing !== undefined) return false; // the rover is being driven or the landing watched: the eyes are not ours to move
    const about = this.#root.getElementById("about")!;
    const o = id === undefined ? undefined : this.#objects.find((x) => x.id === id);
    if (id !== undefined && o === undefined) return false;
    if (o === undefined || this.#chosen === id) {
      this.#chosen = undefined;
      about.hidden = true;
      for (const el of this.#labelEls.values()) el.setAttribute("aria-pressed", "false");
      this.#changed(false);
      return true;
    }
    this.#chosen = id;
    for (const [key, el] of this.#labelEls) el.setAttribute("aria-pressed", String(key === id));
    about.textContent = this.#objectWords(o).about;
    about.hidden = false;
    // stand a few metres off, on the side the eyes are on, and look at it
    const near: Record<SiteObject["kind"], number> = { lander: 14, rover: 7, flag: 5, station: 8, instrument: 6 };
    const [dx, dy] = [this.#at.east - o.east, this.#at.north - o.north];
    const length = Math.hypot(dx, dy) || 1;
    const stand = near[o.kind];
    const [east, north] = length < 1 ? [o.east - stand, o.north] : [o.east + (dx / length) * stand, o.north + (dy / length) * stand];
    this.#at = { east, north };
    const azimuth = ((Math.atan2(o.east - east, o.north - north) * 180) / Math.PI + 360) % 360;
    this.#look = clampLook({ azimuth, pitch: o.kind === "lander" ? 8 : 5, fov: this.#look.fov });
    this.dispatchEvent(new CustomEvent("wakusei-surface-object", { detail: { id: o.id, name: o.name }, bubbles: true, composed: true }));
    this.#changed();
    return true;
  }

  // --- the walking stick: for a touch screen, where there are no keys. One finger on the view looks, two fingers pinch to zoom, and the finger on the stick walks ----------------------------------------

  /** Whether the stick is shown: `stick="on"` or `off`, and left out it is shown where the main pointer is a finger (`pointer: coarse`). */
  #showStick(): void {
    const own = this.getAttribute("stick");
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const on = own === "on" || (own !== "off" && coarse);
    const stick = this.#root?.getElementById("stick");
    if (stick !== null && stick !== undefined) stick.hidden = !on;
  }

  #onStickDown = (event: PointerEvent): void => {
    event.stopPropagation(); // the view's own hands (look, pinch) never hear the finger that walks
    if (this.#stickPointer !== -1) return;
    this.#stickPointer = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.#onStickMove(event);
  };

  #onStickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#stickPointer) return;
    event.stopPropagation();
    const stick = event.currentTarget as HTMLElement;
    const box = stick.getBoundingClientRect();
    const reach = box.width / 2;
    let x = (event.clientX - (box.left + reach)) / reach;
    let y = (event.clientY - (box.top + reach)) / reach;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    // a small dead centre: a finger resting on the stick does not creep
    this.#push = length < 0.12 ? { x: 0, y: 0 } : { x, y: -y };
    const knob = this.#root.getElementById("knob") as HTMLElement;
    knob.style.transform = `translate(${x * reach * 0.6}px, ${y * reach * 0.6}px)`;
    if (this.#push.x !== 0 || this.#push.y !== 0) {
      this.#walkAt = performance.now();
      this.#walkTick();
    }
  };

  #onStickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.#stickPointer) return;
    event.stopPropagation();
    this.#stickPointer = -1;
    this.#push = { x: 0, y: 0 };
    (this.#root.getElementById("knob") as HTMLElement).style.transform = "";
  };

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
    if (this.#vehicle !== undefined) {
      this.#camOffset = { azimuth: this.#camOffset.azimuth - (event.clientX - was.x) * perPixel, pitch: Math.max(-60, Math.min(60, this.#camOffset.pitch + (event.clientY - was.y) * perPixel)) };
      this.#syncDriveCamera();
      this.#changed();
      return;
    }
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
    if (key === "c" && this.#vehicle !== undefined) {
      this.driveCamera = this.#driveCamera === "chase" ? "seat" : "chase";
      return;
    }
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
    if (this.#vehicle !== undefined) return this.#driveTick();
    if (this.#keys.size === 0 && this.#push.x === 0 && this.#push.y === 0) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.#walkAt) / 1000);
    this.#walkAt = now;
    const k = this.#keys;
    const ahead = (k.has("w") || k.has("ArrowUp") ? 1 : 0) - (k.has("s") || k.has("ArrowDown") ? 1 : 0) + this.#push.y;
    const aside = (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + this.#push.x;
    const turn = (k.has("e") || k.has("ArrowRight") ? 1 : 0) - (k.has("q") || k.has("ArrowLeft") ? 1 : 0);
    if (turn !== 0) this.#look = clampLook({ ...this.#look, azimuth: this.#look.azimuth + turn * 60 * dt });
    const speed = Math.min(1, Math.hypot(ahead, aside)) / Math.max(1e-9, Math.hypot(ahead, aside));
    if (ahead !== 0 || aside !== 0) this.#at = stepOver(this.#at, this.#look.azimuth, ahead * speed * WALK_SPEED * dt, aside * speed * WALK_SPEED * dt);
    this.#changed();
    this.#walkTimer = setTimeout(this.#walkTick, 33);
  };
}

if (typeof customElements !== "undefined" && customElements.get("wakusei-surface") === undefined) customElements.define("wakusei-surface", WakuseiSurface);
