// How faint the space view draws its orbit lines, and which line is under the pointer. Pure: no DOM, no clock, no three.js.

/** Up to this many lines drawn, none is made fainter for the crowd. */
export const FEW_LINES = 12;
/** The least share of its opacity a line keeps, however many are drawn and however far out the view is. */
export const LEAST_KEEP = 0.15;
/** The view is "near" at this many radii of the body it looks at, and "far out" at the second: the share of opacity falls between them on a log scale (the Earth and the Moon from a few hundred radii, the inner planets from the Sun a thousand, the whole system from the Earth a million). */
export const NEAR_RADII = 30;
export const FAR_RADII = 30_000;
/** How much of a line's opacity the farthest view takes away. */
export const FAR_LOSS = 0.5;

/**
 * How far out the view is: 0 within `NEAR_RADII` of the body it looks at, 1 from `FAR_RADII`, and the log of the distance between.
 *
 * @param radii - The camera's distance from the body looked at, in that body's radii.
 * @returns A number from 0 to 1.
 */
export function outnessOf(radii: number): number {
  if (!(radii > NEAR_RADII)) return 0;
  return Math.min(1, Math.log(radii / NEAR_RADII) / Math.log(FAR_RADII / NEAR_RADII));
}

/**
 * The share of its opacity an orbit line keeps: all of it while few lines are drawn and the view is near, less as more are drawn (by the square root of how many times over `FEW_LINES` they are) and as the view goes out, never under `LEAST_KEEP`.
 *
 * @param input - `crowd`, how many lines are drawn, and `outness`, from `outnessOf`.
 * @returns The share, from `LEAST_KEEP` to 1.
 */
export function lineKeep(input: { crowd: number; outness: number }): number {
  const crowded = input.crowd > FEW_LINES ? Math.sqrt(FEW_LINES / input.crowd) : 1;
  const far = 1 - FAR_LOSS * Math.max(0, Math.min(1, input.outness));
  return Math.max(LEAST_KEEP, crowded * far);
}

/**
 * The opacity to draw an orbit line at.
 *
 * @param input - `base`, the opacity the kind of line has when it is alone, and what `lineKeep` takes.
 * @returns The opacity, from `base * LEAST_KEEP` to `base`.
 */
export const lineAlpha = (input: { base: number; crowd: number; outness: number }): number => input.base * lineKeep(input);

/** An orbit line as the screen shows it: `xy` is its points as x, y, x, y in CSS pixels, with NaN, NaN where the line is behind the camera (the line is broken there). */
export interface ScreenLine {
  /** The view's key of the body the line is of (`moon`, `mars`, a catalogue moon's key, a craft's id). */
  id: string;
  /** `#rrggbb`. */
  colour: string;
  xy: ArrayLike<number>;
}

/**
 * How many lines have some of their length in the picture: a line counts when one of its segments has the box it lies in over the picture (a long segment that only crosses a corner counts too).
 *
 * @param lines - The lines, in CSS pixels.
 * @param width - The picture's width, in CSS pixels.
 * @param height - The picture's height.
 * @returns The number of lines in the picture.
 */
export function linesInView(lines: readonly ScreenLine[], width: number, height: number): number {
  let count = 0;
  for (const line of lines) {
    const p = line.xy;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!;
      const bx = p[i + 2]!;
      if (ax !== ax || bx !== bx) continue;
      const ay = p[i + 1]!;
      const by = p[i + 3]!;
      if (Math.max(ax, bx) >= 0 && Math.min(ax, bx) <= width && Math.max(ay, by) >= 0 && Math.min(ay, by) <= height) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

/**
 * The line nearest a point of the screen, within a distance. Each line is first measured by the box its points lie in (the box grown by the distance), and only a line the point is in the box of has its segments measured.
 *
 * @param lines - The lines on the screen.
 * @param pointer - The point, in CSS pixels.
 * @param tolerance - The farthest a line may be from the point, in CSS pixels.
 * @returns The nearest line, or `null` when none is within the distance.
 */
export function nearestLine(lines: readonly ScreenLine[], pointer: { x: number; y: number }, tolerance: number): ScreenLine | null {
  const { x, y } = pointer;
  let best: ScreenLine | null = null;
  let bestD = tolerance;
  for (const line of lines) {
    const p = line.xy;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < p.length; i += 2) {
      const px = p[i]!;
      const py = p[i + 1]!;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    if (x < minX - bestD || x > maxX + bestD || y < minY - bestD || y > maxY + bestD) continue;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!;
      const ay = p[i + 1]!;
      const bx = p[i + 2]!;
      const by = p[i + 3]!;
      if (ax !== ax || bx !== bx) continue;
      const dx = bx - ax;
      const dy = by - ay;
      const length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      if (d <= bestD) {
        best = line;
        bestD = d;
      }
    }
  }
  return best;
}
