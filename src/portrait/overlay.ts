// What is drawn over and under the bodies of a portrait, as plain shapes: the sky behind them (a few hundred stars, always the same ones), the rings of the moons' orbits, the names, and, while
// editing, the chosen body's outline and the guides. The same shapes become an SVG overlay on the page and 2D canvas strokes in an exported picture, so the two always agree. Pure: no DOM.
import { BODIES, type BodyId, type Look } from "../facts.ts";
import { lineSvg } from "../line.ts";
import { toScreen, type Background, type Guide, type Placed, type Portrait, type Resolved } from "./model.ts";

export interface Shapes {
  circles: { cx: number; cy: number; r: number; kind: "orbit" | "select" }[];
  lines: { x1: number; y1: number; x2: number; y2: number }[];
  texts: { x: number; y: number; text: string; size: number }[];
}

export interface Star {
  x: number;
  y: number;
  /** Radius as a fraction of the picture's height. */
  r: number;
  a: number;
}

/** The sky's stars: the same ones every time, so a picture and its export agree. */
export function starfield(count = 140): Star[] {
  let seed = 20261103;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const big = next() > 0.9;
    return { x: next(), y: next(), r: big ? 0.0016 : 0.0008 + next() * 0.0006, a: 0.35 + next() * 0.65 };
  });
}

const STARS = starfield();

/** The CSS behind the picture for a background (the stars are separate gradients, so the page draws them without a script). */
export function backgroundCss(bg: Background): string {
  if (bg === "transparent") return "transparent";
  if (bg === "gradient") return "radial-gradient(120% 140% at 30% 20%, #1c3358 0%, #0d1a33 55%, #050914 100%)";
  if (bg === "black") return "#000";
  const dots = STARS.map((s) => `radial-gradient(${(s.r * 1000).toFixed(1)}px ${(s.r * 1000).toFixed(1)}px at ${(s.x * 100).toFixed(2)}% ${(s.y * 100).toFixed(2)}%, rgba(255,255,255,${s.a.toFixed(2)}), transparent)`);
  return `${dots.join(",")},radial-gradient(100% 120% at 50% 40%, #07101f 0%, #000 100%)`;
}

/** Paint the background onto a 2D canvas the size of the picture. */
export function paintBackground(ctx: CanvasRenderingContext2D, bg: Background, width: number, height: number): void {
  if (bg === "transparent") return;
  if (bg === "gradient") {
    const g = ctx.createRadialGradient(width * 0.3, height * 0.2, 0, width * 0.3, height * 0.2, Math.max(width, height) * 1.1);
    g.addColorStop(0, "#1c3358");
    g.addColorStop(0.55, "#0d1a33");
    g.addColorStop(1, "#050914");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (bg === "black") {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const g = ctx.createRadialGradient(width / 2, height * 0.4, 0, width / 2, height * 0.4, Math.max(width, height) * 0.8);
  g.addColorStop(0, "#07101f");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  for (const s of STARS) {
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.beginPath();
    ctx.arc(s.x * width, s.y * height, Math.max(0.5, s.r * 1000), 0, Math.PI * 2);
    ctx.fill();
  }
}

const labelSize = (width: number): number => Math.max(11, Math.min(15, width / 60));

/** The orbit rings and the names for a picture of this size, and the selected body's outline and the guides when asked. */
export function shapesOf(p: Portrait, resolved: Resolved, width: number, height: number, lang: "en" | "ja" = "en", edit?: { selected?: number; guides?: readonly Guide[] }): Shapes {
  const at = toScreen(resolved.camera, width, height);
  const out: Shapes = { circles: [], lines: [], texts: [] };
  const byBody = new Map<BodyId, Placed>(resolved.placed.map((q) => [q.body, q]));
  if (p.orbits) {
    const sun = p.arrange === "orbit" ? byBody.get("sun") : undefined;
    for (const moon of resolved.placed) {
      const host = BODIES[moon.body].parent === undefined ? (moon.body === "sun" ? undefined : sun) : byBody.get(BODIES[moon.body].parent as BodyId);
      if (host === undefined) continue;
      const d = Math.hypot(moon.x - host.x, moon.y - host.y) * at.scale;
      if (d > 2) out.circles.push({ cx: at.px(host.x), cy: at.py(host.y), r: d, kind: "orbit" });
    }
  }
  if (p.labels) {
    const size = labelSize(width);
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const q of resolved.placed) {
      const text = BODIES[q.body].name[lang];
      const w = [...text].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.58), 0);
      const x = at.px(q.x);
      const y = at.py(q.y) + Math.max(q.r * at.scale, 2) + size * 1.25;
      const box = { x0: x - w / 2, x1: x + w / 2, y0: y - size, y1: y + size * 0.3 };
      if (box.x0 < 0 || box.x1 > width || box.y1 > height + size) continue;
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      out.texts.push({ x, y, text, size });
    }
  }
  if (edit?.selected !== undefined) {
    const q = resolved.placed[edit.selected];
    if (q !== undefined) out.circles.push({ cx: at.px(q.x), cy: at.py(q.y), r: Math.max(q.r * at.scale, 5) + 5, kind: "select" });
  }
  for (const g of edit?.guides ?? []) out.lines.push(g.axis === "x" ? { x1: at.px(g.at), y1: 0, x2: at.px(g.at), y2: height } : { x1: 0, y1: at.py(g.at), x2: width, y2: at.py(g.at) });
  return out;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n: number): string => (Math.round(n * 100) / 100).toString();

