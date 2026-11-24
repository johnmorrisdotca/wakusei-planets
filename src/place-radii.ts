// Volume-equivalent mean radii for the place bodies that are not in BODIES. The extents are the published full lengths, two when the source gives two. accuracyKm uses only those extents.

/** One irregular body a distance can be measured on: a volume-equivalent mean radius, and the published full extents when the source gives them. */
export interface PlaceMeanRadius {
  /** The radius of the sphere with the body's measured volume, in kilometres. */
  radiusKm: number;
  /** The published full extents in kilometres, longest first. Absent when the source gives none. */
  axesKm?: readonly [number, number] | readonly [number, number, number];
  /** Where the radius and the extents were read. */
  source: string;
  /** A fact that is not a shape bound. */
  note?: string;
}

/**
 * The five place bodies `BODIES` has no radius for. Read 2026-11-19, one request a second, from JPL's Small-Body Database except Dimorphos, which is not in it.
 *
 * Ryugu: diameter 0.896 ± 0.004 km, extents 1.004 × 0.876 km, two axes (Watanabe et al. 2019).
 * Bennu: diameter 0.48444 ± 0.00030 km, extents 0.5047 × 0.4918 × 0.4567 km (Daly et al. 2020).
 * Dimorphos: volume-equivalent diameter 151 ± 5 m, extents 177 ± 2 × 174 ± 4 × 116 ± 2 m (Daly et al., Nature 2023). The volume is the shape model's, not an ellipsoid of those extents.
 * Tempel 1: diameter 6.0 ± 0.2 km, extents 7.6 × 4.9 km, two axes, preliminary (A'Hearn et al. 2005).
 * 67P: diameter 3.4 ± 0.1 km (Sierks et al. 2015). No extents.
 */
export const PLACE_MEAN_RADII = {
  ryugu: { radiusKm: 0.448, axesKm: [1.004, 0.876], source: "JPL SBDB, Watanabe et al. 2019", note: "Two extents only." },
  bennu: { radiusKm: 0.24222, axesKm: [0.5047, 0.4918, 0.4567], source: "JPL SBDB, Daly et al. 2020" },
  dimorphos: { radiusKm: 0.0755, axesKm: [0.177, 0.174, 0.116], source: "Daly et al., Nature 2023" },
  "tempel-1": { radiusKm: 3, axesKm: [7.6, 4.9], source: "JPL SBDB, A'Hearn et al. 2005", note: "The extents are preliminary, and only two." },
  "67p": { radiusKm: 1.7, source: "JPL SBDB, Sierks et al. 2015", note: "The diameter is 3.4 ± 0.1 km, so the mean radius is uncertain by 0.05 km. The nucleus is two lobes, and the source gives no extents." },
} as const satisfies Readonly<Record<string, PlaceMeanRadius>>;

/** Half the spread of the semi-axes, in kilometres. The extents are full lengths. */
export const shapeHalfRangeKm = (axesKm: readonly number[]): number => {
  const semis = axesKm.map((km) => km / 2);
  return (Math.max(...semis) - Math.min(...semis)) / 2;
};
