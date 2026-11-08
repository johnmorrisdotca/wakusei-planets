// <wakusei-space>: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through kazoku-ui's shared renderer. Optional: the line drawings and
// the single bodies need none of it. It draws only when something changes, at most 30 times a second, and nothing while it is out of sight.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { BODIES } from "../facts.ts";
import { createGate, frameCap, type Gate } from "../gate.ts";
import { createPainter, type WakuseiPainter } from "../scene/painter.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer } from "../scene/shared.ts";
import { texturePaths } from "../scene/textures.ts";
import { AU_IN_EARTH_RADII, EARTH_RADIUS_KM, frameAt, SPACE_PLANETS, type SpacePlanet } from "./frame.ts";
import { placeAround, placeMoon, placeSun, radiusIn, type ScaleMode } from "./scale.ts";
import { createSpaceItem, FIT_DISTANCE, newSpaceModel, SPACE_BODIES, type BodyPlace, type SpaceBody, type SpaceLight, type SpaceModel } from "./scene.ts";

export { setThreeLoader, SPACE_BODIES, type SpaceBody, type SpaceLight };

/**
 * What a page can tell a reader about a body now.
 *
 * @example
 * ```ts no-run
 * import type { BodyInfo } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const info: BodyInfo = { id: "mars", name: "Mars", radiusKm: 3389.5, distanceKm: 225_000_000 };
 * console.log(`${info.name}: ${info.radiusKm} km`);
 * ```
 */
export interface BodyInfo {
  id: SpaceBody;
  /** The name shown beside the body. */
  name: string;
  /** Mean radius, kilometres. */
  radiusKm: number;
  /** Distance from the Earth's centre now, kilometres (0 for the Earth). */
  distanceKm: number;
}

/**
 * What the space view is doing: `loading`, `live`, `unavailable` (no WebGL), `lost` (the GPU took the context; it comes back by itself).
 *
 * @example
 * ```ts no-run
 * import type { SpaceState, WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const stateOf = (space: WakuseiSpace): SpaceState => space.stats.state;
 * console.log(typeof stateOf);
 * ```
 */
export type SpaceState = "loading" | "live" | "unavailable" | "lost";

/**
 * A named distance for `zoomFor`: the Earth, the Moon, the Sun, the inner planets, the whole solar system, or a planet with its nearer moons (`jupiter-moons`).
 *
 * @example
 * ```ts no-run
 * import type { SpacePreset, WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const zoomTo = (space: WakuseiSpace, preset: SpacePreset): number => space.zoomFor(preset);
 * console.log(typeof zoomTo);
 * ```
 */
export type SpacePreset = "earth" | "moon" | "sun" | "inner" | "solar-system" | `${Exclude<SpacePlanet, "mercury" | "venus">}-moons`;

const readLight = (value: string | null): SpaceLight => (value === "lit" ? "lit" : "sun");
const RAD = Math.PI / 180;
const REAL_TIME_TICK_MS = 60_000;

const readCentre = (value: string | null): { lon: number; lat: number } | null => {
  if (!value) return null;
  const [lon, lat] = value.split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon!) > 180 || Math.abs(lat!) > 90) return null;
  return { lon: lon!, lat: lat! };
};
const readTime = (value: string | null): number | "now" => {
  if (value === null || value === "" || value === "now") return "now";
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : "now";
};
const readBody = (value: string): SpaceBody | undefined => {
  const id = value.toLowerCase();
  return (SPACE_BODIES as readonly string[]).includes(id) ? (id as SpaceBody) : undefined;
};

const STYLE = `<style>:host{display:block;aspect-ratio:1/1;position:relative;overflow:hidden}#stage,#labels{position:absolute;inset:0}#labels{pointer-events:none;overflow:hidden}.sp-label{position:absolute;left:0;top:0;margin:0;padding:0;border:0;background:none;font:12px/16px system-ui,-apple-system,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 0 3px #000,0 0 3px #000;will-change:transform;pointer-events:none}.sp-label:focus-visible{outline:2px solid #6cd0ff;outline-offset:2px;border-radius:4px}.sp-label::before{content:"";display:inline-block;width:5px;height:5px;margin:0 5px 1px -2px;border-radius:50%;background:#fff}.sp-label[hidden]{display:none}</style><div id="stage"></div><div id="labels"></div>`;

