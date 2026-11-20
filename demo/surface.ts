// The standing page: a row of the seven sites, then Land. Apollo 17 is the one that starts chosen, and the only one whose descent can be watched. Drive, once down, uses that site's rover model where the package has one. A choice sets an attribute; nothing here runs on a timer.
import "../src/space/element.ts";
import "../src/surface/element.ts";
import type { WakuseiSpace } from "../src/space/element.ts";
import { land, leave } from "../src/surface/land.ts";
import type { WakuseiSurface } from "../src/surface/element.ts";
import { standSky } from "../src/surface/sky.ts";
import { siteById, type SurfaceSite } from "../src/surface/site.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
const pressed = (button: Element, on: boolean): void => button.setAttribute("aria-pressed", String(on));
const lang = (): "en" | "ja" => chooser()?.lang ?? "en";

/** A real rover file, served beside the page. Chang'e 3 and Chang'e 4 have none: NASA's catalogue has no Yutu model, so those two drive the package's shapes. */
const DRIVE_MODEL: Record<string, string> = {
  perseverance: "models/perseverance.glb",
  curiosity: "models/curiosity.glb",
  "apollo-17": "models/apollo-lrv.glb",
  "apollo-15": "models/apollo-lrv.glb",
  "apollo-16": "models/apollo-lrv.glb",
};

const orbit = $<WakuseiSpace>("#orbit");
let site: SurfaceSite = siteById("apollo-17")!;
/** The standing view while landed: the choices below act on it, and are off while in orbit. */
let view: WakuseiSurface | undefined;
/** True while a descent is in flight, so a language change does not replace its line. */
let busy = false;
let driving = false;
let lookKey = "massif";
const DAY = 86_400_000;
let days = 0;

const landButton = $<HTMLButtonElement>("#land");
const driveButton = $<HTMLButtonElement>("#drive");
const leaveButton = $<HTMLButtonElement>("#leave");
const watchButton = $<HTMLButtonElement>("#watch");
const watching = $("#watching");

function word(el: HTMLElement, key: string, values?: Record<string, string | number>): void {
  if (values) delete el.dataset["say"];
  else el.dataset["say"] = key;
  el.textContent = say(key, values);
}

function place(): string {
  return site.name[lang()];
}

function caption(): void {
  if (view === undefined) {
    $("#caption").textContent = "";
    return;
  }
  const sky = standSky(site.body, site.lat, site.lon, site.time + days * DAY);
  const sun = sky.sun.altitude.toFixed(0);
  const earth = sky.earth.altitude.toFixed(0);
  const lit = (100 * sky.earthIllumination).toFixed(0);
  if (site.id === "apollo-17") $("#caption").textContent = say("sf_caption", { sun, earth, lit });
  else if (site.body === "mars") $("#caption").textContent = say("sf_caption_mars", { place: place(), sun });
  else $("#caption").textContent = say("sf_caption_place", { place: place(), sun, earth, lit });
}

function pose(key: string): { heading: number; pitch: number; fov: number } {
  if (key === "sun" && site.id === "apollo-17") return { heading: 62, pitch: 7, fov: 66 };
  const sky = standSky(site.body, site.lat, site.lon, site.time + days * DAY);
  if (key === "sun") return { heading: sky.sun.azimuth, pitch: Math.max(2, sky.sun.altitude), fov: 66 };
  if (key === "feet") return { heading: site.look.azimuth, pitch: -50, fov: 75 };
  return { heading: site.look.azimuth, pitch: site.look.pitch, fov: site.look.fov };
}

function look(key: string): void {
  lookKey = key;
  const l = pose(key);
  view?.setAttribute("heading", String(l.heading));
  view?.setAttribute("pitch", String(l.pitch));
  view?.setAttribute("fov", String(l.fov));
  for (const button of $$("#looks button")) pressed(button, button.dataset["look"] === key);
}

function time(next: number): void {
  days = next;
  view?.setAttribute("time", new Date(site.time + days * DAY).toISOString());
  for (const button of $$("#times button")) pressed(button, Number(button.dataset["days"]) === days);
  if (lookKey === "sun") look("sun");
  caption();
}

function hint(key: string, values?: Record<string, string | number>): void {
  const el = $("#hint");
  if (values) delete el.dataset["say"];
  else el.dataset["say"] = key;
  el.textContent = say(key, values);
}

/** The line under the picture, and the body the orbit view shows, for the site now chosen. */
function standingHint(): void {
  if (driving) hint("sf_hint_drive");
  else if (view !== undefined) hint(site.ground === "measured" ? "sf_hint" : "sf_hint_flat");
  else if (site.id === "apollo-17") hint("sf_orbit");
  else hint("sf_orbit_at", { body: say(site.body === "mars" ? "sf_body_mars" : "sf_body_moon"), place: place() });
  if (view === undefined) {
    orbit.body = site.body;
    orbit.time = site.time;
  }
}

function paint(options?: { hint?: boolean }): void {
  for (const button of $$("#sites button")) pressed(button, button.dataset["site"] === site.id);
  word($("#stage-h"), site.body === "mars" ? "sf_stage_mars" : "sf_stage");
  if (site.id === "apollo-17") word(landButton, "sf_land");
  else word(landButton, "sf_land_at", { place: place() });
  word($("#looks button[data-look=massif]")!, site.id === "apollo-17" ? "sf_massif" : "sf_view");
  $("#detail-row").hidden = site.ground !== "measured";
  const apollo = site.id.startsWith("apollo");
  $("#rover-credit").hidden = !apollo;
  const note = $("#rover-note");
  note.hidden = apollo;
  if (!apollo) word(note, DRIVE_MODEL[site.id] ? "sf_rover_nasa" : "sf_rover_shapes");
  word($("#ground-words"), site.ground === "measured" ? "sf_credits" : "sf_flat");
  word(driveButton, driving ? "sf_stop_drive" : "sf_drive");
  driveButton.hidden = view === undefined;
  if (options?.hint !== false && !busy) standingHint();
  caption();
}