/** The shapes as SVG elements (no wrapper), in the picture's pixels. */
export function shapesSvg(s: Shapes): string {
  const circles = s.circles.map((c) => (c.kind === "orbit" ? `<circle cx="${f(c.cx)}" cy="${f(c.cy)}" r="${f(c.r)}" fill="none" stroke="#9fb4d6" stroke-opacity="0.45" stroke-width="1"/>` : `<circle cx="${f(c.cx)}" cy="${f(c.cy)}" r="${f(c.r)}" fill="none" stroke="#6ab7ff" stroke-width="2" stroke-dasharray="5 4"/>`));
  const lines = s.lines.map((l) => `<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}" stroke="#ff5fa8" stroke-width="1" stroke-dasharray="4 3"/>`);
  const texts = s.texts.map((t) => `<text x="${f(t.x)}" y="${f(t.y)}" font-size="${f(t.size)}" text-anchor="middle" font-family="system-ui,sans-serif" fill="#f2f6ff" stroke="#050914" stroke-width="3" stroke-opacity="0.8" paint-order="stroke" stroke-linejoin="round">${esc(t.text)}</text>`);
  return [...circles, ...lines, ...texts].join("");
}

/** The shapes on a 2D canvas. */
export function drawShapes(ctx: CanvasRenderingContext2D, s: Shapes, ratio = 1): void {
  ctx.save();
  ctx.scale(ratio, ratio);
  for (const c of s.circles) {
    ctx.beginPath();
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
    if (c.kind === "orbit") {
      ctx.strokeStyle = "rgba(159,180,214,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = "#6ab7ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
    }
    ctx.stroke();
  }
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#ff5fa8";
  ctx.lineWidth = 1;
  for (const l of s.lines) {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const t of s.texts) {
    ctx.font = `${t.size}px system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5,9,20,0.8)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = "#f2f6ff";
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

/**
 * The portrait in the line look: one SVG, the bodies drawn one over another in the order of the list, each as a nested picture sized so its disc has the radius the layout gave it.
 * Anything a body's rings or glow need past the disc is inside its own picture.
 */
export function lineScene(p: Portrait, resolved: Resolved, width: number, height: number, poses: readonly import("../ephemeris.ts").Pose[], lang: "en" | "ja" = "en"): string {
  const at = toScreen(resolved.camera, width, height);
  const dark = p.bg !== "transparent";
  const stroke = dark ? undefined : "#33415c";
  const parts: string[] = [];
  resolved.placed.forEach((q, i) => {
    const facts = BODIES[q.body];
    const reach = Math.max(facts.rings === undefined ? 1 : Math.max(...facts.rings.map((b) => b.to)) / facts.radiusKm, q.body === "sun" ? 1.08 : 1);
    const fill = 0.94 / reach;
    const rPx = Math.max(q.r * at.scale, 1.2);
    const side = (2 * rPx) / fill;
    const inner = lineSvg(q.body as Parameters<typeof lineSvg>[0], { size: 480, fill, labels: false, pose: poses[i]!, lang, ...(stroke !== undefined ? { stroke } : {}) });
    const nested = inner.replace(/^<svg [^>]*>/, () => `<svg x="${f(at.px(q.x) - side / 2)}" y="${f(at.py(q.y) - side / 2)}" width="${f(side)}" height="${f(side)}" viewBox="0 0 480 480" role="img" aria-label="${esc(facts.name[lang])}" overflow="hidden">`);
    parts.push(nested);
  });
  return parts.join("");
}

export type { Look };