/**
 * The `<wakusei-space>` custom element: the Earth, the Moon, the Sun and the planets where they are at a date and time, drawn with three.js through the shared renderer. It takes `center`
 * (`"lon,lat"`), `time` (`now` or an ISO date), `speed` (1 is real time, 0 holds, 86400 is a day a second, negative runs backwards), `scale` (`compressed` or `true`), `look` (`realistic` or `painted`),
 * `light` (`sun` or `lit`), `lang` (`en` or `ja`: the names), `labels` and `orbits` (`off` hides them), and `texture-base`, `texture-far-base` and `max-texture`. Positions come from this package's own models. It draws
 * only when something changes, and nothing while it is out of sight.
 *
 * @example
 * ```ts no-run
 * import type { WakuseiSpace } from "@johnmorrisdotca/wakusei-planets/space/element";
 *
 * const space = document.createElement("wakusei-space") as WakuseiSpace;
 * space.setAttribute("time", "2026-11-02T12:00Z");
 * space.setAttribute("speed", "0");
 * document.body.append(space);
 * ```
 */
export class WakuseiSpace extends HTMLElement {
  static observedAttributes = ["center", "time", "speed", "scale", "labels", "orbits", "look", "light", "lang"];

  #model: SpaceModel = newSpaceModel();
  #mode: number | "now" = "now";
  #speed = 1;
  #view: View | undefined;
  #gate: Gate | undefined;
  #taken: { renderer: SharedRenderer<ThreeParts>; release(): void } | undefined;
  #stage: HTMLElement | undefined;
  #labelBox: HTMLElement | undefined;
  #state: SpaceState = "loading";
  #timer: ReturnType<typeof setTimeout> | undefined;
  #last = 0;
  #pool = new Map<SpaceBody, HTMLElement>();
  #places: Record<SpaceBody, BodyPlace | null> | undefined;
  #names: Partial<Record<SpaceBody, string>> = {};
  #hint = "choose to look at it";
  #painter: WakuseiPainter | undefined;

