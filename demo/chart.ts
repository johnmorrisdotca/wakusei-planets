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
      text.textContent = fill(words.jc_legend, { name: lang === "ja" ? entry.names.ja : entry.names.en, n: entry.count });
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
  const drawn = document.querySelector("#chart")?.clientWidth ?? 0;
  const font = (11 * data.width) / (drawn > 0 ? drawn : 360);
  svg.setAttribute("font-size", String(Math.round(font * 10) / 10));
  const words = WORDS[lang];
  const planet = document.createElementNS(SVG, "circle");
  planet.setAttribute("cx", String(data.planet.x));
  planet.setAttribute("cy", String(data.planet.y));
  planet.setAttribute("r", String(data.planet.r));
  planet.setAttribute("fill", data.planet.color);
  const planetName = document.createElementNS(SVG, "text");
  const planetLabel = lang === "ja" ? data.planet.ja : data.planet.en;
  planetName.setAttribute("x", String(data.planet.x));
  planetName.setAttribute("y", String(data.planet.y + data.planet.r + font));
  planetName.setAttribute("text-anchor", "middle");
  planetName.textContent = planetLabel;
  svg.append(planet, planetName);
  const labels: { x: number; y: number; w: number; h: number }[] = [];
  const planetCircle = { x: data.planet.x, y: data.planet.y, r: data.planet.r };
  const moonCircles = data.dots.map((dot) => ({ x: dot.x, y: dot.y, r: dot.r }));
  const circles = [planetCircle, ...moonCircles];
  labelFits(labels, circles, planetCircle, data.planet.x, data.planet.y + data.planet.r + font, textWidth(planetLabel, lang, font), font, false);
  for (const [index, dot] of data.dots.entries()) {
    const group = document.createElementNS(SVG, "g");
    const family = lang === "ja" ? dot.family.ja : dot.family.en;
    const km = Math.round(dot.diameterKm).toLocaleString("en-CA");
    const tip = document.createElementNS(SVG, "title");
    tip.textContent = tipOf(words.jc_tip, lang, nameOf(dot, lang), family, dot.year, km);
    const circle = document.createElementNS(SVG, "circle");
    circle.setAttribute("cx", String(dot.x));
    circle.setAttribute("cy", String(dot.y));
    circle.setAttribute("r", String(dot.r));
    circle.setAttribute("fill", dot.color);
    circle.setAttribute("data-moon", dot.id);
    const big = dot.r >= 14;
    const caption = big ? nameOf(dot, lang) : yearCaption(dot, lang);
    const y = big ? dot.y + dot.r + font + 8 : dot.y - dot.r - font * 0.45 - 8;
    if (caption !== "" && caption !== "*" && labelFits(labels, circles, moonCircles[index]!, dot.x, y, textWidth(caption, lang, font), font, !big)) {
      const text = document.createElementNS(SVG, "text");
      text.setAttribute("x", String(dot.x));
      text.setAttribute("y", String(y));
      text.setAttribute("text-anchor", "middle");
      text.textContent = caption;
      group.append(circle, tip, text);
    } else group.append(circle, tip);
    svg.append(group);
  }
  return svg;
}

/** The tooltip word, with the year left out when the moon has none, so no empty comma remains. */
function tipOf(pattern: string, lang: "en" | "ja", name: string, family: string, year: number | null, km: string): string {
  const text = year === null ? (lang === "ja" ? pattern.replace("、{year}年", "") : pattern.replace(", {year}", "")) : pattern;
  return fill(text, { name, family, year: year ?? "", km });
}

function yearCaption(dot: ChartDot, lang: "en" | "ja"): string {
  const year = dot.year === null ? "" : lang === "ja" ? `${dot.year}年` : String(dot.year);
  return `${year}${dot.estimated ? "*" : ""}`;
}

/** A Japanese glyph is about twice a Latin letter at the same size. The 5.4 is the Latin width at a 10-unit font. */
function textWidth(text: string, lang: "en" | "ja", font: number): number {
  return text.length * (lang === "ja" ? 12 : 5.4) * (font / 10);
}

/** A label is drawn only when it touches neither another label nor a circle. A year that would sit across a row of moons is left off. */
function labelFits(placed: { x: number; y: number; w: number; h: number }[], circles: { x: number; y: number; r: number }[], own: { x: number; y: number; r: number }, x: number, y: number, width: number, line: number, year: boolean): boolean {
  const top = y - line * 0.9;
  const bottom = y + line * 0.25;
  const left = x - width / 2;
  const right = x + width / 2;
  const pad = year ? line * 0.85 : 4;
  const hitsLabel = placed.some((other) => Math.abs(other.y - y) < (other.h + line) / 2 && Math.abs(other.x - x) < (other.w + width) / 2 + 6);
  const hitsCircle = circles.some((circle) => {
    if (circle === own) return false;
    const nearestX = Math.min(Math.max(circle.x, left), right);
    const nearestY = Math.min(Math.max(circle.y, top), bottom);
    return (nearestX - circle.x) ** 2 + (nearestY - circle.y) ** 2 < (circle.r + pad) ** 2;
  });
  if (hitsLabel || hitsCircle) return false;
  placed.push({ x, y, w: width, h: line });
  return true;
}

let drawnWidth = -1;
function paint(): void {
  const width = document.querySelector("#chart")?.clientWidth ?? 0;
  drawnWidth = width;
  draw(language());
}
paint();
window.addEventListener("wakusei-language", (event) => {
  const lang = (event as CustomEvent<{ lang?: string }>).detail?.lang;
  drawnWidth = -1;
  draw(lang === "ja" ? "ja" : "en");
});
const chartBox = document.querySelector("#chart");
if (chartBox) {
  new ResizeObserver(() => {
    const width = chartBox.clientWidth;
    if (width === drawnWidth) return;
    paint();
  }).observe(chartBox);
}
