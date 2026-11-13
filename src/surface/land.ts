// The descent: from `<wakusei-space>`'s view of the Moon to standing at a site, in one move. `import "@johnmorrisdotca/wakusei-planets/surface/land"` for its effect adds `land(site)`, `leave()` and `landed` to
// `<wakusei-space>` (the way `earth-places` adds its places): a page that never imports it carries none of the standing view, and the space element is unchanged. Only what the space element already offers is
// used: `goTo`, `goToPlace` (the package's own places are given to the views if the page has not given any), `stats` and its shadow root. The standing view is made and its ground loaded on standby while the camera comes in; the page has one renderer and one view has it at a time, so the orbit view goes dark (the black of the lunar sky) as the standing view takes the renderer, and fades up into the ground.
import type { WakuseiSpace } from "../space/element.ts";
import { siteById, type SurfaceSite } from "./site.ts";

/**
 * What `land` and `leave` can be told.
 *
 * @example
 * ```ts
 * import type { LandOptions } from "@johnmorrisdotca/wakusei-planets/surface/land";
 *
 * const options: LandOptions = { tiles: "https://johnmorrisdotca.github.io/wakusei-planets/tiles/", time: "1972-12-11T19:54Z" };
 * console.log(Object.keys(options).join(", "));
 * ```
 */
export interface LandOptions {
  /** Where the height tiles are served from (the standing view's `tiles` attribute); its own default when left out. */
  tiles?: string;
  /** The moment on the ground: an ISO date and time, milliseconds since 1970, or `"landing"` for the site's own moment (the landing itself). Left out, it is the orbit view's own moment at the time of the call, so the ground's Sun and Earth are the ones the view above it shows; the standing view then keeps that moment (it runs no clock of its own). */
  time?: number | string;
  /** Where to look first: the site's own look when left out. */
  look?: { heading?: number; pitch?: number; fov?: number };
  /** `"landing"` to watch Apollo 17's powered descent once down (the real moment: its Sun and Earth, the clock from T+4:00 or T+9:00): see `watch` of the standing view. */
  watch?: "landing";
  /** Which camera watches: `lander` (the commander's window, the default) or `ground` (an observer standing off the touchdown point). */
  watchCamera?: "lander" | "ground";
  /** Where the ground camera stands, as `"150 0"`: metres from the touchdown point and the bearing in degrees clockwise from north (150 m north by default). */
  watchFrom?: string;
  /** False to cut straight to the ground with no turn, no zoom and no fade (reduced motion does the same). */
  smooth?: boolean;
  /** Milliseconds to wait for the standing view to be live before giving up (20,000 by default). */
  timeout?: number;
}

/** What is happening between the orbit view and the ground, for `landed` and the events. */
interface Landing {
  site: SurfaceSite;
  /** The standing view while it is made, and after. */
  surface: HTMLElement;
  /** The black that the one view goes into and the other comes out of. */
  veil: HTMLElement;
  /** True once it is fully faded in: the person is standing. */
  down: boolean;
  /** Cancelled by `leave`. */
  cancelled: boolean;
  /** Lets a waiting `land` go when it is cancelled. */
  wake?: () => void;
}

const landings = new WeakMap<WakuseiSpace, Landing>();
const FADE_MS = 700;
const GLIDE_MS = 950;

const reduced = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const frame = (): Promise<void> => new Promise((resolve) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => resolve()) : setTimeout(resolve, 16)));
const sleep = (ms: number, landing: Landing): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    landing.wake = () => {
      clearTimeout(timer);
      resolve();
    };
  });

/** Wait while a test is true, a frame at a time, until it is false, the landing is cancelled or the time is up. */
async function waitWhile(landing: Landing, still: () => boolean, ms: number): Promise<boolean> {
  const end = performance.now() + ms;
  while (still() && !landing.cancelled) {
    if (performance.now() > end) return false;
    await frame();
  }
  return !landing.cancelled;
}

const note = (space: WakuseiSpace, type: string, site: SurfaceSite): void => {
  space.dispatchEvent(new CustomEvent(type, { detail: { site: site.id, name: site.name }, bubbles: true, composed: true }));
};

/**
 * The site the person is standing at over this orbit view, or `null` while in orbit (and while still coming down).
 *
 * @param space - The orbit view.
 * @returns The site's name, as in `SURFACE_SITES`; `null` while in orbit or still coming down.
 *
 * @example
 * ```ts
 * import { landedAt } from "@johnmorrisdotca/wakusei-planets/surface/land";
 *
 * console.log(landedAt({} as never));
 * ```
 */
export function landedAt(space: WakuseiSpace): string | null {
  const landing = landings.get(space);
  return landing?.down === true ? landing.site.id : null;
}

/**
 * The standing view put over the orbit view, while coming down or standing, or `null`: for a page that sets its attributes (the Sun's moment, where to look) or listens to it.
 *
 * @param space - The orbit view.
 * @returns The `<wakusei-surface>` element; `null` when no landing is under way or done.
 *
 * @example
 * ```ts
 * import { surfaceOf } from "@johnmorrisdotca/wakusei-planets/surface/land";
 *
 * console.log(surfaceOf({} as never));
 * ```
 */
