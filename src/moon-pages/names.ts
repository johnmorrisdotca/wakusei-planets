// Where each moon's name sits on the orbit picture. The name starts just outside the dot, away from the planet, and steps aside when another name is already there.

export interface OrbitNameSpot {
  id: string;
  x: number;
  y: number;
  text: string;
}

/** A placed name. `x` and `y` are the start of the baseline, in the picture's own units. */
export interface PlacedOrbitName {
  id: string;
  x: number;
  y: number;
  text: string;
}

const hits = (box: { x: number; y: number; w: number; h: number }, taken: readonly { x: number; y: number; w: number; h: number }[]): boolean =>
  taken.some((other) => box.x < other.x + other.w && box.x + box.w > other.x && box.y < other.y + other.h && box.y + box.h > other.y);

/**
 * Place one name beside each moon. `font` is the text size in the same units as the points. Outer moons are placed first, where there is more room. A name that cannot find a gap keeps the first spot, as on a crowded chart.
 */
export function placeOrbitNames(spots: readonly OrbitNameSpot[], font: number): PlacedOrbitName[] {
  const size = Math.max(font, 1);
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const order = [...spots].sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y));
  const out: PlacedOrbitName[] = [];
  for (const spot of order) {
    const w = Math.max(size, spot.text.length * size * 0.55);
    const h = size;
    const dist = Math.hypot(spot.x, spot.y) || 1;
    const candidates: [number, number][] = [[spot.x + (spot.x / dist) * size, spot.y + (spot.y / dist) * size]];
    for (let step = 1; step <= 5; step += 1) {
      for (let turn = 0; turn < 8; turn += 1) {
        const angle = (turn / 8) * Math.PI * 2 + step;
        candidates.push([spot.x + Math.cos(angle) * size * step * 1.6, spot.y + Math.sin(angle) * size * step * 1.6]);
      }
    }
    let chosen = candidates[0]!;
    for (const [x, y] of candidates) {
      if (!hits({ x, y: y - h, w, h }, taken)) {
        chosen = [x, y];
        break;
      }
    }
    taken.push({ x: chosen[0], y: chosen[1] - h, w, h });
    out.push({ id: spot.id, x: chosen[0], y: chosen[1], text: spot.text });
  }
  return out;
}
