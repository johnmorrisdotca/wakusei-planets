import { SPACECRAFT, spacecraftPosition, type SpacecraftId } from "./spacecraft.ts";
import type { Vec3 } from "./vec.ts";

const AU_KM = 149_597_870.7;

/** The heliocentric place in au, when the craft's path covers the date and has been loaded. */
export function craftPositionAu(id: SpacecraftId, ms: number): Vec3 | undefined {
  const { start, end } = SPACECRAFT[id].record;
  if (end === 0 || ms < start || ms > end) return undefined;
  try {
    const [x, y, z] = spacecraftPosition(id, ms);
    return [x / AU_KM, y / AU_KM, z / AU_KM];
  } catch {
    return undefined;
  }
}

/** Sample both ends of a time interval and the evenly spaced points between them. */
export function sampleCraftPath(id: SpacecraftId, start: number, end: number, steps: number): { x: number; y: number; ms: number }[] {
  const points: { x: number; y: number; ms: number }[] = [];
  for (let k = 0; k <= steps; k += 1) {
    const ms = start + ((end - start) * k) / steps;
    const position = craftPositionAu(id, ms);
    if (position !== undefined) points.push({ x: position[0], y: position[1], ms });
  }
  return points;
}

/** One ecliptic polyline per continuous stretch of the loaded path. At a join the fit switches to the next solution. */
export function craftTrack(id: SpacecraftId, count = 300): ReturnType<typeof sampleCraftPath>[] {
  const { record, joins } = SPACECRAFT[id];
  const { start, end } = record;
  if (end === 0) return [];
  const starts = [start, ...joins.map(({ date }) => date)];
  return starts.map((first, i) => {
    const next = starts[i + 1];
    const last = next === undefined ? end : next - 1;
    const steps = Math.max(1, Math.round(count * (last - first) / (end - start)));
    return sampleCraftPath(id, first, last, steps);
  }).filter((points) => points.length > 0);
}
