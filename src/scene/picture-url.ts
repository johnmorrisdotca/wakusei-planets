import type { PaintedMap } from "./look.ts";

/**
 * The address of one map width.
 * A width at or above `far` is not in the near folder. It is asked of the far folder when that folder is a different one, and otherwise the widest width the near folder does hold.
 */
export function pictureUrl(near: string, far: string, map: Pick<PaintedMap, "map" | "widths" | "far">, width: number): string {
  const mark = map.far;
  const wide = mark !== undefined && width >= mark;
  if (wide && far !== near) return `${far}${map.map}-${width}.webp`;
  const held = wide ? map.widths.filter((w) => w < mark!).at(-1) ?? width : width;
  return `${near}${map.map}-${held}.webp`;
}
