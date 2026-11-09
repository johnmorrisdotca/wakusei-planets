// The colour of a black body, as red, green and blue from 0 to 255 (Tanner Helland's fit of the black-body locus, good to a few percent from 1,000 to 40,000 K). Shared by the star drawings and the star catalogue.

/** Red, green and blue, 0 to 255, of a black body at `kelvin` (held between 1,000 and 40,000). */
export function blackBodyRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40_000, Math.max(1_000, kelvin)) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const clamp = (v: number): number => Math.min(255, Math.max(0, v));
  return [clamp(red), clamp(green), clamp(blue)];
}
