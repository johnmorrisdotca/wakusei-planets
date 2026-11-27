// The spacecraft page: one craft at a time, its table loaded only when it is chosen. The path is an SVG (no WebGL). The date plays on load and is shown in the reader's zone.
import { craftTrack } from "../src/craft-track.ts";
import { BODIES, type PlanetId } from "../src/facts.ts";
import { systemOrbit } from "../src/flat/system.ts";
import { SPACECRAFT, SPACECRAFT_IDS, loadSpacecraft, spacecraftLightTime, spacecraftPosition, spacecraftSpeed, spacecraftSunDistance, type SpacecraftId } from "../src/spacecraft.ts";

const AU = 149_597_870.7;
const $ = <T extends Element>(sel: string): T => document.querySelector(sel) as T;
const lang = (): "en" | "ja" => (document.documentElement.lang === "ja" ? "ja" : "en");

let id: SpacecraftId = "voyager1";
let when = Date.UTC(2026, 10, 12);
let playing = true;
let wholePath = false;
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
const whole = $<HTMLButtonElement>("#whole-path");
whole.addEventListener("click", () => {
  wholePath = !wholePath;
  void show();
});
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
  // the chart, the facts and the events are the craft's, not the moment's: only the marker and the where line move with it
  if (drawn === id) place();
  else void show();
  frame = requestAnimationFrame(step);
}

/** The craft whose chart is drawn, and the chart's way of putting a place on it; the marker moves with the date, nothing else of the chart does. */
let drawn: SpacecraftId | null = null;
let chartMap: ((p: { x: number; y: number }) => string) | null = null;
let chartWords: "en" | "ja" = "en";

type ChartPoint = { x: number; y: number };

