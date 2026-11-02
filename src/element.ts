// <wakusei-body>: a body of the solar system as a web component. `look="line"` is an SVG and needs nothing else. `realistic` and `painted` are drawn with three.js through
// kazoku-ui's shared renderer (one WebGL context for the whole page), and need the body's own entry point loaded (`@johnmorrisdotca/wakusei-planets/jupiter`). It draws only when
// something changes, at most 30 times a second while it moves, and nothing while it is out of sight, the tab is hidden or the reader prefers reduced motion.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { orbitPath, nearMoons } from "./ephemeris.ts";
import { BODIES, ringReach, type BodyId, type Look, type MoonId, type PlanetId } from "./facts.ts";
import { createGate, frameCap, type Gate } from "./gate.ts";
import { lineSvg } from "./line.ts";
import { createLive, type LiveFrame, type LiveRequest } from "./live.ts";
import { VERSION } from "./version.ts";
import { createBodyItem, type BodyScene, type MoonDraw, type SceneState, type ThreeParts } from "./scene/body.ts";
import { onRegister } from "./scene/store.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "./scene/shared.ts";
import { turn as turnVec, type Vec3 } from "./vec.ts";

export { setThreeLoader };

/**
 * What the element is doing: `line` (an SVG), `loading` (waiting for three.js or a picture), `still` (a picture of the 3D look, nothing running), `live` (drawing), `lost` (the GPU took the context; it comes back by itself) or `unavailable` (no WebGL: the line drawing is shown).
 *
 * @example
 * ```ts no-run
 * import type { WakuseiState } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * const done = (state: WakuseiState): boolean => state === "live" || state === "line";
 * console.log(done("still"));
 * ```
 */
export type WakuseiState = "line" | "loading" | "still" | "live" | "lost" | "unavailable";

/**
 * The default home of the surface pictures: the files of this exact version on jsDelivr. Set `texture-base` on an element to serve them yourself.
 *
 * @example
 * ```ts no-run
 * import { TEXTURE_BASE } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * console.log(TEXTURE_BASE);
 * ```
 */
export const TEXTURE_BASE = `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets@${VERSION}/dist/textures/`;

