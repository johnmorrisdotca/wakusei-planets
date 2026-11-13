// The standing page: <wakusei-surface> at the Apollo 17 landing site with a few choices: where to look, how high the Sun is (days after the landing), and whether the made detail is shown. A choice sets
// an attribute; nothing here runs on a timer. The page's tiles are the Pages build's `tiles/` folder.
import "../src/surface/element.ts";
import type { WakuseiSurface } from "../src/surface/element.ts";
import { moonSky } from "../src/surface/sky.ts";
import { siteById } from "../src/surface/site.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
const pressed = (button: Element, on: boolean): void => button.setAttribute("aria-pressed", String(on));

const view = $<WakuseiSurface>("#surface");
const site = siteById("apollo-17")!;
const LOOKS: Record<string, { heading: number; pitch: number; fov: number }> = {
  massif: { heading: site.look.azimuth, pitch: site.look.pitch, fov: site.look.fov },
  sun: { heading: 62, pitch: 7, fov: 66 },
  feet: { heading: site.look.azimuth, pitch: -50, fov: 75 },
};
const DAY = 86_400_000;
let days = 0;

function caption(): void {
  const sky = moonSky(site.lat, site.lon, site.time + days * DAY);
  $("#caption").textContent = say("sf_caption", { sun: sky.sun.altitude.toFixed(0), earth: sky.earth.altitude.toFixed(0), lit: (100 * sky.earthIllumination).toFixed(0) });
}

function look(key: string): void {
  const l = LOOKS[key]!;
  view.setAttribute("heading", String(l.heading));
  view.setAttribute("pitch", String(l.pitch));
  view.setAttribute("fov", String(l.fov));
  for (const button of $$("#looks button")) pressed(button, button.dataset["look"] === key);
}

function time(next: number): void {
  days = next;
  view.setAttribute("time", new Date(site.time + days * DAY).toISOString());
  for (const button of $$("#times button")) pressed(button, Number(button.dataset["days"]) === days);
  caption();
}

for (const button of $$("#looks button")) button.addEventListener("click", () => look(button.dataset["look"]!));
for (const button of $$("#times button")) button.addEventListener("click", () => time(Number(button.dataset["days"])));
for (const button of $$("#details button")) {
  button.addEventListener("click", () => {
    const on = button.dataset["detail"] === "on";
    if (on) view.removeAttribute("detail");
    else view.setAttribute("detail", "off");
    for (const other of $$("#details button")) pressed(other, other === button);
  });
}
window.addEventListener("wakusei-language", () => {
  view.setAttribute("lang", chooser()?.lang ?? "en");
  caption();
});
view.setAttribute("lang", chooser()?.lang ?? "en");
caption();