export function surfaceOf(space: WakuseiSpace): HTMLElement | null {
  return landings.get(space)?.surface ?? null;
}

/**
 * Come down to a site from the orbit view in one move: the camera goes to the Moon if it is not there, turns over the site and comes in to the Moon's closest zoom, the standing view is made and its ground
 * loaded meanwhile, and it fades in over the picture. `wakusei-landing` is sent when it starts and `wakusei-landed` (with the site) when the person is standing. Resolves the standing view; rejects when there is
 * no such site, the view cannot be drawn, the ground does not come in time, or `leave` is called first.
 *
 * @param space - The orbit view, with the Moon in it.
 * @param siteId - A site's name from `SURFACE_SITES`.
 * @param options - Where the tiles are, the moment, where to look first, and whether to move smoothly.
 * @returns The `<wakusei-surface>` element, standing.
 *
 * @example
 * ```ts no-run
 * import "@johnmorrisdotca/wakusei-planets/space/element";
 * import { land, leave } from "@johnmorrisdotca/wakusei-planets/surface/land";
 *
 * const space = document.querySelector("wakusei-space")!;
 * space.addEventListener("wakusei-landed", (event) => console.log("down at", (event as CustomEvent).detail.site));
 * await land(space, "apollo-17");
 * await leave(space);
 * ```
 */
export async function land(space: WakuseiSpace, siteId: string, options: LandOptions = {}): Promise<HTMLElement> {
  const site = siteById(siteId);
  if (site === undefined) throw new Error(`no site called ${siteId}`);
  const before = landings.get(space);
  if (before !== undefined) {
    if (before.site.id === site.id && before.down) return before.surface;
    // another site, or one still coming down: that landing is called off first
    await leave(space);
  }
  const root = space.shadowRoot;
  if (root === null) throw new Error("the orbit view is not connected");
  const smooth = options.smooth !== false && !reduced();
  // the standing view goes in at once (it is made when its element is known, a moment after), so that `leave` can call the landing off from the first moment
  const surface = document.createElement("wakusei-surface");
  surface.setAttribute("site", site.id);
  surface.setAttribute("lang", space.getAttribute("lang") === "ja" ? "ja" : "en");
  if (options.tiles !== undefined) surface.setAttribute("tiles", options.tiles);
  surface.setAttribute("time", String(options.time === "landing" ? site.time : (options.time ?? space.time)));
  const look = options.look ?? {};
  if (look.heading !== undefined) surface.setAttribute("heading", String(look.heading));
  if (look.pitch !== undefined) surface.setAttribute("pitch", String(look.pitch));
  if (look.fov !== undefined) surface.setAttribute("fov", String(look.fov));
  surface.setAttribute("data-landing", "");
  // on standby: the ground is fetched while the camera comes in, and the renderer stays the orbit view's until the veil is down
  surface.setAttribute("standby", "");
  surface.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:5;touch-action:none;visibility:hidden";
  const veil = document.createElement("div");
  veil.setAttribute("data-landing-veil", "");
  veil.style.cssText = `position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:6;transition:opacity ${smooth ? FADE_MS : 0}ms ease`;
  const landing: Landing = { site, surface, veil, down: false, cancelled: false };
  landings.set(space, landing);
  root.append(surface, veil);
  note(space, "wakusei-landing", site);
  const fail = (message: string): never => {
    if (landings.get(space) === landing) landings.delete(space);
    surface.remove();
    veil.remove();
    throw new Error(message);
  };
  try {
    await import("./element.ts");
    // the orbit view turns to a site by its place in the Moon's list: where the page has given the views no lists, the package's own are given
    const { placesLoader, setPlacesLoader } = await import("../scene/place-layer.ts");
    if (placesLoader() === undefined) setPlacesLoader((await import("../places.ts")).loadPlaces);
    if (landing.cancelled) throw new Error("the landing was called off");
    // the camera: to the Moon, then over the site and in to the closest zoom, while the standing view loads behind
    if (space.body !== "moon") {
      space.goTo("moon", { smooth });
      if (smooth) {
        await frame();
        await waitWhile(landing, () => space.stats.ride.gliding || space.stats.travelling !== null, 60_000);
      }
    }
    if (landing.cancelled) throw new Error("the landing was called off");
    const place = await space.goToPlace(site.place, { body: "moon", smooth, zoom: 3.6 });
    if (place === undefined) fail(`the orbit view has no place ${site.place}`);
    if (smooth) await sleep(GLIDE_MS, landing);
    if (smooth) await waitWhile(landing, () => space.stats.pictures.pending > 0, 3000);
    // the ground is in (on standby), or why it cannot be
    const loaded = await waitWhile(landing, () => !(surface as HTMLElement & { loaded?: boolean }).loaded && surface.getAttribute("data-state") !== "unavailable", options.timeout ?? 20_000);
    if (landing.cancelled) throw new Error("the landing was called off");
    if (!loaded) fail("the ground did not come in time");
    if (surface.getAttribute("data-state") === "unavailable") fail("this device cannot draw the ground");
    // the veil comes down over the orbit view, the standing view takes the renderer behind it, and the veil goes up on the ground
    veil.style.opacity = "1";
    if (smooth) await sleep(FADE_MS, landing);
    if (landing.cancelled) throw new Error("the landing was called off");
    surface.style.visibility = "visible";
    surface.removeAttribute("standby");
    const live = await waitWhile(landing, () => surface.getAttribute("data-state") !== "live" && surface.getAttribute("data-state") !== "unavailable", options.timeout ?? 20_000);
    if (landing.cancelled) throw new Error("the landing was called off");
    if (!live || surface.getAttribute("data-state") === "unavailable") {
      // the orbit view gets the renderer back before the error
      surface.remove();
      await space.resume();
      veil.style.opacity = "0";
      fail(live ? "this device cannot draw the ground" : "the ground did not come in time");
    }
    // watching the descent: the standing view starts it as the veil goes up, so the first thing seen is its first frame
    if (options.watch === "landing") {
      if (options.watchCamera !== undefined) surface.setAttribute("watch-camera", options.watchCamera);
      if (options.watchFrom !== undefined) surface.setAttribute("watch-from", options.watchFrom);
      surface.setAttribute("watch", "landing");
    }
    veil.style.opacity = "0";
    if (smooth) await sleep(FADE_MS, landing);
    if (landing.cancelled) throw new Error("the landing was called off");
  } catch (error) {
    if (landings.get(space) === landing && !landing.cancelled) {
      landings.delete(space);
      surface.remove();
      veil.remove();
    }
    throw error;
  }
  landing.down = true;
  surface.setAttribute("tabindex", "0");
  surface.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") void leave(space);
  });
  surface.focus({ preventScroll: true });
  note(space, "wakusei-landed", site);
  return surface;
}