const num = (value: string | null, fallback: number): number => {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const readLook = (value: string | null): Look => (value === "realistic" || value === "painted" ? value : "line");

const readTime = (value: string | null): number | "now" | undefined => {
  if (value === null || value === "") return undefined;
  if (value === "now") return "now";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

/** The half-width of the picture, in body radii, for a body alone, with a scale to another body, or with its moons. */
function extentOf(id: BodyId, options: { scaleTo?: BodyId; moons?: boolean; range?: number }): number {
  const f = BODIES[id];
  if (options.moons === true && id in BODIES && f.parent === undefined && id !== "sun") {
    const near = nearMoons(id as PlanetId);
    const far = Math.max(1.8, ringReach(f) * 1.15, ...near.map((m) => m.reach * 1.1));
    return options.range ?? far;
  }
  if (options.scaleTo !== undefined) return (BODIES[options.scaleTo].radiusKm * 1.06) / f.radiusKm;
  return Math.max(id === "sun" ? 1.55 : 1.06, ringReach(f) * 1.04);
}

const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 320px); max-width: 100%; aspect-ratio: 1 / 1; position: relative; contain: layout style; }
#stage { position: absolute; inset: 0; }
#stage svg { display: block; width: 100%; height: 100%; }
</style><div id="stage"></div>`;

/**
 * The `<wakusei-body>` custom element: a body of the solar system, drawn in a look.
 *
 * Attributes: `body` (a name, such as `jupiter`), `look` (`line`, `realistic` or `painted`), `size` (pixels across), `time` (`now` or an ISO date: the body as the Earth sees it then; leave it out for a portrait),
 * `tilt`, `pitch`, `phase` and `meridian` (a portrait's pose, degrees), `turn` (a portrait turns this many degrees a second), `rate` (simulated seconds for each real second), `moons` (draw the planet's moons on their orbits),
 * `range` (planet radii the moons picture reaches), `scale-to` (draw to scale with another body), `live` (`always`, `hover` or `off`: when it takes the page's one WebGL context), `texture-base` (where the surface pictures are) and `lang` (`en` or `ja`).
 *
 * @example
 * ```ts no-run
 * import { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
 * import "@johnmorrisdotca/wakusei-planets/saturn";
 *
 * const saturn = document.createElement("wakusei-body") as WakuseiBody;
 * saturn.setAttribute("body", "saturn");
 * saturn.setAttribute("look", "realistic");
 * document.body.append(saturn);
 * ```
 */
export class WakuseiBody extends HTMLElement {
  static observedAttributes = ["body", "look", "size", "time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "moons", "range", "scale-to", "live", "texture-base", "lang", "labels"];

  #stage!: HTMLElement;
  #state: WakuseiState = "line";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #viewKey = "";
  #viewSig = "";
  #stilled = false;
  #wantLive = false;
  #visible = typeof IntersectionObserver !== "function";
  #io: IntersectionObserver | undefined;
  #tick: ReturnType<typeof setTimeout> | undefined;
  #refreshQueued = false;
  #gate: Gate | undefined;
  #live = createLive();
  #startedAt = 0;
  #start: number | undefined;
  #yaw = 0;
  #tilt = 0;
  #pitchDelta = 0;
  #lastAnchors = -1;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #orbits = new Map<string, Float32Array>();
  #orbitKey = "";
  #textureWidth = 0;
  #sceneState: SceneState | undefined;
  #unsub: (() => void) | undefined;
  #reduce = false;
  #hover = (): void => void this.goLive();
  #onContext = (state: ContextState): void => {
    if (state === "unavailable") this.#set("unavailable");
    else if (state === "lost") this.#set("lost");
    else if (this.#view?.live) this.#set("live");
  };
  #onHidden = (): void => {
    if (document.visibilityState === "hidden") this.#stopTick();
    else this.#resume();
  };

  get body(): BodyId {
    const id = this.getAttribute("body") as BodyId | null;
    return id !== null && id in BODIES ? id : "earth";
  }
  get look(): Look {
    return readLook(this.getAttribute("look"));
  }
  /** What the element is doing now. */
  get state(): WakuseiState {
    return this.#state;
  }
  /** Numbers for a test or a status line: the state, the texture width in use and the renderer's own counts. */
  get stats(): { state: WakuseiState; textureWidth: number; anchors: number; renderer: SharedRenderer<ThreeParts>["stats"] | undefined } {
    return { state: this.#state, textureWidth: this.#textureWidth, anchors: this.#live.anchors, renderer: this.#renderer?.stats };
  }

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = TEMPLATE;
    this.#stage = root.getElementById("stage")!;
    this.#startedAt = performance.now();
    this.#reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.#clockFromAttributes();
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency }), () => this.#frame());
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        this.#visible = last.isIntersecting;
        if (this.#visible) {
          this.#still();
          this.#resume();
          if (this.look !== "line" && this.#view?.live !== true && this.#hasPriority()) void this.goLive();
        }
        else this.#stopTick();
      });
      this.#io.observe(this);
    }
    document.addEventListener("visibilitychange", this.#onHidden);
    this.#unsub = onRegister(() => this.#queue());
    this.#applyHover();
    this.#queue();
  }

  disconnectedCallback(): void {
    this.#stopTick();
    this.#gate?.cancel();
    this.#io?.disconnect();
    document.removeEventListener("visibilitychange", this.#onHidden);
    this.#unsub?.();
    this.removeEventListener("pointerenter", this.#hover);
    this.removeEventListener("focusin", this.#hover);
    this.removeEventListener("pointerdown", this.#hover);
    this.#view?.dispose();
    this.#view = undefined;
    this.#viewKey = "";
    this.#release?.();
    this.#release = undefined;
    this.#renderer = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "time" || name === "rate") this.#clockFromAttributes();
    if (name === "live") this.#applyHover();
    this.#lastAnchors = -1;
    this.#queue();
  }

  /** Put the picture on the page's one WebGL context and draw it, moving if it is asked to. Resolves true when it is live. A `line` look has nothing to take and resolves false. */
  async goLive(): Promise<boolean> {
    if (this.look === "line") return false;
    this.#wantLive = true;
    await this.#ensureView();
    const ok = (await this.#view?.focus()) === true;
    if (ok) {
      this.#set("live");
      this.#sync();
      this.#resume();
    } else if (this.#state !== "unavailable" && this.#state !== "lost") this.#set("still");
    return ok;
  }

  /** Give the WebGL context back: the picture stays as a still. */
  rest(): void {
    this.#wantLive = false;
    this.#stopTick();
    if (this.#view !== undefined) {
      this.#view.blur();
      if (this.look !== "line" && this.#state !== "unavailable") {
        this.#set("still");
        this.#rekey();
      }
    }
  }

  /** The shared controllers' camera: `yaw` turns the body about its pole, `tilt` tips its pole toward or away, `zoom` and the pan move the picture. */
  setView(view: { yaw?: number; tilt?: number; zoom?: number; panX?: number; panY?: number }): void {
    this.#yaw = view.yaw ?? 0;
    this.#tilt = view.tilt ?? 0;
    this.#zoom = view.zoom ?? 1;
    this.#panX = view.panX ?? 0;
    this.#panY = view.panY ?? 0;
    this.#queue(true);
  }

  // --- the clock ------------------------------------------------------------------------------------------------------------------------------------

  #clockFromAttributes(): void {
    const t = readTime(this.getAttribute("time"));
    this.#startedAt = performance.now();
    this.#start = t === "now" ? Date.now() : t;
  }

  #request(): LiveRequest {
    const moons = this.hasAttribute("moons");
    return {
      id: this.body,
      start: this.#start ?? (moons ? Date.now() : undefined),
      startedAt: this.#startedAt,
      rate: Math.max(-1e7, Math.min(1e7, num(this.getAttribute("rate"), 1))),
      moons,
      portrait: {
        ...(this.hasAttribute("tilt") ? { tilt: num(this.getAttribute("tilt"), 0) } : {}),
        ...(this.hasAttribute("pitch") ? { pitch: num(this.getAttribute("pitch"), 0) } : {}),
        ...(this.hasAttribute("phase") ? { phase: num(this.getAttribute("phase"), 0) } : {}),
        ...(this.hasAttribute("meridian") ? { spin: num(this.getAttribute("meridian"), 0) } : {}),
      },
      turn: num(this.getAttribute("turn"), 0),
    };
  }

  /** The picture moves on its own: a turn, or time running faster than the clock. */
  get #moving(): boolean {
    const r = this.#request();
    return !this.#reduce && (r.turn !== 0 || ((this.#start !== undefined || r.moons) && r.rate !== 1));
  }

  // --- the state of the scene --------------------------------------------------------------------------------------------------------------------

  #sceneOf(frame: LiveFrame): SceneState {
    let { pole, meridian, light } = frame.pose;
    const tiltBy = this.#tilt + this.#pitchDelta;
    if (this.#yaw !== 0) meridian = turnVec(meridian, pole, this.#yaw);
    if (tiltBy !== 0) {
      const x: Vec3 = [1, 0, 0];
      pole = turnVec(pole, x, tiltBy);
      meridian = turnVec(meridian, x, tiltBy);
      light = turnVec(light, x, tiltBy);
    }
    const r = this.#request();
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const range = this.hasAttribute("range") ? num(this.getAttribute("range"), 0) : undefined;
    const extent = extentOf(this.body, { ...(scaleTo !== null && scaleTo in BODIES ? { scaleTo } : {}), moons: r.moons, ...(range !== undefined && range > 0 ? { range } : {}) });
    const moons: MoonDraw[] | undefined = r.moons
      ? frame.moons
          .filter((m) => m.distance <= extent * 1.05)
          .map((m) => {
            const orbit = this.#orbits.get(m.id as string);
            const rotated = tiltBy === 0 ? ([m.x, m.y, m.z] as Vec3) : turnVec([m.x, m.y, m.z], [1, 0, 0], tiltBy);
            return { id: m.id, x: rotated[0], y: rotated[1], z: rotated[2], ...(orbit !== undefined ? { orbit: tiltBy === 0 ? orbit : this.#tiltedOrbit(m.id as string, orbit, tiltBy) } : {}) };
          })
      : undefined;
    return { pose: { pole, meridian, light }, extent, zoom: this.#zoom, panX: this.#panX, panY: this.#panY, ...(moons !== undefined ? { moons } : {}) };
  }

  #tilted = new Map<string, { source: Float32Array; tilt: number; out: Float32Array }>();
  #tiltedOrbit(id: string, orbit: Float32Array, tilt: number): Float32Array {
    const held = this.#tilted.get(id);
    if (held !== undefined && held.source === orbit && held.tilt === tilt) return held.out;
    const out = new Float32Array(orbit.length);
    for (let i = 0; i < orbit.length; i += 3) {
      const v = turnVec([orbit[i]!, orbit[i + 1]!, orbit[i + 2]!], [1, 0, 0], tilt);
      out[i] = v[0];
      out[i + 1] = v[1];
      out[i + 2] = v[2];
    }
    this.#tilted.set(id, { source: orbit, tilt, out });
    return out;
  }

  #ensureOrbits(frame: LiveFrame): void {
    const r = this.#request();
    if (!r.moons || frame.time === undefined) return;
    const bucket = `${r.id}:${Math.floor(frame.time / 3_600_000)}`;
    if (bucket === this.#orbitKey) return;
    this.#orbitKey = bucket;
    this.#orbits.clear();
    for (const m of frame.moons) this.#orbits.set(m.id as string, orbitPath(m.id as MoonId, frame.time));
  }

  #frameNow(): LiveFrame {
    const frame = this.#live.at(this.#request(), performance.now());
    if (frame.anchors !== this.#lastAnchors) {
      this.#lastAnchors = frame.anchors;
      const b = (Math.asin(Math.max(-1, Math.min(1, frame.pose.pole[2]))) * 180) / Math.PI;
      this.#pitchDelta = this.hasAttribute("pitch") && frame.time !== undefined ? Math.round((num(this.getAttribute("pitch"), 0) - b) * 10) / 10 : 0;
    }
    this.#ensureOrbits(frame);
    return frame;
  }

  // --- drawing ------------------------------------------------------------------------------------------------------------------------------------

  #queue(now = false): void {
    if (this.#refreshQueued && !now) return;
    this.#refreshQueued = true;
    queueMicrotask(() => {
      this.#refreshQueued = false;
      if (this.isConnected) void this.#refresh();
    });
  }

  async #refresh(): Promise<void> {
    if (!this.isConnected) return;
    const stage = this.#stage;
    this.setAttribute("aria-label", this.#label());
    if (this.hasAttribute("size")) this.style.setProperty("--wakusei-size", `${num(this.getAttribute("size"), 320)}px`);
    const wants3d = this.look !== "line" && this.#state !== "unavailable";
    if (!wants3d) {
      if (this.#view !== undefined) {
        this.#view.dispose();
        this.#view = undefined;
        this.#viewKey = "";
        this.#release?.();
        this.#release = undefined;
        this.#renderer = undefined;
      }
      this.#drawLine();
      if (this.look === "line") this.#set("line");
      return;
    }
    const sig = `${this.body}|${this.look}`;
    if (this.#view !== undefined && this.#viewSig !== sig) {
      if (this.#view.live) this.#wantLive = true;
      this.#view.dispose();
      this.#view = undefined;
      this.#viewKey = "";
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
      if (this.#wantLive || this.#hasPriority()) void this.goLive();
    }
    void stage;
  }

  #hasPriority(): boolean {
    const mode = this.getAttribute("live") ?? "always";
    return mode === "always" && this.#visible;
  }

  #applyHover(): void {
    this.removeEventListener("pointerenter", this.#hover);
    this.removeEventListener("focusin", this.#hover);
    this.removeEventListener("pointerdown", this.#hover);
    if ((this.getAttribute("live") ?? "always") === "hover") {
      this.addEventListener("pointerenter", this.#hover);
      this.addEventListener("focusin", this.#hover);
      this.addEventListener("pointerdown", this.#hover);
    }
  }

  #label(): string {
    const f = BODIES[this.body];
    const ja = this.getAttribute("lang") === "ja";
    const looks = { line: ja ? "線画" : "line drawing", realistic: ja ? "リアルな絵" : "realistic drawing", painted: ja ? "表面の地図" : "painted surface" } as const;
    return ja ? `${f.name.ja}の${looks[this.look]}` : `${f.name.en}, ${looks[this.look]}`;
  }

  #drawLine(): void {
    const r = this.#request();
    const frame = this.#frameNow();
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const stroke = getComputedStyle(this).getPropertyValue("--wakusei-line").trim();
    const paper = getComputedStyle(this).getPropertyValue("--wakusei-paper").trim();
    const scene = this.#sceneOf(frame);
    const size = 480;
    const html = lineSvg(this.body, {
      size,
      pose: scene.pose,
      ...(r.moons ? { moons: true, ...(frame.time !== undefined ? { time: frame.time } : {}), range: scene.extent, moonsAt: (scene.moons ?? []).map((m) => ({ id: m.id as MoonId, x: m.x, y: m.y, z: m.z, distance: Math.hypot(m.x, m.y, m.z) })), orbits: new Map((scene.moons ?? []).filter((m) => m.orbit !== undefined).map((m) => [m.id as string, m.orbit!])) } : {}),
      ...(scaleTo !== null && scaleTo in BODIES ? { fill: BODIES[this.body].radiusKm / (BODIES[scaleTo].radiusKm * 1.06) } : {}),
      ...(this.getAttribute("lang") === "ja" ? { lang: "ja" as const } : {}),
      ...(this.getAttribute("labels") === "off" ? { labels: false } : {}),
      ...(stroke !== "" ? { stroke } : {}),
      ...(paper !== "" ? { paper } : {}),
      ...(this.#zoom !== 1 ? { zoom: this.#zoom, panX: this.#panX, panY: this.#panY } : {}),
    });
    this.#stage.innerHTML = html;
  }

  #key(state: SceneState): string {
    const q = (v: Vec3): string => v.map((n) => n.toFixed(2)).join(",");
    const moons = (state.moons ?? []).map((m) => `${m.id}:${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(";");
    return `${this.body}|${this.look}|${q(state.pose.pole)}|${q(state.pose.meridian)}|${q(state.pose.light)}|${state.extent.toFixed(2)}|${state.zoom.toFixed(2)}|${state.panX.toFixed(2)},${state.panY.toFixed(2)}|${moons}`;
  }

  /** The renderer, the view and its first still. */
  async #ensureView(): Promise<void> {
    if (this.#renderer === undefined) {
      const taken = takeRenderer(this.#onContext);
      this.#renderer = taken.renderer;
      this.#release = taken.release;
    }
    if (this.#view === undefined) this.#makeView();
  }

  #makeView(): void {
    const frame = this.#frameNow();
    const state = this.#sceneOf(frame);
    this.#sceneState = state;
    this.#viewKey = this.#key(state);
    this.#viewSig = `${this.body}|${this.look}`;
    this.#stilled = false;
    this.#stage.innerHTML = "";
    const base = (): string => {
      const own = this.getAttribute("texture-base");
      return own === null || own === "" ? TEXTURE_BASE : own.endsWith("/") ? own : `${own}/`;
    };
    const item = createBodyItem({
      id: this.body,
      look: this.look === "painted" ? "painted" : "realistic",
      key: this.#viewKey,
      state: () => this.#sceneState ?? state,
      textureBase: base,
      wantedWidth: (discPx) => discPx * Math.min(2, window.devicePixelRatio || 1) * 1.6,
      redraw: () => this.#view?.invalidate(),
      report: (note) => {
        this.#textureWidth = note.width;
        if (note.failed === true) this.setAttribute("data-fallback", "shader");
        else this.removeAttribute("data-fallback");
      },
    });
    this.#view = this.#renderer!.view(this.#stage, item);
    this.#set("loading");
    if (this.#visible) this.#still();
  }

  /** Make the view's still, once, when it is in sight. */
  #still(): void {
    if (this.#stilled || this.#view === undefined) return;
    this.#stilled = true;
    void this.#view.showStill().then(() => {
      if (this.#state === "loading") this.#set("still");
    });
  }

  /** Make a new view when what is shown has changed enough that the still would be wrong. */
  #rekey(): void {
    if (this.#renderer === undefined || this.#view === undefined || this.#view.live) return;
    const state = this.#sceneOf(this.#frameNow());
    const key = this.#key(state);
    if (key === this.#viewKey && this.#view.item !== undefined) return;
    this.#view.dispose();
    this.#view = undefined;
    this.#makeView();
  }

  /** Hand the live scene the current state. */
  #sync(): void {
    const scene = this.#view?.scene as BodyScene | undefined;
    if (scene === undefined || typeof scene.apply !== "function") return;
    const state = this.#sceneOf(this.#frameNow());
    this.#sceneState = state;
    scene.apply(state);
    this.#textureWidth = scene.textureWidth;
  }

  // --- moving ---------------------------------------------------------------------------------------------------------------------------------------

  #frame(): void {
    if (this.#view?.live !== true || !this.#visible || document.visibilityState === "hidden") return;
    this.#sync();
    this.#view.invalidate();
    if (this.#moving) this.#tick = setTimeout(() => this.#gate?.request(), 0);
  }

  #resume(): void {
    this.#stopTick();
    if (this.#view?.live === true && this.#visible && this.#moving && document.visibilityState !== "hidden") this.#gate?.request();
    else if (this.look === "line" && this.#visible && this.#moving) this.#lineTick();
  }

  #lineTick(): void {
    this.#stopTick();
    if (!this.#visible || document.visibilityState === "hidden" || !this.#moving || this.look !== "line") return;
    this.#drawLine();
    this.#tick = setTimeout(() => this.#lineTick(), 1000 / 30);
  }

  #stopTick(): void {
    clearTimeout(this.#tick);
    this.#tick = undefined;
    this.#gate?.cancel();
  }

  #set(state: WakuseiState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.setAttribute("data-state", state);
    this.dispatchEvent(new CustomEvent("wakusei-state", { detail: { state } }));
    if (state === "unavailable") this.#drawLine();
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-body")) customElements.define("wakusei-body", WakuseiBody);

