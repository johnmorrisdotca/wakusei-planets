// The Jupiter chart page: the catalogue's circles, in the language the page is using.
import { jupiterMoonChart, type ChartDot, type JupiterChart } from "../src/jupiter-chart.ts";
import { WORDS } from "./words.js";

const SVG = "http://www.w3.org/2000/svg";
const chart = jupiterMoonChart();

const fill = (text: string, vars: Record<string, string | number>): string => text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));

function language(): "en" | "ja" {
  return document.documentElement.lang === "ja" ? "ja" : "en";
}

function nameOf(dot: ChartDot, lang: "en" | "ja"): string {
  const name = lang === "ja" && dot.ja !== null ? dot.ja : dot.label;
  return dot.estimated ? `${name}*` : name;
}

function draw(lang: "en" | "ja"): void {
  const words = WORDS[lang];
  const count = document.querySelector("#chart-count");
  if (count) count.textContent = fill(words.jc_count, { n: chart.count });
  const source = document.querySelector("#chart-source");
  if (source) source.textContent = fill(words.jc_source, { date: chart.read });
  const legend = document.querySelector("#chart-legend");
  if (legend) {
    legend.replaceChildren(...chart.legend.map((entry) => {
      const item = document.createElement("li");
      const swatch = document.createElement("i");
      swatch.style.background = entry.color;
      const text = document.createElement("span");
      text.textContent = `${lang === "ja" ? entry.names.ja : entry.names.en} ${entry.count}`;
      item.append(swatch, text);
      return item;
    }));
  }
  const host = document.querySelector("#chart");
  if (host) host.replaceChildren(picture(chart, lang));
}

function picture(data: JupiterChart, lang: "en" | "ja"): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${data.width} ${data.height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", "chart-h");
  const planet = document.createElementNS(SVG, "circle");
  planet.setAttribute("cx", String(data.planet.x));
  planet.setAttribute("cy", String(data.planet.y));
  planet.setAttribute("r", String(data.planet.r));
  planet.setAttribute("fill", data.planet.color);
  const planetName = document.createElementNS(SVG, "text");
  planetName.setAttribute("x", String(data.planet.x));
  planetName.setAttribute("y", String(data.planet.y + data.planet.r + 16));
  planetName.setAttribute("text-anchor", "middle");
  planetName.textContent = lang === "ja" ? data.planet.ja : data.planet.en;
  svg.append(planet, planetName);
  const labels: { x: number; y: number; w: number }[] = [];
  labelFits(labels, data.planet.x, data.planet.y + data.planet.r + 16, (lang === "ja" ? data.planet.ja : data.planet.en).length * 6);
  for (const dot of data.dots) {
    const group = document.createElementNS(SVG, "g");
    const family = lang === "ja" ? dot.family.ja : dot.family.en;
    const km = Math.round(dot.diameterKm).toLocaleString("en-CA");
    const tip = document.createElementNS(SVG, "title");
    tip.textContent = `${nameOf(dot, lang)}, ${family}, ${dot.year ?? ""}, ${km} km`;
    const circle = document.createElementNS(SVG, "circle");
    circle.setAttribute("cx", String(dot.x));
    circle.setAttribute("cy", String(dot.y));
    circle.setAttribute("r", String(dot.r));
    circle.setAttribute("fill", dot.color);
    circle.setAttribute("data-moon", dot.id);
    const big = dot.r >= 14;
    const caption = big ? nameOf(dot, lang) : `${dot.year ?? ""}${dot.estimated ? "*" : ""}`;
    if (caption !== "" && caption !== "*" && labelFits(labels, dot.x, big ? dot.y + dot.r + 11 : dot.y - dot.r - 3, caption.length * 5.4)) {
      const text = document.createElementNS(SVG, "text");
      text.setAttribute("x", String(dot.x));
      text.setAttribute("y", String(big ? dot.y + dot.r + 11 : dot.y - dot.r - 3));
      text.setAttribute("text-anchor", "middle");
      text.textContent = caption;
      group.append(circle, tip, text);
    } else group.append(circle, tip);
    svg.append(group);
  }
  return svg;
}

/** A label is drawn only when its line does not cross one already placed. */
function labelFits(placed: { x: number; y: number; w: number }[], x: number, y: number, width: number): boolean {
  const box = { x, y, w: width };
  const hit = placed.some((other) => Math.abs(other.y - y) < 11 && Math.abs(other.x - x) < (other.w + width) / 2 + 4);
  if (!hit) placed.push(box);
  return !hit;
}

draw(language());
window.addEventListener("wakusei-language", (event) => {
  const lang = (event as CustomEvent<{ lang?: string }>).detail?.lang;
  draw(lang === "ja" ? "ja" : "en");
});