/**
 * Go back up: the standing view fades out and the orbit view's camera rises to the whole Moon. Sends `wakusei-left`. Does nothing when nobody has landed; a landing that is still coming down is called off (its
 * `land` rejects).
 *
 * @param space - The orbit view.
 * @param options - `smooth`: false to cut.
 * @returns Resolves when the orbit view is showing again.
 *
 * @example
 * ```ts no-run
 * import { leave } from "@johnmorrisdotca/wakusei-planets/surface/land";
 *
 * const space = document.querySelector("wakusei-space")!;
 * await leave(space);
 * ```
 */
export async function leave(space: WakuseiSpace, options: { smooth?: boolean } = {}): Promise<void> {
  const landing = landings.get(space);
  if (landing === undefined) return;
  const wasDown = landing.down;
  landing.cancelled = true;
  landing.wake?.();
  landings.delete(space);
  const smooth = options.smooth !== false && !reduced();
  const { surface, veil, site } = landing;
  // the ground goes dark, the orbit view takes the renderer back behind the veil and rises to the whole Moon, and the veil goes up on it
  veil.style.transition = `opacity ${smooth ? FADE_MS : 0}ms ease`;
  veil.style.opacity = "1";
  if (smooth && wasDown) await new Promise<void>((resolve) => setTimeout(resolve, FADE_MS));
  surface.remove();
  if (wasDown) {
    await space.resume();
    await space.goToPlace(site.place, { body: "moon", smooth: false, zoom: 1 });
  } else {
    await space.resume();
  }
  veil.style.opacity = "0";
  if (smooth) await new Promise<void>((resolve) => setTimeout(resolve, FADE_MS));
  veil.remove();
  if (wasDown) note(space, "wakusei-left", site);
}

declare module "../space/element.ts" {
  interface WakuseiSpace {
    /** Come down to a site on the Moon from this view in one move; see `land` in `/surface/land`. */
    land(siteId: string, options?: LandOptions): Promise<HTMLElement>;
    /** Go back up from a site; see `leave` in `/surface/land`. */
    leave(options?: { smooth?: boolean }): Promise<void>;
    /** The site stood at, or null. */
    readonly landed: string | null;
    /** The standing view over this one, or null. */
    readonly standing: HTMLElement | null;
  }
}

const proto = (globalThis as { customElements?: CustomElementRegistry }).customElements?.get("wakusei-space")?.prototype as WakuseiSpace | undefined;
const install = (target: object): void => {
  Object.defineProperties(target, {
    land: { value: function (this: WakuseiSpace, siteId: string, options?: LandOptions) { return land(this, siteId, options); }, configurable: true, writable: true },
    leave: { value: function (this: WakuseiSpace, options?: { smooth?: boolean }) { return leave(this, options); }, configurable: true, writable: true },
    landed: { get(this: WakuseiSpace) { return landedAt(this); }, configurable: true },
    standing: { get(this: WakuseiSpace) { return surfaceOf(this); }, configurable: true },
  });
};
if (proto !== undefined) install(proto);
else if (typeof customElements !== "undefined") void customElements.whenDefined("wakusei-space").then(() => install(customElements.get("wakusei-space")!.prototype));