  connectedCallback(): void {
    this.#model.centre = readCentre(this.getAttribute("center")) ?? this.#model.centre;
    this.#mode = readTime(this.getAttribute("time"));
    this.#model.time = this.#mode === "now" ? Date.now() : this.#mode;
    this.#speed = this.#readSpeed();
    this.#model.mode = this.getAttribute("scale") === "true" ? "true" : "compressed";
    this.#model.labels = this.getAttribute("labels") !== "off";
    this.#model.orbits = this.getAttribute("orbits") !== "off";
    this.#model.look = this.getAttribute("look") === "painted" ? "painted" : "realistic";
    this.#model.light = readLight(this.getAttribute("light"));
    this.#model.stepMs = Math.max(1000, Math.abs(this.#speed) * 1000);
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", "The Earth, the Moon, the Sun and the planets in their places for the date shown");

    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = STYLE;
    this.#stage = root.getElementById("stage")!;
    this.#labelBox = root.getElementById("labels")!;
    this.#pool.clear();

    const nav = navigator as Navigator & { deviceMemory?: number };
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency }), () => this.#view?.invalidate());
    this.#stage.addEventListener("webglcontextlost", this.#lost, true);
    this.#stage.addEventListener("webglcontextrestored", this.#restored, true);

    const taken = takeRenderer((state) => {
      if (state === "unavailable") this.#fail("WebGL is not available");
    });
    this.#taken = taken;
    const item = createSpaceItem(this.#model, {
      painter: () => this.#painterNow(),
      cap: () => this.#textureCap(),
      invalidate: () => this.#gate?.request(),
      onLabels: (places) => this.#placeLabels(places),
      onPainterError: (error) => this.dispatchEvent(new CustomEvent("wakusei-bodies-unavailable", { detail: { reason: error instanceof Error ? error.message : String(error) } })),
    });
    this.#view = taken.renderer.view(this.#stage, item, { still: null });
    this.#set("loading");
    void this.#view.focus().then((live) => {
      if (live) {
        this.#set("live");
        this.dispatchEvent(new CustomEvent("wakusei-ready"));
      } else if (this.#state === "loading") this.#set("unavailable");
    });
    this.#last = performance.now();
    this.#schedule();
    this.addEventListener("pointerdown", this.#down);
    this.#labelBox.addEventListener("click", this.#labelClick);
    this.#labelBox.addEventListener("focusin", this.#labelFocus);
  }

  disconnectedCallback(): void {
    this.removeEventListener("pointerdown", this.#down);
    window.removeEventListener("pointerup", this.#up, true);
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#gate?.cancel();
    this.#view?.dispose();
    this.#view = undefined;
    this.#taken?.release();
    this.#taken = undefined;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "center") this.centre = readCentre(value) ?? { lon: 0, lat: 0 };
    else if (name === "time") this.time = readTime(value);
    else if (name === "speed") this.speed = this.#readSpeed();
    else if (name === "scale") this.scale = value === "true" ? "true" : "compressed";
    else if (name === "labels") this.labels = value !== "off";
    else if (name === "orbits") this.orbits = value !== "off";
    else if (name === "look") this.look = value === "painted" ? "painted" : "realistic";
    else if (name === "light") this.light = readLight(value);
    else if (name === "lang") for (const [id, button] of this.#pool) this.#nameLabel(button, id);
  }

  /** The home place the camera starts above, as longitude and latitude in degrees. */
  get centre(): { lon: number; lat: number } {
    return { ...this.#model.centre };
  }
  set centre(value: { lon: number; lat: number }) {
    this.#model.centre = { ...value };
    this.#gate?.request();
  }

  /** The moment shown: milliseconds since the epoch, or "now" to follow the clock. Setting it points the camera at the same place on the ground again. */
  get time(): number {
    return this.#model.time;
  }
  set time(value: number | Date | "now") {
    this.#mode = value instanceof Date ? value.getTime() : value;
    this.#model.time = this.#mode === "now" ? Date.now() : this.#mode;
    this.#model.anchor = null;
    this.#last = performance.now();
    this.#schedule();
    this.#gate?.request();
  }

  /** Seconds of game time per second: 1 is real time, 0 holds still, negative runs backwards. */
  get speed(): number {
    return this.#speed;
  }
  set speed(value: number) {
    this.#speed = Number.isFinite(value) ? value : 1;
    this.#model.stepMs = Math.max(1000, Math.abs(this.#speed) * 1000);
    this.#last = performance.now();
    this.#schedule();
    this.#gate?.request();
  }

  /** `compressed` (the default: every direction real, the distances squeezed) or `true` (real distances and sizes). */
  get scale(): ScaleMode {
    return this.#model.mode;
  }
  set scale(value: ScaleMode) {
    this.#model.mode = value;
    this.#gate?.request();
  }

  get labels(): boolean {
    return this.#model.labels;
  }
  set labels(value: boolean) {
    this.#model.labels = value;
    if (!value) for (const label of this.#pool.values()) label.hidden = true;
    this.#gate?.request();
  }

  get orbits(): boolean {
    return this.#model.orbits;
  }
  set orbits(value: boolean) {
    this.#model.orbits = value;
    this.#gate?.request();
  }

  /** How the bodies are drawn: `realistic` (shaded from the body's real colours and features) or `painted` (public-domain surface maps). */
  get look(): "realistic" | "painted" {
    return this.#model.look === "painted" ? "painted" : "realistic";
  }
  set look(value: "realistic" | "painted") {
    this.#model.look = value;
    this.#gate?.request();
  }

  /** How the Earth is lit: `sun` (true, the default) or `lit` (as if by daylight from the camera's side, so the night side is never a black frame). The Sun, the Moon and the planets keep their true places. */
  get light(): SpaceLight {
    return this.#model.light;
  }
  set light(value: SpaceLight) {
    this.#model.light = value;
    this.#gate?.request();
  }

  /**
   * The shared controls' camera: yaw and tilt turn the view (the Earth's surface moves right for a drag right and up for a drag up), zoom brings the camera in (1 shows the body looked at, less shows the sky round it). Pan is not used. A turn that
   * moves nothing on the screen by half a pixel is kept for the next draw but does not cause one unless `final` is true (the default).
   *
   * @param view - The controls' yaw and tilt in degrees and zoom.
   * @param final - False for the frames of a turn that is still going on (Auto-turn, a drag); true when it has settled.
   */
  setView(view: { yaw: number; tilt: number; zoom: number }, final = true): void {
    const now = this.#model.view;
    if (view.yaw === now.yaw && view.tilt === now.tilt && view.zoom === now.zoom) return;
    this.#model.view = { yaw: view.yaw, tilt: view.tilt, zoom: view.zoom };
    const drawn = this.#model.drawnView;
    if (drawn && !final && view.zoom === drawn.zoom) {
      const turned = Math.max(Math.abs(view.yaw - drawn.yaw), Math.abs(view.tilt - drawn.tilt)) * RAD;
      if (turned * (this.#model.heightPx / 2) < 0.5) return;
    }
    this.#gate?.request();
  }

  /** The body the camera looks at (`earth`, `sun`, `moon`, `mercury` to `neptune`, `pluto`): at zoom 1 it fills the view; the yaw and tilt turn the camera round it. */
  get body(): SpaceBody {
    return this.#model.focus;
  }
  set body(name: SpaceBody) {
    const id = readBody(name);
    if (!id) return;
    this.#model.focus = id;
    this.#gate?.request();
  }

  /** The words shown beside each body, for a page in another language (`{ mars: "火星" }`). A body left out keeps its name in the element's `lang`. */
  get bodyNames(): Partial<Record<SpaceBody, string>> {
    return { ...this.#names };
  }
  set bodyNames(value: Partial<Record<SpaceBody, string>>) {
    this.#names = { ...value };
    for (const [id, button] of this.#pool) this.#nameLabel(button, id);
  }

  /** What a screen reader hears after a body's name: "choose to look at it" by default, or the page's own words. */
  get bodyHint(): string {
    return this.#hint;
  }
  set bodyHint(value: string) {
    this.#hint = value;
    for (const [id, button] of this.#pool) this.#nameLabel(button, id);
  }

  /** The name, radius and distance from the Earth of a body now, for a page's own caption. */
  bodyInfo(id: SpaceBody): BodyInfo {
    const frame = this.#model.drawn?.frame ?? frameAt(this.#model.time);
    const geo = id === "earth" ? ([0, 0, 0] as const) : id === "sun" ? frame.sun : id === "moon" ? frame.moon : frame.planets[id];
    return { id, name: this.#nameOf(id), radiusKm: BODIES[id].radiusKm, distanceKm: Math.hypot(geo[0], geo[1], geo[2]) * AU_IN_EARTH_RADII * EARTH_RADIUS_KM };
  }

  /** The zoom that shows a part of the sky: the Earth alone, the Moon's orbit, the Sun, the planets out to Mars, all of them, or a planet's nearer moons, at this scale and moment. */
  zoomFor(preset: SpacePreset): number {
    const mode = this.#model.mode;
    if (preset.endsWith("-moons")) {
      const id = preset.slice(0, -6) as SpacePlanet;
      const sites = this.#painterNow().moons(id, this.#model.time);
      const reach = Math.max(1, ...sites.map((site) => Math.hypot(...site.offset)).filter((r) => r <= 22));
      const radius = radiusIn(id, mode);
      return Math.min(1, (FIT_DISTANCE * radius) / ((reach * radius * 1.15) / Math.tan(17.5 * RAD)));
    }
    const frame = this.#model.drawn?.frame ?? frameAt(this.#model.time);
    const sun = placeSun(mode, frame.sun);
    const around = (id: SpacePlanet): number => Math.hypot(...placeAround(mode, sun, [frame.planets[id][0] - frame.sun[0], frame.planets[id][1] - frame.sun[1], frame.planets[id][2] - frame.sun[2]]));
    const reach = {
      earth: 0,
      moon: Math.hypot(...placeMoon(mode, frame.moon)),
      sun: Math.hypot(...sun),
      inner: Math.max(around("mercury"), around("venus"), around("mars"), Math.hypot(...sun)),
      "solar-system": Math.max(...SPACE_PLANETS.map(around), Math.hypot(...sun)),
    }[preset as Exclude<SpacePreset, `${string}-moons`>];
    return preset === "earth" ? 1 : FIT_DISTANCE / Math.max(FIT_DISTANCE, reach * 3.4);
  }

  /** What the element is doing, for a page or a test. */
  get stats(): {
    state: SpaceState;
    draws: number;
    contexts: number;
    canvas: { width: number; height: number; pixels: number };
    /** How far the camera is from the body it looks at, in that body's radii. */
    distance: number;
    assets: { entries: number; refs: number };
    time: number;
    /** How many frames the ephemeris has worked out. */
    lookups: number;
    /** The camera as the last draw left it: its place in Earth radii from the Earth's centre, and its field of view in degrees. */
    camera: { position: [number, number, number]; fov: number };
    /** What the painter has made at the last draw: the bodies with a drawing, and the moons shown round a planet that is near. */
    bodies: { look: string; painted: number; moons: number };
  } {
    const stats = this.#taken?.renderer.stats;
    return {
      state: this.#state,
      draws: stats?.draws ?? 0,
      contexts: stats?.contexts ?? 0,
      canvas: stats?.canvas ?? { width: 0, height: 0, pixels: 0 },
      distance: this.#model.drawn?.distance ?? 0,
      assets: { entries: stats?.assets.entries ?? 0, refs: stats?.assets.refs ?? 0 },
      time: this.#model.time,
      lookups: this.#model.lookups,
      camera: { position: [...this.#model.camera.position], fov: this.#model.camera.fov },
      bodies: { look: this.#model.look, painted: this.#model.painted.bodies, moons: this.#model.painted.moons },
    };
  }

  // --- the game clock ----------------------------------------------------------------------------------------------------------------------------
  #readSpeed(): number {
    const raw = this.getAttribute("speed");
    const value = raw === null || raw === "" ? 1 : Number(raw);
    return Number.isFinite(value) ? value : 1;
  }

  /** While time runs, draw as often as it shows: real time once a minute; faster time as often as the fastest turning body in sight moves a pixel (1 to 30 times a second). */
  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    if (!this.isConnected || this.#speed === 0) return;
    const perSecond = Math.min(30, Math.max(1, (this.#model.motion || 0.015) * Math.abs(this.#speed)));
    const wait = this.#speed === 1 ? REAL_TIME_TICK_MS : 1000 / perSecond;
    this.#timer = setTimeout(this.#tick, wait);
  }

  #tick = (): void => {
    const now = performance.now();
    if (this.#speed === 1 && this.#mode === "now") this.#model.time = Date.now();
    else this.#model.time += (now - this.#last) * this.#speed;
    this.#last = now;
    this.#gate?.request();
    this.#schedule();
    this.dispatchEvent(new CustomEvent("wakusei-time", { detail: { time: this.#model.time } }));
  };

  // --- labels --------------------------------------------------------------------------------------------------------------------------------------
  #nameOf(id: SpaceBody): string {
    return this.#names[id] ?? BODIES[id].name[this.getAttribute("lang") === "ja" ? "ja" : "en"];
  }

  #placeLabels(places: Record<SpaceBody, BodyPlace | null>): void {
    this.#places = places;
    const box = this.#labelBox;
    if (!box) return;
    for (const id of SPACE_BODIES) {
      let label = this.#pool.get(id);
      const at = places[id];
      if (!label) {
        if (!at) continue;
        const button = box.ownerDocument.createElement("button");
        button.type = "button";
        button.className = "sp-label";
        button.dataset["body"] = id;
        this.#nameLabel(button, id);
        box.append(button);
        this.#pool.set(id, button);
        label = button;
      }
      if (!at) {
        if (!label.hidden) label.hidden = true;
        continue;
      }
      if (label.hidden) label.hidden = false;
      label.style.transform = `translate(${Math.round(at.x + Math.max(4, Math.min(at.r, 40)))}px,${Math.round(at.y - 8)}px)`;
    }
  }

  #nameLabel(button: HTMLElement, id: SpaceBody): void {
    const text = this.#nameOf(id);
    button.textContent = text;
    button.setAttribute("aria-label", `${text}: ${this.#hint}`);
  }

  // A body is chosen by pressing on it or on its name (and by Tab and Enter on the name); a drag that turns the view is not a choice.
  #downX = 0;
  #downY = 0;
  #down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.#downX = event.clientX;
    this.#downY = event.clientY;
    window.addEventListener("pointerup", this.#up, { capture: true, once: true });
  };
  #up = (event: PointerEvent): void => {
    if (Math.hypot(event.clientX - this.#downX, event.clientY - this.#downY) > 6) return;
    if (!this.#places) return;
    const rect = this.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best: SpaceBody | undefined;
    let bestD = Infinity;
    for (const id of SPACE_BODIES) {
      const at = this.#places[id];
      if (!at) continue;
      const d = Math.hypot(x - at.x, y - at.y);
      if (d <= Math.max(at.r, 14) && d < bestD) {
        best = id;
        bestD = d;
      }
    }
    if (best) this.dispatchEvent(new CustomEvent("wakusei-body-click", { detail: this.bodyInfo(best), bubbles: true, composed: true }));
  };
  #labelClick = (event: Event): void => {
    const id = (event.target as HTMLElement | null)?.dataset?.["body"] as SpaceBody | undefined;
    if (id) this.dispatchEvent(new CustomEvent("wakusei-body-click", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
  };
  #labelFocus = (event: Event): void => {
    const id = (event.target as HTMLElement | null)?.dataset?.["body"] as SpaceBody | undefined;
    if (id) this.dispatchEvent(new CustomEvent("wakusei-body-focus", { detail: this.bodyInfo(id), bubbles: true, composed: true }));
  };

  // --- the rest --------------------------------------------------------------------------------------------------------------------------------------
  #painterNow(): WakuseiPainter {
    return (this.#painter ??= createPainter({ textureBase: texturePaths(this).textureBase(), farBase: texturePaths(this).farBase() }));
  }

  #textureCap(): number {
    const given = Number(this.getAttribute("max-texture"));
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const cap = Number.isFinite(given) && given > 0 ? Math.min(given, 4096) : 2048;
    return memory !== undefined && memory <= 2 ? Math.min(cap, 2048) : cap;
  }

  #lost = (): void => this.#set("lost");
  #restored = (): void => this.#set("live");

  #set(state: SpaceState): void {
    if (this.#state === state) return;
    this.#state = state;
    this.dataset["state"] = state;
    this.dispatchEvent(new CustomEvent("wakusei-state", { detail: { state } }));
  }

  #fail(reason: string): void {
    this.#set("unavailable");
    this.dispatchEvent(new CustomEvent("wakusei-unavailable", { detail: { reason } }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "wakusei-space": WakuseiSpace;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-space")) {
  customElements.define("wakusei-space", WakuseiSpace);
}
