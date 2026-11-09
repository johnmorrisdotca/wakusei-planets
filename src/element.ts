// <wakusei-body>: a body of the solar system as a web component. `look="line"` is an SVG and needs nothing else. `realistic` and `painted` are drawn with three.js through
// kazoku-ui's shared renderer (one WebGL context for the whole page), and need the body's own entry point loaded (`@johnmorrisdotca/wakusei-planets/jupiter`). It draws only when
// something changes, at most 30 times a second while it moves, and nothing while it is out of sight or the tab is hidden. A reader who prefers reduced motion gets a slower turn; `turn="0"` is the only stop.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { carryControls, type ElementControls } from "@johnmorrisdotca/kazoku-ui/view-controls";
import "./tables/ceres.ts";
import "./tables/dwarfs.ts";
import { loadMoonTheory } from "./tables/lazy.ts";
import { orbitPath, nearMoons, type Pose } from "./ephemeris.ts";
import { BODIES, ringReach, type BodyId, type Look, type MoonId, type HostId } from "./facts.ts";
import { createGate, frameCap, type Gate } from "./gate.ts";
import { lineSvg } from "./line.ts";
import { createLive, defaultTurn, REDUCED_TURN, type LiveFrame, type LiveRequest } from "./live.ts";
import { texturePaths } from "./scene/textures.ts";
export { TEXTURE_BASE, TEXTURE_FAR_BASE } from "./scene/textures.ts";
import { createBodyItem, type BodyScene, type MoonDraw, type SceneState, type ThreeParts } from "./scene/body.ts";
import { delegates, onRegister } from "./scene/store.ts";
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