function setDrive(on: boolean): void {
  if (view === undefined) return;
  driving = on;
  if (on) {
    view.removeAttribute("watch");
    watching.hidden = true;
    watchButton.hidden = site.id !== "apollo-17";
    view.setAttribute("drive", "on");
    const model = DRIVE_MODEL[site.id];
    if (model) view.setAttribute("drive-model", model);
    else view.removeAttribute("drive-model");
  } else {
    view.removeAttribute("drive");
    view.removeAttribute("drive-model");
  }
  paint();
}

const choices = (on: boolean): void => {
  for (const button of $$("#looks button, #times button, #details button")) button.disabled = !on;
};
const sites = (on: boolean): void => {
  for (const button of $$("#sites button")) button.disabled = !on;
};
const watchOn = (on: boolean): void => {
  watching.hidden = !on;
  watchButton.hidden = on || view === undefined || site.id !== "apollo-17";
};

for (const button of $$("#looks button")) button.addEventListener("click", () => look(button.dataset["look"]!));
for (const button of $$("#times button")) button.addEventListener("click", () => time(Number(button.dataset["days"])));
for (const button of $$("#details button")) {
  button.addEventListener("click", () => {
    const on = button.dataset["detail"] === "on";
    if (on) view?.removeAttribute("detail");
    else view?.setAttribute("detail", "off");
    for (const other of $$("#details button")) pressed(other, other === button);
  });
}
for (const button of $$("#sites button")) {
  button.addEventListener("click", () => {
    const next = siteById(button.dataset["site"] ?? "");
    if (!next || next.id === site.id || button.disabled) return;
    site = next;
    look("massif");
    paint();
  });
}

landButton.addEventListener("click", () => {
  busy = true;
  landButton.disabled = true;
  sites(false);
  if (site.id === "apollo-17") hint("sf_landing");
  else hint("sf_landing_at", { place: place() });
  void land(orbit, site.id, { tiles: "tiles/", time: site.time + days * DAY }).then(
    (surface) => {
      busy = false;
      driving = false;
      view = surface as WakuseiSurface;
      landButton.hidden = true;
      leaveButton.hidden = false;
      choices(true);
      sites(false);
      look("massif");
      watchOn(false);
      paint();
    },
    () => {
      busy = false;
      landButton.disabled = false;
      sites(true);
      hint("sf_failed");
    },
  );
});
leaveButton.addEventListener("click", () => void leave(orbit));
driveButton.addEventListener("click", () => setDrive(!driving));

// watching the descent: the standing view runs Apollo 17's powered descent when its `watch` is `landing`
const scrub = $<HTMLInputElement>("#watch-scrub");
const playButton = $<HTMLButtonElement>("#watch-play");
const cameraButton = $<HTMLButtonElement>("#watch-camera");
const rateButton = $<HTMLButtonElement>("#watch-rate");
watchButton.addEventListener("click", () => {
  if (view === undefined || site.id !== "apollo-17") return;
  view.setAttribute("watch-camera", "lander");
  view.setAttribute("watch", "landing");
  word(cameraButton, "sf_camera_ground");
  word(playButton, "sf_pause");
  word(rateButton, "sf_rate_4");
  watchOn(true);
});
playButton.addEventListener("click", () => {
  const e = view as unknown as { landing?: { playing: boolean }; playLanding(): void; pauseLanding(): void };
  if (e.landing?.playing === true) {
    e.pauseLanding();
    word(playButton, "sf_play");
  } else {
    e.playLanding();
    word(playButton, "sf_pause");
  }
});
cameraButton.addEventListener("click", () => {
  const ground = view?.getAttribute("watch-camera") !== "ground";
  view?.setAttribute("watch-camera", ground ? "ground" : "lander");
  word(cameraButton, ground ? "sf_camera_lander" : "sf_camera_ground");
});
rateButton.addEventListener("click", () => {
  const e = view as unknown as { landingRate: number };
  const fast = e.landingRate === 1;
  e.landingRate = fast ? 4 : 1;
  word(rateButton, fast ? "sf_rate_1" : "sf_rate_4");
});
scrub.addEventListener("input", () => {
  (view as unknown as { landingTime: number }).landingTime = Number(scrub.value);
});
$("#watch-stop").addEventListener("click", () => {
  view?.removeAttribute("watch");
  watchOn(false);
});
orbit.addEventListener("wakusei-landing-clock", (event) => {
  const detail = (event as CustomEvent<{ t: number; playing: boolean }>).detail;
  scrub.value = String(Math.round(detail.t));
  if (!detail.playing && detail.t >= 725) word(playButton, "sf_play");
});
orbit.addEventListener("wakusei-left", () => {
  busy = false;
  driving = false;
  view = undefined;
  landButton.hidden = false;
  landButton.disabled = false;
  leaveButton.hidden = true;
  watchOn(false);
  choices(false);
  sites(true);
  paint();
});
window.addEventListener("wakusei-language", () => {
  const next = lang();
  orbit.setAttribute("lang", next);
  view?.setAttribute("lang", next);
  paint();
});
orbit.setAttribute("lang", lang());
paint();
