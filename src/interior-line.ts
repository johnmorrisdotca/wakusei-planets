// Front-on sections for the line look. Animation is a phase passed in by the caller.
import type { Interior } from "./interior.ts";

const tau = Math.PI * 2;
const short = (value: number): string => (Math.round(value * 100) / 100).toString();

export function interiorRings(interior: Interior, size: number, cx: number, cy: number, radius: number, seconds: number): string {
  const shapes: string[] = [];
  let inner = 0;
  for (const layer of interior.layers) {
    const outer = layer.outerKm / interior.radiusKm;
    const r = radius * outer;
    const inset = radius * inner;
    const top = cy - r;
    const disk = `M${short(cx)} ${short(top)}a${short(r)} ${short(r)} 0 1 1 0 ${short(2 * r)}a${short(r)} ${short(r)} 0 1 1 0 ${short(-2 * r)}Z`;
    const path = inner === 0 ? disk : disk +
      `M${short(cx)} ${short(cy - inset)}a${short(inset)} ${short(inset)} 0 1 1 0 ${short(2 * inset)}a${short(inset)} ${short(inset)} 0 1 1 0 ${short(-2 * inset)}Z`;
    shapes.push(`<path data-layer="${layer.id}" fill="${layer.colour}" fill-rule="evenodd" d="${path}"/>`);
    if (layer.flow === true) {
      const band = outer - inner;
      for (const fraction of [0.27, 0.50, 0.73]) {
        const points = [];
        const time = seconds * (0.25 + 0.4 * (1 - fraction));
        for (let step = 0; step < 64; step++) {
          const angle = step / 64 * tau;
          const wave = 0.095 * Math.sin(3 * angle - time * 3 + fraction * 6)
            + 0.045 * Math.sin(7 * angle - time * 5 + fraction * 2);
          const distance = radius * (inner + band * (fraction + wave));
          points.push(`${short(cx + distance * Math.cos(angle))} ${short(cy - distance * Math.sin(angle))}`);
        }
        shapes.push(`<path data-flow="" fill="none" stroke="#fff4e4" stroke-opacity=".33" stroke-width="${short(Math.min(size / 160, radius * band * 0.06))}" d="M${points.join("L")}Z"/>`);
      }
    }
    inner = outer;
  }
  if (interior.body === "earth") {
    for (const [distance, angle, width, height] of [[.953, .84, .050, .009], [.955, 2.2, .037, .007], [.944, -1, .035, .010]] as const) {
      const x = short(cx + radius * distance * Math.cos(angle));
      const y = short(cy - radius * distance * Math.sin(angle));
      shapes.push(`<ellipse data-magma="" cx="${x}" cy="${y}" rx="${short(radius * width)}" ry="${short(radius * height)}" transform="rotate(${short(90 - angle * 180 / Math.PI)} ${x} ${y})" fill="#ffc34b"/>`);
    }
  }
  return shapes.join("");
}
