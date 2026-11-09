// How far a body can be zoomed: where the real detail of its map runs out, and how far its generic detail (noise, see `MICRO_DETAIL`) carries it past that. Pure.
//
// The zoom is relative to the picture: at zoom 1 the body's picture is `extent` radii from the middle to the edge (2.2 for a body alone, the reach of its moons for a moons picture), so the
// disc is `zoom / extent` times as wide as the picture. A map `width` texels round the equator at a disc of `d` CSS pixels shows each texel `pi * d / width` pixels wide. The limit is worked out for
// a picture `REFERENCE_FRAME` CSS pixels across, so it does not depend on the size of the page: the real detail is out when a texel is `SHARP_TEXEL` pixels wide, and the generic detail carries a body
// `GENERIC_REACH` times further (a smooth body, a gas giant's bands or Venus' cloud, further than a rocky one).
import type { BodyLook } from "./look.ts";
import { BASE_WIDTH, type TileLevel } from "./tiles.ts";

/** CSS pixels across the picture a zoom limit is worked out for. */
export const REFERENCE_FRAME = 480;
/** The widest a texel of the map may be, in CSS pixels at the reference frame, while the picture still shows real detail. */
export const SHARP_TEXEL = 1.6;
/** How many times further than the real detail the generic detail carries a body: a rocky or icy one, a smooth one (a gas giant's bands), and a ring system (its strip is a line, so the noise only sharpens it). */
export const GENERIC_REACH = { rocky: 1.15, smooth: 2, rings: 1.25 } as const;
/** No body zooms less than this (what the shaded looks always had), and none more than this. */
export const ZOOM_FLOOR = 8;
export const ZOOM_CEILING = 1000;
/** The width of map a body drawn by its shader alone is counted as: its craters and bands are drawn from numbers at any size, but only so finely. */
export const SHADER_WIDTH = 4096;

/** The widest map a body has, in texels round the equator: the finest tile level, else its widest painted picture, else what its shader counts for. */
export function mapWidthOf(look: BodyLook | undefined, painted: boolean, levels: readonly TileLevel[] | undefined): number {
  if (!painted || look?.painted === undefined) return SHADER_WIDTH;
  const own = look.painted.widths[look.painted.widths.length - 1] ?? BASE_WIDTH;
  const finest = levels?.reduce((width, level) => Math.max(width, level.width), 0) ?? 0;
  return Math.max(own, finest);
}

/**
 * The width of map round the equator that has as many texels to a kilometre as a body's picture of its rings has along a radius: the rings are one line of samples from their inner edge to their outer, so a body that has
 * a picture of them (Saturn) can be zoomed to where the rings' detail runs out, which is further than its globe's. `0` for a body with none.
 */
export function ringWidthOf(look: BodyLook | undefined, radiusKm: number): number {
  const rings = look?.painted?.rings;
  if (rings === undefined || rings.width <= 0 || rings.to <= rings.from) return 0;
  return (2 * Math.PI * radiusKm * rings.width) / (rings.to - rings.from);
}

/**
 * The zoom limit of a body: where its real detail runs out times how far its generic detail carries it, in zoom steps of a picture `extent` radii from the middle to the edge.
 *
 * @param extent - Body radii from the middle of the picture to its edge at zoom 1.
 * @param width - The widest map the body has, in texels round the equator (`mapWidthOf`).
 * @param smooth - True for a body whose surface is soft (a gas giant, Venus, Titan): the generic detail carries it further.
 * @param ringWidth - The equivalent width of the body's picture of its rings (`ringWidthOf`), or 0.
 * @returns The zoom, from `ZOOM_FLOOR` to `ZOOM_CEILING`.
 */
export function zoomLimit(extent: number, width: number, smooth: boolean, ringWidth = 0): number {
  const across = (texels: number): number => (SHARP_TEXEL * texels) / (Math.PI * REFERENCE_FRAME);
  const reach = Math.max(across(width) * (smooth ? GENERIC_REACH.smooth : GENERIC_REACH.rocky), across(ringWidth) * GENERIC_REACH.rings);
  return Math.round(Math.min(ZOOM_CEILING, Math.max(ZOOM_FLOOR, reach * extent)) * 10) / 10;
}
