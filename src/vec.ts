// Three-number vectors and the few turns the drawings need. Pure, no allocation beyond the arrays themselves.

export type Vec3 = readonly [number, number, number];

export const RAD = Math.PI / 180;
export const DEG = 180 / Math.PI;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => {
  const n = length(a);
  return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
};
/** A direction from right ascension and declination in degrees. */
export const fromRaDec = (ra: number, dec: number): Vec3 => [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];

/** The mean obliquity of the ecliptic at J2000, in degrees. */
export const OBLIQUITY = 23.4392911;

/** An equatorial vector (J2000) in ecliptic coordinates. */
export const toEcliptic = (v: Vec3): Vec3 => {
  const c = Math.cos(OBLIQUITY * RAD);
  const s = Math.sin(OBLIQUITY * RAD);
  return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
};

/** Turn `v` about the unit axis `k` by `angle` degrees (Rodrigues). */
export const turn = (v: Vec3, k: Vec3, angle: number): Vec3 => {
  const c = Math.cos(angle * RAD);
  const s = Math.sin(angle * RAD);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
};

export const wrap360 = (a: number): number => ((a % 360) + 360) % 360;
