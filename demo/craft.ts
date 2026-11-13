// The spacecraft page: one craft at a time, its table loaded only when it is chosen. The path is an SVG (no WebGL). The date plays on load and is shown in the reader's zone.
import { SPACECRAFT, SPACECRAFT_IDS, loadSpacecraft, spacecraftLightTime, spacecraftPosition, spacecraftSpeed, spacecraftSunDistance, type SpacecraftId } from "../src/spacecraft.ts";

const AU = 149_597_870.7;
const $ = <T extends Element>(sel: string): T => document.querySelector(sel) as T;
const lang = (): "en" | "ja" => (document.documentElement.lang === "ja" ? "ja" : "en");

let id: SpacecraftId = "voyager1";
let when = Date.UTC(2026, 10, 12);
let playing = true;
const loaded = new Set<SpacecraftId>();

const crafts = $<HTMLElement>("#crafts");
for (const craft of SPACECRAFT_IDS) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["craft"] = craft;
  button.textContent = SPACECRAFT[craft].name.en;
  button.addEventListener("click", () => {
    id = craft;
    void show();
  });
  crafts.append(button);
}

const whenBox = $<HTMLInputElement>("#when");
const play = $<HTMLButtonElement>("#play");
whenBox.addEventListener("input", () => {
  const ms = Date.parse(whenBox.value);
  if (!Number.isFinite(ms)) return;
  playing = false;
  play.setAttribute("aria-pressed", "false");
  when = ms;
  void show();
});
play.addEventListener("click", () => {
  playing = play.getAttribute("aria-pressed") !== "true";
  play.setAttribute("aria-pressed", String(playing));
  if (playing) schedule();
});

function localValue(ms: number): string {
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Play runs on the page's frames, and only while it is on and the tab is seen: nothing is scheduled when it is paused or hidden, and a frame asks for the next only while it plays.
let frame = 0;
let last = 0;
function schedule(): void {
  if (frame !== 0 || !playing || document.hidden) return;
  last = performance.now();
  frame = requestAnimationFrame(step);
}
/** One frame of play: the date moves on by the time the frame took, at the pace the page always had, a ninetieth of the record in 0.7 s. */
function step(now: number): void {
  frame = 0;
  if (!playing || document.hidden) return;
  const craft = SPACECRAFT[id];
  const span = craft.record.end - craft.record.start;
  when += (span / 90) * ((now - last) / 700);
  last = now;
  if (when > craft.record.end) when = craft.record.start;
  void show();
  frame = requestAnimationFrame(step);
}

async function show(): Promise<void> {
  const craft = SPACECRAFT[id];
  const named = lang();
  for (const button of crafts.querySelectorAll("button")) {
    const one = button.dataset["craft"] as SpacecraftId;
    button.setAttribute("aria-pressed", String(one === id));
    button.textContent = SPACECRAFT[one].name[named];
  }
  if (!loaded.has(id)) {
    await loadSpacecraft(id);
    loaded.add(id);
  }
  const words = lang();
  const start = craft.record.start;
  const end = craft.record.end;
  when = Math.min(end, Math.max(start, when));
  whenBox.value = localValue(when);
  const samples: { x: number; y: number; t: number }[] = [];
  const steps = 72;
  for (let i = 0; i <= steps; i += 1) {
    const t = start + ((end - start) * i) / steps;
    const [x, y] = spacecraftPosition(id, t);
    samples.push({ x: x / AU, y: y / AU, t });
  }
  const [px, py] = spacecraftPosition(id, when);
  const here = { x: px / AU, y: py / AU };
  const xs = samples.map((p) => p.x).concat(here.x, 0);
  const ys = samples.map((p) => p.y).concat(here.y, 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.08 * Math.max(maxX - minX, maxY - minY, 1);
  const map = (p: { x: number; y: number }): string => `${((p.x - minX + pad) / (maxX - minX + 2 * pad)) * 100},${((maxY - p.y + pad) / (maxY - minY + 2 * pad)) * 100}`;
  const breaks = new Set(craft.joins.map((join) => join.date));
  let d = "";
  let pen = false;
  for (const sample of samples) {
    if ([...breaks].some((date) => Math.abs(sample.t - date) < (end - start) / steps)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${map(sample)}`;
    pen = true;
  }
  const mark = map(here);
  const sun = map({ x: 0, y: 0 });
  $<SVGSVGElement>("#chart").innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="0.6"/><circle cx="${sun.split(",")[0]}" cy="${sun.split(",")[1]}" r="1.2" fill="#e7c36a"/><circle cx="${mark.split(",")[0]}" cy="${mark.split(",")[1]}" r="1.4" fill="#fff"/>`;
  const au = spacecraftSunDistance(id, when) / AU;
  const speed = spacecraftSpeed(id, when);
  const hours = spacecraftLightTime(id, when) / 3600;
  const local = new Date(when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  $<HTMLElement>("#where").textContent = words === "ja"
    ? `${craft.name.ja}、${local}、太陽から ${au.toFixed(2)} au、${speed.toFixed(1)} km/s、電波で ${hours.toFixed(1)} 時間`
    : `${craft.name.en}, ${local}, ${au.toFixed(2)} au from the Sun, ${speed.toFixed(1)} km/s, ${hours.toFixed(1)} h by radio`;
  const status = words === "ja" ? (craft.status === "active" ? "飛行中" : "終了") : craft.status;
  $<HTMLElement>("#facts").textContent = words === "ja"
    ? `${craft.name.ja}（${craft.agency}、${status}）。打上げ: ${new Date(craft.launch.date).toLocaleString()}、${craft.launch.site.ja}、${craft.launch.vehicle}。`
    : `${craft.name.en} (${craft.agency}, ${status}). Launch: ${new Date(craft.launch.date).toLocaleString()}, ${craft.launch.site.en}, ${craft.launch.vehicle}.`;
  $<HTMLElement>("#events").replaceChildren(...craft.events.map((event) => {
    const item = document.createElement("li");
    const at = new Date(event.date).toLocaleDateString(undefined, event.precision === "minute" ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
    item.textContent = `${at}: ${event.name[words]}`;
    return item;
  }));
}

window.addEventListener("wakusei-language", () => void show());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) schedule();
});
void show();
schedule();
