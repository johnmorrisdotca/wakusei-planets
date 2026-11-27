import type { CatalogueMoon, MoonGroup } from "./moon-catalogue.ts";

export const MOON_FILTER_GROUPS: readonly MoonGroup[] = [
  "inner", "major", "regular", "themisto", "himalia", "carpo", "valetudo", "ananke", "carme", "pasiphae",
  "inuit", "gallic", "norse", "prograde", "retrograde", "none",
];

export const MOON_FILTER_ATTRIBUTES = ["moon-status", "moon-size-class", "moon-group", "moon-direction", "moon-discovered"] as const;

/**
 * A named moon takes precedence over its number. A moon with neither is listed by its provisional designation.
 * @example
 * ```ts
 * import type { MoonStatus } from "@johnmorrisdotca/wakusei-planets/element";
 * const status: MoonStatus = "provisional";
 * console.log(status);
 * ```
 */
export type MoonStatus = "named" | "numbered" | "provisional";

/**
 * A major moon has a full rendering. Other moons can have a measured or an estimated radius.
 * @example
 * ```ts
 * import type { MoonSizeClass } from "@johnmorrisdotca/wakusei-planets/element";
 * const size: MoonSizeClass = "major";
 * console.log(size);
 * ```
 */
export type MoonSizeClass = "major" | "measured" | "estimated";

/**
 * A moon's orbit can follow the planet's turn or run against it.
 * @example
 * ```ts
 * import type { MoonDirection } from "@johnmorrisdotca/wakusei-planets/element";
 * const direction: MoonDirection = "retrograde";
 * console.log(direction);
 * ```
 */
export type MoonDirection = "prograde" | "retrograde";

/**
 * Discovery years, inclusive at both ends. An omitted endpoint leaves the range open on that end.
 * @example
 * ```ts
 * import type { MoonDiscoveryRange } from "@johnmorrisdotca/wakusei-planets/element";
 * const discovered: MoonDiscoveryRange = { to: 1610 };
 * console.log(discovered.to);
 * ```
 */
export interface MoonDiscoveryRange {
  from?: number;
  to?: number;
}

/**
 * Every chosen filter must match. Omit a field to include every value for it.
 * @example
 * ```ts no-run
 * import type { MoonFilter, WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
 * const filter: MoonFilter = { group: "himalia", discovered: { from: 1900 } };
 * document.querySelector<WakuseiBody>("wakusei-body")!.moonFilter = filter;
 * ```
 */
export interface MoonFilter {
  status?: MoonStatus;
  size?: MoonSizeClass;
  group?: MoonGroup;
  direction?: MoonDirection;
  discovered?: MoonDiscoveryRange;
}

const STATUSES: readonly MoonStatus[] = ["named", "numbered", "provisional"];
const SIZES: readonly MoonSizeClass[] = ["major", "measured", "estimated"];
const DIRECTIONS: readonly MoonDirection[] = ["prograde", "retrograde"];

function choice<T extends string>(value: string | null | undefined, allowed: readonly T[]): T | undefined {
  const word = typeof value === "string" ? value.trim().toLowerCase() : undefined;
  return allowed.find((item) => item === word);
}

function year(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Normalize choices from JS and markup so a missing or malformed value clears just its field. */
export function normalizeMoonFilter(value: MoonFilter | null | undefined): MoonFilter {
  const status = choice(value?.status, STATUSES);
  const size = choice(value?.size, SIZES);
  const group = choice(value?.group, MOON_FILTER_GROUPS);
  const direction = choice(value?.direction, DIRECTIONS);
  const from = year(value?.discovered?.from);
  const to = year(value?.discovered?.to);
  return {
    ...(status === undefined ? {} : { status }),
    ...(size === undefined ? {} : { size }),
    ...(group === undefined ? {} : { group }),
    ...(direction === undefined ? {} : { direction }),
    ...(from === undefined && to === undefined ? {} : { discovered: { from, to } }),
  };
}

/** Read the view's filter attributes. A single year is exact; `2000..` and `..2026` leave one endpoint open. */
export function readMoonFilter(element: Pick<Element, "getAttribute">): MoonFilter {
  const text = element.getAttribute("moon-discovered")?.trim() ?? "";
  const range = /^(\d*)\.\.(\d*)$/.exec(text);
  const exact = /^\d+$/.test(text) ? Number(text) : undefined;
  return normalizeMoonFilter({
    status: choice(element.getAttribute("moon-status"), STATUSES),
    size: choice(element.getAttribute("moon-size-class"), SIZES),
    group: choice(element.getAttribute("moon-group"), MOON_FILTER_GROUPS),
    direction: choice(element.getAttribute("moon-direction"), DIRECTIONS),
    discovered: range === null ? { from: exact, to: exact } : { from: Number(range[1]), to: Number(range[2]) },
  });
}

/** The attributes that represent these choices, in the same order as the controls. */
export function moonFilterAttributes(value: MoonFilter | undefined): [string, string][] {
  const { status, size, group, direction, discovered } = normalizeMoonFilter(value);
  const attributes: [string, string][] = [];
  if (status !== undefined) attributes.push(["moon-status", status]);
  if (size !== undefined) attributes.push(["moon-size-class", size]);
  if (group !== undefined) attributes.push(["moon-group", group]);
  if (direction !== undefined) attributes.push(["moon-direction", direction]);
  if (discovered !== undefined) attributes.push(["moon-discovered", `${discovered.from ?? ""}..${discovered.to ?? ""}`]);
  return attributes;
}

/**
 * The current IAU naming status recorded for a moon.
 * @param moon - The catalogue row, or its name flag and assigned number.
 * @returns The most advanced naming status recorded in the row.
 * @example
 * ```ts
 * import { findCatalogueMoon, moonStatus } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 * console.log(moonStatus(findCatalogueMoon("Himalia")!));
 * ```
 */
export function moonStatus(moon: Pick<CatalogueMoon, "named" | "number">): MoonStatus {
  if (moon.named) return "named";
  return moon.number === null ? "provisional" : "numbered";
}

/**
 * Size classes use the full rendering and the source of the catalogue radius.
 * @param moon - The catalogue row, or its full rendering flag and radius source.
 * @returns Its size class, or `undefined` for a small moon with only a data-sheet radius or no radius.
 * @example
 * ```ts
 * import { findCatalogueMoon, moonSizeClass } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";
 * console.log(moonSizeClass(findCatalogueMoon("Himalia")!));
 * ```
 */
export function moonSizeClass(moon: Pick<CatalogueMoon, "full" | "radiusFrom">): MoonSizeClass | undefined {
  if (moon.full) return "major";
  if (moon.radiusFrom === "measured") return "measured";
  return moon.radiusFrom === "derived" ? "estimated" : undefined;
}

/** The filter applied by the catalogue, list and the two renderers. */
export function moonMatches(moon: CatalogueMoon, filter: MoonFilter): boolean {
  if (filter.status !== undefined && moonStatus(moon) !== filter.status) return false;
  if (filter.size !== undefined && moonSizeClass(moon) !== filter.size) return false;
  if (filter.group !== undefined && moon.group !== filter.group) return false;
  if (filter.direction !== undefined && moon.retrograde !== (filter.direction === "retrograde")) return false;
  const range = filter.discovered;
  const discovered = moon.discovery.year;
  return range === undefined || (discovered !== null && discovered >= (range.from ?? -Infinity) && discovered <= (range.to ?? Infinity));
}
