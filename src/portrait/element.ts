// <wakusei-portrait>: a scene of bodies of the solar system, arranged on one picture. The line look is one SVG and needs nothing else; the realistic and painted looks put EVERY body of the scene in ONE
// three.js scene, drawn through kazoku-ui's shared renderer (one WebGL context for the page). It draws only when something changes, at most 30 times a second while it moves, and nothing while
// it is out of sight or the tab is hidden. A reader who prefers reduced motion gets a slower turn; a turn of 0 is the only stop. The same element is the portrait builder's canvas: the page sets `portrait`, `editing`, and asks `pick`.
import type { SharedRenderer, View } from "@johnmorrisdotca/kazoku-ui/renderer";
import { BODIES } from "../facts.ts";
import { createGate, frameCap, type Gate } from "../gate.ts";
import type { ThreeParts } from "../scene/body.ts";
import { setThreeLoader, takeRenderer, type ContextState } from "../scene/shared.ts";
// /portrait has always registered the body element as well.
import "../element.ts";
import { texturePaths } from "../scene/textures.ts";
import { backgroundCss, drawShapes, lineScene, paintBackground, shapesOf, shapesSvg, starfield } from "./overlay.ts";
import { decodeScene, defaultPortrait, encodeScene, fromScreen, hitTest, resolve, toScreen, type Guide, type Placed, type Portrait, type Resolved } from "./model.ts";
import { REDUCED_TURN } from "../live.ts";
import { poseOf } from "./pose.ts";
import { createPortraitItem, type PortraitDraw, type PortraitScene } from "./scene3d.ts";

export { setThreeLoader };

/**
 * What the element is doing: `line` (an SVG), `loading`, `still`, `live`, `lost` or `unavailable` (no WebGL: the line drawing is shown).
 *
 * @example
 * ```ts no-run
 * import type { PortraitState } from "@johnmorrisdotca/wakusei-planets/portrait";
 *
 * const done = (state: PortraitState): boolean => state === "live" || state === "line";
 * console.log(done("still"));
 * ```
 */
export type PortraitState = "line" | "loading" | "still" | "live" | "lost" | "unavailable";

const TEMPLATE = `<style>
:host { display: block; width: var(--wakusei-size, 720px); max-width: 100%; aspect-ratio: var(--wakusei-ratio, 16 / 9); position: relative; overflow: hidden; contain: layout style; touch-action: none; user-select: none; }
#bg, #stage, #over { position: absolute; inset: 0; width: 100%; height: 100%; }
#stage svg { display: block; width: 100%; height: 100%; }
#over { pointer-events: none; overflow: visible; }
</style><div id="bg"></div><div id="stage"></div><svg id="over" aria-hidden="true"></svg>`;

