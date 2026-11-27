import { orbitPoint, orbitSystems, practicePeriod, type ExplorerOrbit } from "./kepler-orbits.ts";
import { WORDS } from "./words.js";

const SVG = "http://www.w3.org/2000/svg";
const SECTOR_FRACTION = 1 / 8;
const SUN_ANCHORS = new Map([
  ["mercury", -1], ["earth", 1], ["jupiter", -1], ["neptune", 1], ["pluto", -1],
]);
const find = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const systems = orbitSystems();
const systemSelect = find<HTMLSelectElement>("kp-system");
const orbitSelect = find<HTMLSelectElement>("kp-orbit");
const plot = find("kp-plot");
const sweep = find("kp-sweep");
const time = find<HTMLInputElement>("kp-time");
const play = find<HTMLButtonElement>("kp-play");
const practice = find<HTMLInputElement>("kp-practice");
const adjust = find("kp-adjust");
const size = find<HTMLInputElement>("kp-size");
const eccentricity = find<HTMLInputElement>("kp-eccentricity");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const lang = (): "en" | "ja" => document.documentElement.lang === "ja" ? "ja" : "en";
const say = (key: keyof typeof WORDS.en, data: Record<string, string> = {}): string =>
  WORDS[lang()][key].replace(/\{(\w+)\}/g, (_, field: string) => data[field] ?? "");
const number = (value: number): string => new Intl.NumberFormat(lang(), { maximumSignificantDigits: 4 }).format(value);

let system = systems[0]!;
let chosen: ExplorerOrbit | undefined = system.orbits[0];
let marker: SVGCircleElement | undefined;
let position: ((fraction: number) => [number, number]) | undefined;
let phase = 0;
let cycle = 1;
let frame = 0;
let last: number | undefined;
let playing = false;
let visible = false;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function label(parent: SVGSVGElement, words: string, attributes: Record<string, string | number>): void {
  const text = svg("text", attributes);
  text.textContent = words;
  parent.append(text);
}

function diagram(host: HTMLElement, height: number, title: string): [SVGSVGElement, number] {
  const width = Math.max(255, Math.round(host.clientWidth));
  return [svg("svg", { class: "kepler-svg", viewBox: `0 0 ${width} ${height}`, "aria-labelledby": title, role: "img", "font-size": 11 }), width];
}

function extent(values: number[]): [number, number] {
  const low = Math.floor(Math.log10(Math.min(...values)));
  return [low, Math.max(low + 1, Math.ceil(Math.log10(Math.max(...values))))];
}

function drawPlot(model: ExplorerOrbit | undefined): void {
  if (!chosen) {
    plot.textContent = say("kp_empty");
    return;
  }
  const [chart, width] = diagram(plot, 275, "kp-plot-title");
  const left = 57, right = width - 16, top = 14, bottom = 230;
  const ref = system.orbits.find((orbit) => orbit.id === "earth") ?? system.orbits[0]!;
  const axes = system.orbits.map((orbit) => orbit.axis);
  const days = system.orbits.map((orbit) => orbit.periodDays);
  if (model) {
    for (const scale of [0.25, 4]) {
      axes.push(chosen.axis * scale);
      days.push(practicePeriod(chosen.axis * scale, ref));
    }
  }
  const [minX, maxX] = extent(axes);
  const [minY, maxY] = extent(days);
  const x = (n: number): number => left + (n - minX) / (maxX - minX) * (right - left);
  const y = (n: number): number => bottom - (n - minY) / (maxY - minY) * (bottom - top);
  const tick = new Intl.NumberFormat(lang(), { notation: "compact", maximumSignificantDigits: 2 });
  for (let p = minX; p <= maxX; p += Math.max(1, Math.ceil((maxX - minX) / 5))) {
    chart.append(svg("line", { class: "grid", x1: x(p), x2: x(p), y1: top, y2: bottom }));
    label(chart, tick.format(10 ** p), { x: x(p), y: bottom + 16, "text-anchor": "middle" });
  }
  for (let p = minY; p <= maxY; p += Math.max(1, Math.ceil((maxY - minY) / 5))) {
    chart.append(svg("line", { class: "grid", x1: left, x2: right, y1: y(p), y2: y(p) }));
    label(chart, tick.format(10 ** p), { x: left - 6, y: y(p) + 3, "text-anchor": "end" });
  }
  chart.append(svg("path", { class: "axes", d: `M${left} ${top}V${bottom}H${right}` }));
  label(chart, say("kp_axis", { unit: system.distanceUnit }), { x: (left + right) / 2, y: bottom + 33, "text-anchor": "middle" });
  label(chart, say("kp_days"), { transform: `translate(12 ${(top + bottom) / 2}) rotate(-90)`, "text-anchor": "middle" });
  const centreX = Math.log10(ref.axis), centreY = Math.log10(ref.periodDays);
  const from = Math.max(minX, centreX + (minY - centreY) / 1.5);
  const to = Math.min(maxX, centreX + (maxY - centreY) / 1.5);
  chart.append(svg("line", { class: "trend", x1: x(from), x2: x(to), y1: y(centreY + 1.5 * (from - centreX)), y2: y(centreY + 1.5 * (to - centreX)) }));
  for (const orbit of system.orbits) {
    const dot = svg("circle", { class: "catalogue", "data-orbit": orbit.id, cx: x(Math.log10(orbit.axis)), cy: y(Math.log10(orbit.periodDays)), r: 2.8 });
    const title = svg("title");
    title.textContent = orbit.name[lang()];
    dot.append(title);
    chart.append(dot);
  }
  const highlight = model ?? chosen;
  chart.append(svg("circle", { class: "selected", cx: x(Math.log10(highlight.axis)), cy: y(Math.log10(highlight.periodDays)), r: 5, "pointer-events": "none" }));
  if (system.id === "sun") {
    for (const orbit of system.orbits) {
      const side = SUN_ANCHORS.get(orbit.id);
      if (side === undefined) continue;
      label(chart, orbit.name[lang()], {
        class: "anchor", x: x(Math.log10(orbit.axis)) + side * 8, y: y(Math.log10(orbit.periodDays)) + side * 7,
        "text-anchor": side < 0 ? "end" : "start", "pointer-events": "none",
      });
    }
  }
  plot.replaceChildren(chart);
}