/** The last edge the path crosses on its way out, with the arrow aligned to the track. */
function outboundArrow(tracks: readonly (readonly ChartPoint[])[], project: (p: ChartPoint) => ChartPoint): { head: ChartPoint; tail: ChartPoint; wings: [ChartPoint, ChartPoint] } | undefined {
  const end = tracks.at(-1)?.at(-1);
  const outside = (point: ChartPoint, margin: number): boolean =>
    point.x < margin || point.x > 100 - margin || point.y < margin || point.y > 100 - margin;
  if (end === undefined || !outside(project(end), 0)) return undefined;
  const margin = 2;
  for (const track of [...tracks].reverse()) {
    for (let i = track.length - 1; i > 0; i -= 1) {
      const a = project(track[i - 1]!);
      const b = project(track[i]!);
      if (outside(a, margin) || !outside(b, margin)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const tx = dx === 0 ? Infinity : ((dx > 0 ? 100 - margin : margin) - a.x) / dx;
      const ty = dy === 0 ? Infinity : ((dy > 0 ? 100 - margin : margin) - a.y) / dy;
      const t = Math.min(tx, ty);
      const head = { x: a.x + t * dx, y: a.y + t * dy };
      const distance = Math.hypot(dx, dy);
      const ux = dx / distance;
      const uy = dy / distance;
      const tail = { x: head.x - 4.2 * ux, y: head.y - 4.2 * uy };
      return {
        head,
        tail,
        wings: [
          { x: tail.x - 1.7 * uy, y: tail.y + 1.7 * ux },
          { x: tail.x + 1.7 * uy, y: tail.y - 1.7 * ux },
        ],
      };
    }
  }
  return undefined;
}

/** Keep labels inside the chart and apart, with a line back to each plotted point. */
function placeLabels(chart: SVGSVGElement): void {
  const boxes: { left: number; right: number; top: number; bottom: number }[] = [];
  const groups = chart.querySelectorAll<SVGGElement>(".craft-label");
  const widths = Array.from(groups, (group) => group.querySelector("text")!.getComputedTextLength());
  groups.forEach((group, i) => {
    const name = group.querySelector("text")!;
    const leader = group.querySelector("line")!;
    const x = leader.x1.baseVal.value;
    const y = leader.y1.baseVal.value;
    const width = widths[i]!;
    const sides = [x + 2.1, x - width - 2.1];
    const offsets = [-1.5, 4.5, -6, 9, -10.5, 13.5, -15, 18, -19.5, 22.5, -24, 27];
    const at = (left: number, offset: number) => {
      const baseline = Math.max(5, Math.min(97, y + offset));
      return { left, right: left + width, top: baseline - 3.5, bottom: baseline + 0.9, baseline };
    };
    const positions = offsets.flatMap((offset) => sides.map((left) => at(left, offset)));
    const box = positions.find((candidate) => {
      if (candidate.left < 2 || candidate.right > 98) return false;
      return boxes.every((other) => candidate.right <= other.left || candidate.left >= other.right || candidate.top >= other.bottom || candidate.bottom <= other.top);
    }) ?? at(Math.max(2, Math.min(98 - width, x + 2.1)), -1.5);
    boxes.push(box);
    name.setAttribute("x", String(box.left));
    name.setAttribute("y", String(box.baseline));
    leader.setAttribute("x2", String(box.left > x ? box.left - 0.5 : box.left + width + 0.5));
    leader.setAttribute("y2", String(box.baseline - 1.1));
  });
}

/** Put the marker and the where line at the moment: the only things that change while the date plays. */
function place(): void {
  if (chartMap === null || drawn === null) return;
  const craft = SPACECRAFT[drawn];
  const [px, py] = spacecraftPosition(drawn, when);
  const [x, y] = chartMap({ x: px / AU, y: py / AU }).split(",");
  const marker = $<SVGCircleElement>("#chart #mark");
  if (marker.getAttribute("cx") !== x) marker.setAttribute("cx", x!);
  if (marker.getAttribute("cy") !== y) marker.setAttribute("cy", y!);
  const au = spacecraftSunDistance(drawn, when) / AU;
  const speed = spacecraftSpeed(drawn, when);
  const hours = spacecraftLightTime(drawn, when) / 3600;
  const local = new Date(when).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const text = chartWords === "ja"
    ? `${craft.name.ja}、${local}、太陽から ${au.toFixed(2)} au、${speed.toFixed(1)} km/s、電波で ${hours.toFixed(1)} 時間`
    : `${craft.name.en}, ${local}, ${au.toFixed(2)} au from the Sun, ${speed.toFixed(1)} km/s, ${hours.toFixed(1)} h by radio`;
  const where = $<HTMLElement>("#where");
  // the text node is changed in place: replacing the element's children would tell every watcher of the page's tree that it changed
  if (where.firstChild instanceof Text && where.childNodes.length === 1) {
    if (where.firstChild.data !== text) where.firstChild.data = text;
  } else if (where.textContent !== text) where.textContent = text;
  whenBox.value = localValue(when);
}

async function show(): Promise<void> {
  const selected = id;
  const craft = SPACECRAFT[selected];
  const named = lang();
  for (const button of crafts.querySelectorAll("button")) {
    const one = button.dataset["craft"] as SpacecraftId;
    button.setAttribute("aria-pressed", String(one === selected));
    button.textContent = SPACECRAFT[one].name[named];
  }
  if (!loaded.has(selected)) {
    await loadSpacecraft(selected);
    loaded.add(selected);
    if (selected !== id) return;
  }
  const words = lang();
  const start = craft.record.start;
  const end = craft.record.end;
  when = Math.min(end, Math.max(start, when));
  whenBox.value = localValue(when);
  const tracks = craftTrack(selected);
  const encounters: { body: PlanetId; date: number }[] = craft.events.flatMap(({ kind, body, date }) =>
    kind === "flyby" && body !== undefined && date >= start && date <= end ? [{ body, date }] : [],
  );
  const orbitDates = new Map(encounters.map(({ body, date }) => [body, date]));
  const orbits = Array.from(orbitDates, ([body, date]) => ({
    body,
    points: systemOrbit(body, date).map(([x, y]) => ({ x, y })),
  }));
  const orbitPoints = orbits.flatMap(({ points }) => points);
  const radius = 1.23 * Math.max(0.2, ...orbitPoints.map(({ x, y }) => Math.hypot(x, y)));
  const encounterView = (point: ChartPoint): ChartPoint => ({ x: 50 + 50 * point.x / radius, y: 50 - 50 * point.y / radius });
  const canFrame = orbits.length > 0;
  const frameEncounters = canFrame && !wholePath;
  const arrow = frameEncounters ? outboundArrow(tracks, encounterView) : undefined;
  whole.hidden = !canFrame;
  whole.setAttribute("aria-pressed", String(wholePath && canFrame));
  const samples = [...tracks.flat(), ...orbitPoints, { x: 0, y: 0 }];
  const [px, py] = spacecraftPosition(selected, when);
  const here = { x: px / AU, y: py / AU };
  const xs = samples.map((p) => p.x);
  const ys = samples.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.08 * Math.max(maxX - minX, maxY - minY, 1);
  const fullView = (p: ChartPoint): ChartPoint => ({
    x: ((p.x - minX + pad) / (maxX - minX + 2 * pad)) * 100,
    y: ((maxY - p.y + pad) / (maxY - minY + 2 * pad)) * 100,
  });
  const project = frameEncounters ? encounterView : fullView;
  const map = (point: ChartPoint): string => {
    const { x, y } = project(point);
    return `${x},${y}`;
  };
  const d = tracks.map((track) => track.map((point, i) => `${i === 0 ? "M" : "L"}${map(point)}`).join("")).join("");
  const rings = orbits.map(({ body, points }) => `<polygon data-orbit="${body}" points="${points.map(map).join(" ")}" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width=".25"/>`).join("");
  const label = ({ x, y }: ChartPoint, name: string, colour: string, mark: string): string =>
    `<g class="craft-label"><line x1="${x}" y1="${y}" stroke="${colour}" stroke-opacity=".65" stroke-width=".22"/>${mark}<text>${name}</text></g>`;
  const dot = (point: ChartPoint, name: string, colour: string, size: number): string => {
    const { x, y } = project(point);
    return label({ x, y }, name, colour, `<circle cx="${x}" cy="${y}" r="${size}" fill="${colour}"/>`);
  };
  const sun = dot({ x: 0, y: 0 }, BODIES.sun.name[words], "#e7c36a", 1.2);
  const flybys = encounters.map(({ body, date }) => {
    const [x, y] = spacecraftPosition(selected, date);
    const year = new Date(date).getUTCFullYear();
    return dot({ x: x / AU, y: y / AU }, `${BODIES[body].name[words]} ${year}${words === "ja" ? "年" : ""}`, "#94c5ed", 0.7);
  }).join("");
  const outgoing = arrow === undefined ? "" : label(arrow.tail, words === "ja" ? "外側へ" : "Outbound", "#f4efe4", `<polygon class="craft-outbound" points="${[arrow.head, ...arrow.wings].map(({ x, y }) => `${x},${y}`).join(" ")}" fill="#f4efe4"/>`);
  const mark = project(here);
  const chart = $<SVGSVGElement>("#chart");
  chart.innerHTML = `${rings}<path class="flight-path" d="${d}" fill="none" stroke="currentColor" stroke-width="0.6"/>${sun}${flybys}${outgoing}<circle id="mark" cx="${mark.x}" cy="${mark.y}" r="1.4" fill="#fff"/>`;
  placeLabels(chart);
  drawn = selected;
  chartMap = map;
  chartWords = words;
  place();
  const status = words === "ja" ? (craft.status === "active" ? "飛行中" : "終了") : craft.status;
  $<HTMLElement>("#facts").textContent = words === "ja"
    ? `${craft.name.ja}（${craft.agency}、${status}）。打上げ: ${new Date(craft.launch.date).toLocaleString()}、${craft.launch.site.ja}、${craft.launch.vehicle}。`
    : `${craft.name.en} (${craft.agency}, ${status}). Launch: ${new Date(craft.launch.date).toLocaleString()}, ${craft.launch.site.en}, ${craft.launch.vehicle}.`;
  $<HTMLElement>("#events").replaceChildren(...craft.events.map((event) => {
    const item = document.createElement("li");
    const at = event.precision === "minute"
      ? new Date(event.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : new Date(event.date).toLocaleDateString(undefined, { dateStyle: "medium" });
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