const num = (value: string | null, fallback: number): number => {
  const n = value === null || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * The `<wakusei-portrait>` custom element: a scene of bodies arranged on one picture.
 *
 * Attributes: `scene` (the scene as the portrait builder writes it in its address), `look` (`line`, `realistic` or `painted`: replaces the scene's), `size` (pixels across), `lang` (`en` or `ja`: the names),
 * `live` (`always`, `hover` or `off`: when it takes the page's one WebGL context), `texture-base` and `texture-far-base` (where the surface pictures are).
 *
 * @example
 * ```ts no-run
 * import { WakuseiPortrait } from "@johnmorrisdotca/wakusei-planets/portrait";
 *
 * const view = document.createElement("wakusei-portrait") as WakuseiPortrait;
 * view.setAttribute("scene", "arrange:arc~look:painted~sun_0_0_0.3_0~earth_0_0_0.3_0~moon_0_0_0.3_0");
 * document.body.append(view);
 * ```
 */
export class WakuseiPortrait extends HTMLElement {
  static observedAttributes = ["scene", "look", "size", "lang", "live", "texture-base", "texture-far-base"];

  #root!: ShadowRoot;
  #stage!: HTMLElement;
  #bg!: HTMLElement;
  #over!: SVGElement;
  #portrait: Portrait = defaultPortrait();
  #fromAttributes = true;
  #resolved: Resolved = { placed: [], camera: { x: 0, y: 0, h: 1 } };
  #state: PortraitState = "line";
  #renderer: SharedRenderer<ThreeParts> | undefined;
  #release: (() => void) | undefined;
  #view: View | undefined;
  #viewKey = "";
  #stilled = false;
  #wantLive = false;
  #visible = typeof IntersectionObserver !== "function";
  #io: IntersectionObserver | undefined;
  #tick: ReturnType<typeof setTimeout> | undefined;
  #gate: Gate | undefined;
  #queued = false;
  #startedAt = 0;
  #reduce = false;
  #edit: { selected?: number; guides?: readonly Guide[] } = {};
  #overKey = "";
  #lineKey = "";
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

  /** The scene now. Setting it hands the element a scene of your own, as the builder does; it is drawn at once and at most thirty times a second after. */
  get portrait(): Portrait {
    return this.#portrait;
  }
  set portrait(value: Portrait) {
    this.#portrait = value;
    this.#fromAttributes = false;
    this.#changed();
  }

  /** The chosen body's index and the guides to draw over the picture (the builder's editing). */
  set editing(value: { selected?: number; guides?: readonly Guide[] }) {
    this.#edit = value;
    this.#paintOver();
  }

  get state(): PortraitState {
    return this.#state;
  }

  /** Numbers for a test or a status line. */
  get stats(): { state: PortraitState; bodies: number; renderer: SharedRenderer<ThreeParts>["stats"] | undefined } {
    return { state: this.#state, bodies: this.#resolved.placed.length, renderer: this.#renderer?.stats };
  }

  /** Where everything is on the page now: the picture's size in pixels, pixels to a scene unit, and the bodies (back to front). */
  get metrics(): { width: number; height: number; scale: number; camera: Resolved["camera"]; placed: readonly Placed[] } {
    const { width, height } = this.#size();
    return { width, height, scale: toScreen(this.#resolved.camera, width, height).scale, camera: this.#resolved.camera, placed: this.#resolved.placed };
  }

  /** The body under a point of the page (client coordinates): its index in the list, or -1. `slop` is the smallest radius, in pixels, a body is hit within. */
  pick(clientX: number, clientY: number, slop = 10): number {
    const at = this.worldAt(clientX, clientY);
    const { scale } = toScreen(this.#resolved.camera, this.#size().width, this.#size().height);
    return hitTest(this.#resolved.placed, at.x, at.y, slop / scale);
  }

  /** A point of the page (client coordinates) in the scene's units. */
  worldAt(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.getBoundingClientRect();
    const { width, height } = this.#size();
    return fromScreen(this.#resolved.camera, width, height, ((clientX - box.left) / Math.max(1, box.width)) * width, ((clientY - box.top) / Math.max(1, box.height)) * height);
  }

  connectedCallback(): void {
    this.#root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    this.#root.innerHTML = TEMPLATE;
    this.#stage = this.#root.getElementById("stage")!;
    this.#bg = this.#root.getElementById("bg")!;
    this.#over = this.#root.getElementById("over") as unknown as SVGElement;
    this.#startedAt = performance.now();
    this.#reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!this.hasAttribute("role")) this.setAttribute("role", "img");
    if (!this.hasAttribute("data-state")) this.setAttribute("data-state", this.#state);
    this.#gate = createGate(1000 / frameCap(30, { deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, hardwareConcurrency: navigator.hardwareConcurrency }), () => this.#frame());
    if (typeof IntersectionObserver === "function") {
      this.#io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last === undefined) return;
        this.#visible = last.isIntersecting;
        if (this.#visible) {
          this.#still();
          this.#resume();
          if (this.#portrait.look !== "line" && this.#view?.live !== true && this.#priority()) void this.goLive();
        } else this.#stopTick();
      });
      this.#io.observe(this);
    }
    document.addEventListener("visibilitychange", this.#onHidden);
    this.#applyHover();
    this.#readAttributes();
    this.#queue();
  }

  disconnectedCallback(): void {
    this.#stopTick();
    this.#io?.disconnect();
    document.removeEventListener("visibilitychange", this.#onHidden);
    this.#applyHover(false);
    this.#disposeView(true);
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === "live") this.#applyHover();
    if (name === "scene" || name === "look") this.#readAttributes();
    this.#queue();
  }

  /** Take the page's one WebGL context and draw the scene on it. Resolves true when it is live; a line scene has nothing to take and resolves false. */
  async goLive(): Promise<boolean> {
    if (this.#portrait.look === "line") return false;
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
    if (this.#view === undefined) return;
    this.#view.blur();
    if (this.#portrait.look !== "line" && this.#state !== "unavailable") {
      this.#set("still");
      this.#rekey();
    }
  }

  /** The picture as a PNG: the background, the bodies and the names, at the size it is on the page times `scale` (the canvas of the bodies is at most the page's pixel ratio, 2). */
  async toPng(scale = 1): Promise<Blob> {
    const { width, height } = this.#size();
    const canvas = document.createElement("canvas");
    const ratio = Math.max(1, Math.min(4, scale));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d")!;
    paintBackground(ctx, this.#portrait.bg, canvas.width, canvas.height);
    if (this.#portrait.look === "line") {
      const image = await this.#svgImage(this.#lineDocument(width, height, false), canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
    } else {
      await this.#drawCanvasOnto(ctx, canvas.width, canvas.height);
      drawShapes(ctx, shapesOf(this.#portrait, this.#resolved, width, height, this.#lang()), canvas.width / width);
    }
    return new Promise((resolveBlob, reject) => canvas.toBlob((blob) => (blob === null ? reject(new Error("the picture could not be made")) : resolveBlob(blob)), "image/png"));
  }

  /** The picture as SVG. The line look is all vector. The shaded looks hold the bodies as a picture inside the SVG, with the background, the orbits and the names as vector. */
  async toSvg(): Promise<string> {
    const { width, height } = this.#size();
    if (this.#portrait.look === "line") return this.#lineDocument(width, height, true);
    const href = await this.#glDataUrl();
    return this.#wrapSvg(width, height, `<image x="0" y="0" width="${width}" height="${height}" href="${href}"/>`);
  }

  // --- the scene ----------------------------------------------------------------------------------------------------------------------------------------

  #readAttributes(): void {
    if (!this.#fromAttributes) return;
    const text = this.getAttribute("scene");
    const p = text === null ? defaultPortrait() : decodeScene(text);
    const look = this.getAttribute("look");
    if (look === "line" || look === "realistic" || look === "painted" || look === "illustrated") p.look = look;
    this.#portrait = p;
  }

  #lang(): "en" | "ja" {
    return this.getAttribute("lang") === "ja" ? "ja" : "en";
  }

  #size(): { width: number; height: number } {
    const width = Math.max(1, Math.round(this.clientWidth || num(this.getAttribute("size"), 720)));
    const height = Math.max(1, Math.round(this.clientHeight || width / this.#portrait.aspect));
    return { width, height };
  }

  #date(): number | undefined {
    const ms = this.#portrait.date === undefined ? NaN : Date.parse(this.#portrait.date);
    return Number.isFinite(ms) ? ms : undefined;
  }

  get #turning(): boolean {
    return this.#portrait.items.some((i) => i.turn !== 0);
  }

  #seconds(): number {
    if (!this.#turning) return 0;
    const elapsed = (performance.now() - this.#startedAt) / 1000;
    return this.#reduce ? elapsed * REDUCED_TURN : elapsed;
  }

  #draw(): PortraitDraw {
    const p = this.#portrait;
    return { placed: this.#resolved.placed, camera: this.#resolved.camera, light: p.light, look: p.look === "illustrated" ? "realistic" : "painted", ms: this.#date(), seconds: this.#seconds(), shadows: p.shadows };
  }

  #changed(): void {
    if (!this.isConnected) return;
    if (this.#view?.live === true && !this.#queued) {
      this.#resolved = resolve(this.#portrait);
      this.#style();
      this.#gate?.request();
    } else this.#queue();
  }

  #style(): void {
    const p = this.#portrait;
    this.style.setProperty("--wakusei-ratio", String(p.aspect));
    if (this.hasAttribute("size")) this.style.setProperty("--wakusei-size", `${num(this.getAttribute("size"), 720)}px`);
    this.#bg.style.background = backgroundCss(p.bg);
    this.#paintOver();
  }

  #paintOver(): void {
    if (this.#over === undefined) return;
    const { width, height } = this.#size();
    const shapes = shapesOf(this.#portrait, this.#resolved, width, height, this.#lang(), this.#edit);
    const markup = shapesSvg(shapes);
    const key = `${width}x${height}|${markup}`;
    if (key === this.#overKey) return;
    this.#overKey = key;
    this.#over.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.#over.innerHTML = markup;
  }

  // --- drawing ------------------------------------------------------------------------------------------------------------------------------------------

  #queue(): void {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      if (this.isConnected) void this.#refresh();
    });
  }

  async #refresh(): Promise<void> {
    if (!this.isConnected) return;
    const p = this.#portrait;
    this.#resolved = resolve(p);
    this.#style();
    this.setAttribute("aria-label", this.#label());
    const wants3d = p.look !== "line" && this.#state !== "unavailable" && p.items.length > 0;
    if (!wants3d) {
      if (this.#view !== undefined) this.#disposeView(true);
      this.#drawLine();
      if (p.look === "line" || p.items.length === 0) this.#set("line");
      return;
    }
    if (this.#stage.querySelector("svg") !== null && this.#view === undefined) this.#stage.innerHTML = "";
    this.#lineKey = "";
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

  #label(): string {
    const names = this.#portrait.items.map((i) => BODIES[i.body].name[this.#lang()]);
    return this.#lang() === "ja" ? `惑星の肖像: ${names.join("、")}` : `Portrait: ${names.join(", ")}`;
  }

  #priority(): boolean {
    return (this.getAttribute("live") ?? "always") === "always" && this.#visible;
  }

  #applyHover(allow = true): void {
    const events = ["pointerenter", "focusin", "pointerdown"];
    for (const name of events) this.removeEventListener(name, this.#hover);
    if (allow && (this.getAttribute("live") ?? "always") === "hover") {
      for (const name of events) this.addEventListener(name, this.#hover);
    }
  }

  #poses(): ReturnType<typeof poseOf>[] {
    const seconds = this.#seconds();
    return this.#resolved.placed.map((q) => poseOf(q, this.#date(), seconds, this.#portrait.light));
  }

  #lineBody(width: number, height: number): string {
    return lineScene(this.#portrait, this.#resolved, width, height, this.#poses(), this.#lang());
  }

  #drawLine(): void {
    const { width, height } = this.#size();
    const markup = this.#lineBody(width, height);
    const key = `${width}x${height}|${markup.length}|${this.#portrait.light.az}`;
    if (this.#portrait.look !== "line") {
      if (this.#stage.firstChild !== null && this.#lineKey !== "") this.#stage.innerHTML = "";
      this.#lineKey = "";
      return;
    }
    if (key === this.#lineKey && !this.#turning) return;
    this.#lineKey = key;
    this.#stage.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="presentation">${markup}</svg>`;
  }

  #key(): string {
    const { width } = this.#size();
    return `${encodeScene(this.#portrait)}|${width}`;
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
    const item = createPortraitItem({
      key: this.#viewKey,
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
    const scene = this.#view?.scene as PortraitScene | undefined;
    if (scene === undefined || typeof scene.apply !== "function") return;
    scene.apply(this.#draw());
  }

  // --- moving -------------------------------------------------------------------------------------------------------------------------------------------

  #frame(): void {
    this.#resolved = resolve(this.#portrait);
    this.#paintOver();
    if (this.#portrait.look === "line") {
      this.#drawLine();
      if (this.#turning && this.#visible && document.visibilityState !== "hidden") this.#tick = setTimeout(() => this.#gate?.request(), 100);
      return;
    }
    if (this.#view?.live !== true || !this.#visible || document.visibilityState === "hidden") return;
    this.#sync();
    this.#view.invalidate();
    if (this.#turning) this.#tick = setTimeout(() => this.#gate?.request(), 0);
  }

  #resume(): void {
    this.#stopTick();
    if (this.#turning && this.#visible && document.visibilityState !== "hidden" && (this.#view?.live === true || this.#portrait.look === "line")) this.#gate?.request();
  }

  #stopTick(): void {
    clearTimeout(this.#tick);
    this.#tick = undefined;
    this.#gate?.cancel();
  }

  #set(state: PortraitState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.setAttribute("data-state", state);
    this.dispatchEvent(new CustomEvent("wakusei-state", { detail: { state } }));
    if (state === "unavailable") this.#drawLine();
  }

  // --- exporting ----------------------------------------------------------------------------------------------------------------------------------------

  async #drawCanvasOnto(ctx: CanvasRenderingContext2D, width: number, height: number): Promise<void> {
    await this.#capturePixels((c) => ctx.drawImage(c, 0, 0, width, height));
  }

  async #glDataUrl(): Promise<string> {
    let url = "";
    await this.#capturePixels((c) => {
      url = c.toDataURL("image/png");
    });
    return url;
  }

  async #capturePixels(use: (canvas: HTMLCanvasElement) => void): Promise<void> {
    if (this.#view?.live !== true && !(await this.goLive())) throw new Error("the 3D picture is not available here");
    await new Promise<void>((done, reject) => {
      const view = this.#view;
      const scene = view?.scene as (PortraitScene & { afterDraw?: (fn: () => void) => void }) | undefined;
      const canvas = this.#stage.querySelector("canvas");
      if (view === undefined || scene?.afterDraw === undefined || canvas === null) {
        reject(new Error("the 3D picture is not available here"));
        return;
      }
      const timeout = setTimeout(() => reject(new Error("the picture was not drawn")), 8000);
      scene.afterDraw(() => {
        clearTimeout(timeout);
        try {
          use(canvas);
          done();
        } catch (error) {
          reject(error instanceof Error ? error : new Error("the picture could not be read"));
        }
      });
      this.#sync();
      view.invalidate();
    });
  }

  #svgImage(svg: string, width: number, height: number): Promise<HTMLImageElement> {
    return new Promise((resolveImage, reject) => {
      const image = new Image(width, height);
      image.onload = () => resolveImage(image);
      image.onerror = () => reject(new Error("the SVG could not be drawn"));
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
  }

  #lineDocument(width: number, height: number, withBackground: boolean): string {
    const body = this.#lineBody(width, height);
    return this.#wrapSvg(width, height, body, withBackground);
  }

  #wrapSvg(width: number, height: number, bodies: string, withBackground = true): string {
    const p = this.#portrait;
    const stars = starfield();
    let back = "";
    if (withBackground && p.bg === "black") back = `<rect width="${width}" height="${height}" fill="#000"/>`;
    else if (withBackground && p.bg === "gradient") back = `<defs><radialGradient id="sky" cx="30%" cy="20%" r="110%"><stop offset="0" stop-color="#1c3358"/><stop offset="0.55" stop-color="#0d1a33"/><stop offset="1" stop-color="#050914"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#sky)"/>`;
    else if (withBackground && p.bg === "stars") back = `<defs><radialGradient id="sky" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#07101f"/><stop offset="1" stop-color="#000"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#sky)"/>${stars.map((s) => `<circle cx="${(s.x * width).toFixed(1)}" cy="${(s.y * height).toFixed(1)}" r="${Math.max(0.5, s.r * 1000).toFixed(2)}" fill="#fff" fill-opacity="${s.a.toFixed(2)}"/>`).join("")}`;
    const over = shapesSvg(shapesOf(p, this.#resolved, width, height, this.#lang()));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${this.#label().replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">${back}${bodies}${over}</svg>`;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wakusei-portrait")) customElements.define("wakusei-portrait", WakuseiPortrait);