function paintPosition(): void {
  time.value = String(Math.round(phase * 1000));
  if (!marker || !position) return;
  const [x, y] = position(phase);
  marker.setAttribute("cx", String(x));
  marker.setAttribute("cy", String(y));
}

function drawSweep(orbit: ExplorerOrbit | undefined): void {
  marker = undefined;
  position = undefined;
  if (!orbit) {
    sweep.textContent = say("kp_empty");
    return;
  }
  const [chart, width] = diagram(sweep, 275, "kp-sweep-title");
  const scale = Math.min((width - 44) / 2, 111);
  const centre = width / 2;
  const e = orbit.eccentricity;
  const focus = centre + scale * e;
  const other = centre - scale * e;
  const mid = 133;
  position = (t) => {
    const [x, y] = orbitPoint(e, t);
    return [focus + x * scale, mid - y * scale];
  };
  const arc = (at: number): string => Array.from({ length: 65 }, (_, i) =>
    position!(at + (i / 64 - 0.5) * SECTOR_FRACTION).map((n) => n.toFixed(2)).join(" "),
  ).join(" L");
  chart.append(
    svg("ellipse", { class: "ellipse", cx: centre, cy: mid, rx: scale, ry: scale * Math.sqrt(1 - e * e) }),
    svg("path", { class: "near", d: `M${focus} ${mid} L${arc(0)} Z` }),
    svg("path", { class: "far", d: `M${focus} ${mid} L${arc(0.5)} Z` }),
  );
  if (e > 0) {
    chart.append(
      svg("path", { class: "empty-focus", d: `M${other - 4} ${mid - 4}l8 8m-8 0l8 -8` }),
      svg("circle", { class: "centre", cx: centre, cy: mid, r: 3 }),
    );
    label(chart, say("kp_other_focus"), { x: Math.max(34, other), y: mid - 12, "text-anchor": "middle" });
    label(chart, say("kp_centre"), { x: centre, y: mid + 33, "text-anchor": "middle" });
  } else {
    label(chart, say("kp_circle_focus"), { x: centre, y: mid + 33, "text-anchor": "middle" });
  }
  chart.append(
    svg("circle", { class: "focus", cx: focus, cy: mid, r: 5 }),
  );
  label(chart, system.name[lang()], { x: Math.min(focus, width - 35), y: mid + 18, "text-anchor": "middle" });
  marker = svg("circle", { class: "selected", r: 5 });
  chart.append(marker);
  sweep.replaceChildren(chart);
  paintPosition();
}