const num = (value: string | null, fallback: number): number => {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const readLook = (value: string | null): Look => (value === "realistic" || value === "painted" || value === "illustrated" ? value : "line");

const readTime = (value: string | null): number | "now" | undefined => {
  if (value === null || value === "") return undefined;
  if (value === "now") return "now";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
};

const vectorKey = (v: Vec3): string => `${v[0].toFixed(2)},${v[1].toFixed(2)},${v[2].toFixed(2)}`;

function turnPose(pose: Pose, axis: Vec3, degrees: number): void {
  pose.pole = turnVec(pose.pole, axis, degrees);
  pose.meridian = turnVec(pose.meridian, axis, degrees);
  pose.light = turnVec(pose.light, axis, degrees);
}

/** The half-width of a body's picture, in its radii, when it has no scale of its own: the globe takes a little under half the height, so its rings, glow and haze have room round it. */
const ROOM = 2.2;

function extentOf(id: BodyId, options: { scaleTo?: BodyId; spanKm?: number; moons?: boolean; range?: number; tight?: boolean }): number {
  const f = BODIES[id];
  if (options.moons === true && id in BODIES && f.parent === undefined && id !== "sun") {
    const near = nearMoons(id as HostId);
    const far = Math.max(1.8, ringReach(f) * 1.15, ...near.map((m) => m.reach * 1.1));
    return options.range ?? far;
  }
  if (options.spanKm !== undefined) return options.spanKm / f.radiusKm;
  if (options.scaleTo !== undefined) return (BODIES[options.scaleTo].radiusKm * 1.06) / f.radiusKm;
  if (options.tight !== true) return ROOM;
  // tight (a thumbnail): the picture holds the body and its rings, and an irregular body (Deimos, Phobos, Nix, Hydra) whole along its longest axis
  const longest = f.axesKm === undefined ? 1 : Math.max(...f.axesKm) / f.radiusKm;
  return Math.max(1.06, ringReach(f) * 1.04, longest * 1.06);
}

/** Keep the body in the picture: at least a quarter of its width stays inside the edge, however far the view is moved. `pan` is in half-widths of the picture. */
function clampPan(pan: number, extent: number, zoom: number): number {
  const half = extent / Math.max(0.05, zoom);
  const limit = 1 + 0.5 / half;
  return Math.max(-limit, Math.min(limit, pan));
}

/**
 * The zoom range of a body that carries its own controls. The floor is arbitrary: a tenth of Fit leaves room to see the whole body small. A line drawing is vector and has detail at any scale, so it goes to 50.
 * The shaded looks stop at 8: the sharpest painted map is 2048 pixels round the body, sharp to about 1.5 times the size at Fit on a picture of the usual size and softening after that, and 8 times is as far as
 * the shader's own detail (bands, craters, ring edges) carries before the map runs out.
 */
const LINE_LIMITS = { zoomMin: 0.1, zoomMax: 50, tiltMax: 90 } as const;
const SHADED_LIMITS = { zoomMin: 0.1, zoomMax: 8, tiltMax: 90 } as const;

const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 320px); max-width: 100%; aspect-ratio: 1 / 1; position: relative; contain: layout style; }
#stage { position: absolute; inset: 0; }
#stage svg { display: block; width: 100%; height: 100%; }
</style><div id="stage"></div>`;

/**
 * The `<wakusei-body>` custom element: a body of the solar system, drawn in a look.
 *
 * Attributes: `body` (a name, such as `jupiter`), `look` (`line`, `realistic` or `painted`), `size` (pixels across), `time` (`now` or an ISO date: the body as the Earth sees it then; leave it out for a portrait),
 * `tilt`, `pitch`, `phase` and `meridian` (a portrait's pose, degrees), `turn` (a portrait turns this many degrees a second; left out, 12 a second, backwards when the body is, and a date keeps its orientation and adds this turn; `live="off"` stays still unless this is set; `0` stays still; reduced motion keeps a quarter of it), `rate` (simulated seconds for each real second), `moons` (draw the planet's moons on their orbits),
 * `range` (planet radii the moons picture reaches), `scale-to` (draw to scale with another body), `span-km` (draw to scale: the half-width of the picture in kilometres, the same in every picture of a lineup), `live` (`always`, `hover` or `off`: when it takes the page's one WebGL context), `texture-base` (where the surface pictures are) and `lang` (`en` or `ja`).
 *
 * It carries the shared view controls itself: a drag turns the body, two fingers pinch, Ctrl, Command or Alt with the wheel zooms (the plain wheel scrolls the page at Fit), the arrow keys, + and - and 0 work once it is focused.
 * `controls="none"` turns them off, and `live="off"` (a still, a thumbnail) starts without them (`controls` with no value brings them back). `zoom-min` and `zoom-max` set the range (0.1 to 8 for the shaded looks, 0.1 to 50 for the line drawing); a `<kazoku-view-controls for="...">` takes over and reads it.
 * Whatever moves the view, `setView` sends a `wakusei-view` event with its `yaw`, `tilt`, `roll`, `zoom`, `panX` and `panY`.
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
  static observedAttributes = ["body", "look", "size", "time", "tilt", "pitch", "phase", "meridian", "turn", "rate", "moons", "range", "scale-to", "span-km", "fit", "live", "texture-base", "texture-far-base", "lang", "labels"];

  #stage!: HTMLElement;
  #state: WakuseiState = "line";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #viewKey = "";
  #viewSig = "";
  #delegateEl: HTMLElement | undefined;
  #delegateKind = "";
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
  #roll = 0;
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
  #hands: ElementControls | undefined;
  #handsKey = "";
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

  /** The radius of the body's disc on the screen in CSS pixels, at the picture's own size: what `grab-radius` on the shared view controls wants for a drag that keeps the touched point under the pointer. */
  get discRadius(): number {
    return (this.getBoundingClientRect().width / 2) * this.#fill();
  }
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
    this.#unsub = onRegister(() => {
      this.#carry();
      this.#queue();
    });
    this.#applyHover();
    for (const name of ["pointerdown", "wheel", "keydown"]) this.addEventListener(name, this.#measure, true);
    this.#carry();
    this.#queue();
  }

  disconnectedCallback(): void {
    this.#stopTick();
    this.#gate?.cancel();
    this.#io?.disconnect();
    document.removeEventListener("visibilitychange", this.#onHidden);
    this.#unsub?.();
    this.#applyHover(false);
    for (const name of ["pointerdown", "wheel", "keydown"]) this.removeEventListener(name, this.#measure, true);
    this.#hands?.unbind();
    this.#hands = undefined;
    this.#handsKey = "";
    this.#disposeView(true);
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "time" || name === "rate") this.#clockFromAttributes();
    if (name === "live") this.#applyHover();
    if (name === "live" || name === "look" || name === "body") this.#carry();
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

  /** The shared controllers' camera: `yaw` turns the body about its pole, `tilt` tips its top away from you as it grows (a drag up moves the surface up), `roll` turns the picture clockwise about the line of sight, `zoom` scales it, and `panX` and `panY` move it by that many CSS pixels from the middle. */
  setView(view: { yaw?: number; tilt?: number; roll?: number; zoom?: number; panX?: number; panY?: number }): void {
    const half = Math.max(1, this.clientWidth) / 2;
    const [yaw, tilt, roll, zoom, panX, panY] = [view.yaw ?? 0, view.tilt ?? 0, view.roll ?? 0, view.zoom ?? 1, -(view.panX ?? 0) / half, (view.panY ?? 0) / half];
    if (yaw === this.#yaw && tilt === this.#tilt && roll === this.#roll && zoom === this.#zoom && panX === this.#panX && panY === this.#panY) return;
    [this.#yaw, this.#tilt, this.#roll, this.#zoom, this.#panX, this.#panY] = [yaw, tilt, roll, zoom, panX, panY];
    this.dispatchEvent(new CustomEvent("wakusei-view", { detail: { yaw: this.#yaw, tilt: this.#tilt, roll: this.#roll, zoom: this.#zoom, panX: view.panX ?? 0, panY: view.panY ?? 0 } }));
    this.#queue(true);
  }

  /** Take the shared hands, unless the picture is a still (`live="off"`) or another package's drawing (the Earth's line look); the look decides the zoom range, so a new look takes new hands. */
  #carry(): void {
    const on = this.getAttribute("live") !== "off" && !(this.look === "line" && delegates.has(this.body));
    const key = `${on}|${this.look === "line"}`;
    if (this.#handsKey === key) return;
    this.#hands?.unbind();
    this.#handsKey = key;
    this.#hands = carryControls(this, { on, limits: this.look === "line" ? LINE_LIMITS : SHADED_LIMITS, grabRadius: this.discRadius, objectSize: { width: this.discRadius * 2, height: this.discRadius * 2 }, onChange: (view) => this.setView(view) });
    if (this.#zoom !== 1 || this.#yaw !== 0 || this.#tilt !== 0 || this.#panX !== 0 || this.#panY !== 0 || this.#roll !== 0) {
      if (!this.hasAttribute("data-kazoku-bar")) this.setView({});
    }
  }

  /** The disc is a different size on the screen after the picture or the page is resized: a gesture is told before it starts. */
  #measure = (): void => {
    const controller = this.#hands?.controller;
    if (controller === undefined) return;
    const disc = this.discRadius;
    if (disc <= 0) return;
    controller.grabRadius = disc;
    controller.objectSize = { width: disc * 2, height: disc * 2 };
  };

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
        tilt: this.hasAttribute("tilt") ? num(this.getAttribute("tilt"), 0) : undefined,
        pitch: this.hasAttribute("pitch") ? num(this.getAttribute("pitch"), 0) : undefined,
        phase: this.hasAttribute("phase") ? num(this.getAttribute("phase"), 0) : undefined,
        spin: this.hasAttribute("meridian") ? num(this.getAttribute("meridian"), 0) : undefined,
      },
      turn: (this.hasAttribute("turn") ? num(this.getAttribute("turn"), 0) : this.getAttribute("live") === "off" ? 0 : defaultTurn(this.body)) * (this.#reduce ? REDUCED_TURN : 1),
    };
  }

  /** The picture moves on its own: a turn, or time running faster than the clock. */
  get #moving(): boolean {
    const r = this.#request();
    const turning = r.turn !== 0 || ((this.#start !== undefined || r.moons) && r.rate !== 1);
    return this.#reduce ? r.turn !== 0 : turning;
  }

  // --- the state of the scene --------------------------------------------------------------------------------------------------------------------

  #sceneOf(frame: LiveFrame): SceneState {
    const pose: Pose = { pole: frame.pose.pole, meridian: frame.pose.meridian, light: frame.pose.light };
    const tiltBy = this.#pitchDelta - this.#tilt;
    if (this.#yaw !== 0) pose.meridian = turnVec(pose.meridian, pose.pole, this.#yaw);
    if (tiltBy !== 0) turnPose(pose, [1, 0, 0], tiltBy);
    const roll = -this.#roll;
    if (roll !== 0) turnPose(pose, [0, 0, 1], roll);
    const r = this.#request();
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const range = this.hasAttribute("range") ? num(this.getAttribute("range"), 0) : undefined;
    const span = num(this.getAttribute("span-km"), 0);
    const extent = extentOf(this.body, {
      tight: this.getAttribute("fit") === "tight",
      spanKm: span > 0 ? span : undefined,
      scaleTo: scaleTo !== null && scaleTo in BODIES ? scaleTo : undefined,
      moons: r.moons,
      range: range !== undefined && range > 0 ? range : undefined,
    });
    const moons = r.moons ? this.#moonsOf(frame, extent, tiltBy, roll) : undefined;
    return { pose, extent, sky: frame.time !== undefined, zoom: this.#zoom, panX: clampPan(this.#panX, extent, this.#zoom), panY: clampPan(this.#panY, extent, this.#zoom), moons };
  }

  #moonsOf(frame: LiveFrame, extent: number, tilt: number, roll: number): MoonDraw[] {
    const moons: MoonDraw[] = [];
    for (const m of frame.moons) {
      if (m.distance <= extent * 1.05) {
        const orbit = this.#orbits.get(m.id as string);
        const tipped = tilt === 0 ? ([m.x, m.y, m.z] as Vec3) : turnVec([m.x, m.y, m.z], [1, 0, 0], tilt);
        const rotated = roll === 0 ? tipped : turnVec(tipped, [0, 0, 1], roll);
        moons.push({ id: m.id, x: rotated[0], y: rotated[1], z: rotated[2], orbit: orbit === undefined || (tilt === 0 && roll === 0) ? orbit : this.#tiltedOrbit(m.id as string, orbit, tilt, roll) });
      }
    }
    return moons;
  }

  #tilted = new Map<string, { source: Float32Array; tilt: number; roll: number; out: Float32Array }>();
  #tiltedOrbit(id: string, orbit: Float32Array, tilt: number, roll: number): Float32Array {
    const held = this.#tilted.get(id);
    if (held !== undefined && held.source === orbit && held.tilt === tilt && held.roll === roll) return held.out;
    const out = new Float32Array(orbit.length);
    for (let i = 0; i < orbit.length; i += 3) {
      const tipped = turnVec([orbit[i]!, orbit[i + 1]!, orbit[i + 2]!], [1, 0, 0], tilt);
      const v = roll === 0 ? tipped : turnVec(tipped, [0, 0, 1], roll);
      out[i] = v[0];
      out[i + 1] = v[1];
      out[i + 2] = v[2];
    }
    this.#tilted.set(id, { source: orbit, tilt, roll, out });
    return out;
  }

  /** The moons of Jupiter and Saturn follow their theories once those are fetched; until then the fitted orbits answer. */
  #wantTheory(id: BodyId): void {
    const planet = BODIES[id].parent ?? id;
    void loadMoonTheory(planet).then((loaded) => {
      if (!loaded) return;
      this.#live = createLive();
      this.#orbitKey = "";
      this.#queue(true);
    });
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
    const request = this.#request();
    if (request.moons) this.#wantTheory(request.id);
    const frame = this.#live.at(request, performance.now());
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
    this.setAttribute("aria-label", this.#label());
    if (this.hasAttribute("size")) this.style.setProperty("--wakusei-size", `${num(this.getAttribute("size"), 320)}px`);
    const delegate = this.look === "line" ? delegates.get(this.body) : undefined;
    if (delegate !== undefined && (await this.#delegated(delegate))) return;
    if (this.#delegateEl !== undefined) {
      this.#delegateEl.remove();
      this.#delegateEl = undefined;
      this.#delegateKind = "";
    }
    const wants3d = this.look !== "line" && this.#state !== "unavailable";
    if (!wants3d) {
      if (this.#view !== undefined) this.#disposeView(true);
      this.#drawLine();
      if (this.look === "line") this.#set("line");
      return;
    }
    const sig = `${this.body}|${this.look}`;
    if (this.#view !== undefined && this.#viewSig !== sig) {
      if (this.#view.live) this.#wantLive = true;
      this.#disposeView();
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
  }

  #hasPriority(): boolean {
    const mode = this.getAttribute("live") ?? "always";
    return mode === "always" && this.#visible;
  }

  #applyHover(allow = true): void {
    const events = ["pointerenter", "focusin", "pointerdown"];
    for (const name of events) this.removeEventListener(name, this.#hover);
    if (allow && (this.getAttribute("live") ?? "always") === "hover") {
      for (const name of events) this.addEventListener(name, this.#hover);
    }
  }

  #label(): string {
    const f = BODIES[this.body];
    const ja = this.getAttribute("lang") === "ja";
    const looks = { line: ja ? "線画" : "line drawing", realistic: ja ? "表面の地図" : "painted surface", painted: ja ? "表面の地図" : "painted surface", illustrated: ja ? "イラスト" : "illustrated drawing" } as const;
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
      fill: scaleTo !== null || this.hasAttribute("span-km") || this.getAttribute("fit") !== "tight" ? this.#fill() : undefined,
      lang: this.getAttribute("lang") === "ja" ? "ja" : undefined,
      labels: this.getAttribute("labels") === "off" ? false : undefined,
      stroke: stroke || undefined,
      paper: paper || undefined,
      ...(this.#zoom !== 1 ? { zoom: this.#zoom, panX: scene.panX, panY: scene.panY } : {}),
    });
    this.#stage.innerHTML = html;
  }

  #key(state: SceneState): string {
    const moons = (state.moons ?? []).map((m) => `${m.id}:${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(";");
    return `${this.body}|${this.look}|${vectorKey(state.pose.pole)}|${vectorKey(state.pose.meridian)}|${vectorKey(state.pose.light)}|${state.extent.toFixed(2)}|${state.zoom.toFixed(2)}|${state.panX.toFixed(2)},${state.panY.toFixed(2)}|${moons}`;
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
    const item = createBodyItem({
      id: this.body,
      look: this.look === "illustrated" ? "realistic" : "painted",
      key: this.#viewKey,
      state: () => this.#sceneState ?? state,
      ...texturePaths(this),
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

  /** A body whose line look another package draws (the Earth's globe with its countries). It is drawn at the body's size in a scale picture, never larger than the picture. */
  async #delegated(delegate: NonNullable<ReturnType<typeof delegates.get>>): Promise<boolean> {
    if (this.#view !== undefined) {
      this.#disposeView();
    }
    const center = this.hasAttribute("meridian") ? `${num(this.getAttribute("meridian"), 10)},20` : "10,20";
    const size = Math.round(this.clientWidth || 320);
    const fill = this.#fill();
    const key = `line|${center}|${fill}`;
    if (this.#delegateEl !== undefined && this.#delegateKind === key) return true;
    const el = await delegate.line({ center, size });
    if (el === null) return false;
    this.#delegateEl?.remove();
    this.#stage.innerHTML = "";
    el.style.cssText = `display:block;width:${fill * 100}%;height:${fill * 100}%;aspect-ratio:1;position:absolute;left:${(1 - fill) * 50}%;top:${(1 - fill) * 50}%`;
    this.#stage.append(el);
    this.#delegateEl = el;
    this.#delegateKind = key;
    this.#set("line");
    return true;
  }

  /** How much of the picture's width the body's disc takes: 1 alone, less in a scale picture (`scale-to`, `span-km`). */
  #fill(): number {
    const scaleTo = this.getAttribute("scale-to") as BodyId | null;
    const span = num(this.getAttribute("span-km"), 0);
    const half = span > 0 ? span : scaleTo !== null && scaleTo in BODIES ? BODIES[scaleTo].radiusKm * 1.06 : 0;
    return half > 0 ? Math.max(0.01, Math.min(1, BODIES[this.body].radiusKm / half)) : this.getAttribute("fit") === "tight" ? 1 : 1 / ROOM;
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
    this.#disposeView();
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

