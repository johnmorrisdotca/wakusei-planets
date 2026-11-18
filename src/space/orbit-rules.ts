// Which orbit lines the space view keeps, and which part of one it lets go, when a body is close (MODULES-1569). Pure: no DOM, no clock, no three.js.

/**
 * Whether an orbit line belongs to the nearest body's own system, so that it is kept when that body is close: the body's own line (the Earth's, round the Sun, passes through the Earth) and, for the Earth and the Moon, the Moon's ring round the Earth.
 *
 * @param id - The body whose orbit line it is.
 * @param nearId - The body that is close, the one the view is about.
 * @returns True when the line is kept in a close view.
 */
export function isOwnLine(id: string, nearId: string): boolean {
  return id === nearId || (id === "moon" && (nearId === "earth" || nearId === "moon"));
}

/**
 * Whether the part of an orbit line near the close body is let go (faded out from 3 radii to 12), so that no line is drawn across the disc. Only a line that passes through the body needs it: a body's own line round the Sun, and the Moon's ring when it is the Moon that is close (the Moon
 * is on it). The Moon's ring round the Earth does not pass through the Earth, and in the squeezed scale it lies 4 to 5 Earth radii out, inside the band, so fading it took the whole ring away when the Earth was close.
 *
 * @param id - The body whose orbit line it is.
 * @param nearId - The body that is close.
 * @param closeUp - Whether the close body's disc is big enough on the screen for the close view.
 * @returns True when the line is faded near the body.
 */
export function fadesNearBody(id: string, nearId: string, closeUp: boolean): boolean {
  if (!closeUp || !isOwnLine(id, nearId)) return false;
  // the Moon's ring round the Earth never meets the Earth
  return !(id === "moon" && nearId === "earth");
}

/**
 * How much of an orbit line's colour is kept at a point of it that is `away` radii of the close body from the body's middle: none within 3 radii and all from 12, a smooth step between.
 *
 * @param away - The distance from the body's middle, in the body's radii.
 * @returns The share of the line's alpha, 0 to 1.
 */
export function nearBodyKeep(away: number): number {
  const t = Math.max(0, Math.min(1, (away - 3) / 9));
  return t * t * (3 - 2 * t);
}