function readout(orbit: ExplorerOrbit, key: "kp_catalogue" | "kp_model"): string {
  return say(key, { name: orbit.name[lang()], axis: number(orbit.axis), unit: system.distanceUnit, days: number(orbit.periodDays) });
}

function renderDiagrams(): void {
  const reference = system.orbits.find(({ id }) => id === "earth") ?? system.orbits[0];
  const axis = chosen ? chosen.axis * Number(size.value) / 100 : 0;
  const e = Number(eccentricity.value) / 100;
  const model = chosen && reference && practice.checked ? { ...chosen, axis, eccentricity: e, periodDays: practicePeriod(axis, reference) } : undefined;
  cycle = model && chosen ? model.periodDays / chosen.periodDays : 1;
  adjust.hidden = model === undefined;
  const modelLine = find("kp-practice-period");
  modelLine.hidden = model === undefined;
  modelLine.textContent = model ? readout(model, "kp_model") : "";
  practice.disabled = chosen === undefined;
  time.disabled = chosen === undefined;
  find("kp-size-value").textContent = `${number(axis)} ${system.distanceUnit}`;
  find("kp-eccentricity-value").textContent = number(e);
  const percentage = new Intl.NumberFormat(lang(), { style: "percent", maximumFractionDigits: 1 }).format(SECTOR_FRACTION);
  find("kp-near").textContent = say("kp_near", { percentage });
  find("kp-far").textContent = say("kp_far", { percentage });
  find("kp-period").textContent = chosen ? readout(chosen, "kp_catalogue") : "";
  drawPlot(model);
  drawSweep(model ?? chosen);
  play.disabled = reduced.matches || chosen === undefined;
  play.textContent = say(playing ? "kp_pause" : "kp_play");
  schedule();
}

function options(): void {
  systemSelect.replaceChildren(...systems.map((one) => new Option(one.name[lang()], one.id)));
  systemSelect.value = system.id;
  const available = system.orbits.map((orbit) => new Option(orbit.name[lang()], orbit.id));
  const other = system.withoutPeriod.map(({ name, reason }) => {
    const option = new Option(say(reason === "open" ? "kp_open" : "kp_missing", { name: name[lang()] }));
    option.disabled = true;
    return option;
  });
  orbitSelect.replaceChildren(...available, ...other);
  orbitSelect.value = chosen?.id ?? "";
  orbitSelect.disabled = chosen === undefined;
}

function choose(orbit: ExplorerOrbit | undefined): void {
  chosen = orbit;
  phase = 0;
  playing = false;
  orbitSelect.value = chosen?.id ?? "";
  renderDiagrams();
}

function schedule(): void {
  const active = playing && visible && !document.hidden && !reduced.matches && chosen !== undefined;
  if (active && frame === 0) frame = requestAnimationFrame(drawNext);
  if (!active) {
    cancelAnimationFrame(frame);
    frame = 0;
    last = undefined;
  }
}

function drawNext(now: number): void {
  frame = 0;
  if (last !== undefined) phase = (phase + Math.min(100, now - last) / (8000 * cycle)) % 1;
  last = now;
  paintPosition();
  schedule();
}

systemSelect.addEventListener("change", () => {
  system = systems.find((one) => one.id === systemSelect.value) ?? systems[0]!;
  choose(system.orbits[0]);
  options();
});
orbitSelect.addEventListener("change", () => choose(system.orbits.find((orbit) => orbit.id === orbitSelect.value)));
plot.addEventListener("click", (event) => {
  const id = (event.target as Element).getAttribute("data-orbit");
  if (id) choose(system.orbits.find((orbit) => orbit.id === id));
});
play.addEventListener("click", () => {
  playing = !playing;
  play.textContent = say(playing ? "kp_pause" : "kp_play");
  schedule();
});
time.addEventListener("input", () => {
  phase = Number(time.value) / 1000;
  paintPosition();
});
for (const control of [practice, size, eccentricity]) control.addEventListener("input", renderDiagrams);
reduced.addEventListener("change", () => {
  if (reduced.matches) playing = false;
  renderDiagrams();
});
document.addEventListener("visibilitychange", schedule);
new IntersectionObserver(([entry]) => {
  visible = entry?.isIntersecting ?? false;
  schedule();
}).observe(sweep);
new ResizeObserver(renderDiagrams).observe(plot);
window.addEventListener("wakusei-language", () => {
  options();
  renderDiagrams();
});
options();
renderDiagrams();
