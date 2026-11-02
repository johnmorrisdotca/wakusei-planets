// Builders for the surface code of a body: a gas giant's bands, a cratered rock, a cloud-wrapped world. Each returns the GLSL text of `vec4 surface(vec3 p)`; a body's own entry
// point adds what is only its own (a spot, a cap, a heart) as a few lines of `extra`.

/** A `#rrggbb` colour as GLSL. */
export const vec = (hex: string): string => {
  const c = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));
  return `vec3(${c.join(", ")})`;
};

/** A latitude-to-colour function from stops (latitude in degrees, south to north). `plateau` (0 to 0.5) keeps each band flat and its edge sharp. */
export function bandFn(stops: readonly (readonly [number, string])[], plateau = 0.3): string {
  let code = `vec3 bandCol(float la) { float d = degrees(la); vec3 c = ${vec(stops[0]![1])};\n`;
  for (let i = 1; i < stops.length; i += 1) {
    const a = stops[i - 1]![0];
    const b = stops[i]![0];
    const w = (b - a) * plateau;
    code += `  c = mix(c, ${vec(stops[i]![1])}, smoothstep(${(a + w).toFixed(2)}, ${(b - w).toFixed(2)}, d));\n`;
  }
  return `${code}  return c; }\n`;
}

export interface GasOptions {
  stops: readonly (readonly [number, string])[];
  /** How much the bands wobble (0 to 0.1). */
  turbulence?: number;
  /** How strong the streaks along the bands are (0 to 0.5). */
  streaks?: number;
  plateau?: number;
  /** GLSL that may change `col` and read `p` and `la`. */
  extra?: string;
}

/** A banded atmosphere: colour by latitude, wobbled by noise, streaked along the bands. */
export function gas(options: GasOptions): string {
  const t = options.turbulence ?? 0.04;
  const k = options.streaks ?? 0.2;
  return `${bandFn(options.stops, options.plateau)}
vec4 surface(vec3 p) {
  float la = lat(p);
  float warp = (fbm(vec3(p.xy * 4.5, p.z * 9.0)) - 0.5) * ${t.toFixed(3)} + (fbm(vec3(p.xy * 11.0, p.z * 22.0) + 5.0) - 0.5) * ${(t * 0.45).toFixed(3)};
  vec3 col = bandCol(la + warp);
  float streak = fbm(vec3(p.xy * 3.0, p.z * 36.0) + 2.0);
  col *= 1.0 + ${k.toFixed(3)} * (streak - 0.5) * 2.0;
  ${options.extra ?? ""}
  return vec4(col, 0.0);
}`;
}

export interface RockOptions {
  /** The darker and the lighter ground colour. */
  dark: string;
  light: string;
  /** How many craters (1 is a lot). */
  craters?: number;
  /** How dark the bowls are (0 to 2). */
  contrast?: number;
  seed?: number;
  /** How large the patches of dark and light ground are (the noise's frequency). */
  patches?: number;
  /** GLSL that may change `col` and read `p`, `h` (the crater height) and `tone`. */
  extra?: string;
}

/** A cratered world: two ground colours in patches, with craters that are dark in the bowl and bright on the rim. */
export function rock(options: RockOptions): string {
  const c = options.craters ?? 1;
  const seed = (options.seed ?? 0).toFixed(1);
  return `
vec4 surface(vec3 p) {
  float h = craters(p, 3.0, ${(c * 1.0).toFixed(2)}, ${seed}) + craters(p, 8.0, ${(c * 0.7).toFixed(2)}, ${seed} + 7.0) * 0.6 + craters(p, 20.0, ${(c * 0.6).toFixed(2)}, ${seed} + 3.0) * 0.3;
  float tone = fbm(p * ${(options.patches ?? 2.3).toFixed(2)} + ${seed});
  vec3 col = mix(${vec(options.dark)}, ${vec(options.light)}, smoothstep(0.25, 0.75, tone));
  col *= 1.0 + ${(options.contrast ?? 1).toFixed(2)} * 1.15 * h;
  col *= 0.94 + 0.12 * fbm(p * 60.0);
  ${options.extra ?? ""}
  return vec4(col, h);
}`;
}

export interface CloudOptions {
  light: string;
  dark: string;
  /** How much swirl (0 to 1). */
  swirl?: number;
  extra?: string;
}

/** A world wrapped in cloud: pale and smooth, streaked and swirled. */
export function cloud(options: CloudOptions): string {
  return `
vec4 surface(vec3 p) {
  vec3 q = p * 2.2;
  float w = fbm(q * 1.4 + 3.0);
  float n = fbm(q + vec3(w * 2.6, w * 1.4, -w * 2.0));
  float streak = fbm(vec3(p.xy * 2.2, p.z * 7.0) + w);
  float m = clamp(mix(n, streak, 0.4) * 1.3 - 0.12, 0.0, 1.0);
  vec3 col = mix(${vec(options.dark)}, ${vec(options.light)}, mix(0.55, m, ${(options.swirl ?? 0.8).toFixed(2)}));
  ${options.extra ?? ""}
  return vec4(col, 0.0);
}`;
}

/** An icy world: bright ground with a few dark stains and faint cracks. */
export function ice(options: { base: string; stain: string; cracks?: number; craters?: number; extra?: string }): string {
  return `
vec4 surface(vec3 p) {
  float h = craters(p, 4.0, ${(options.craters ?? 0.5).toFixed(2)}, 11.0) + craters(p, 12.0, ${((options.craters ?? 0.5) * 0.8).toFixed(2)}, 5.0) * 0.6;
  float tone = fbm(p * 3.0 + 9.0);
  vec3 col = mix(${vec(options.base)}, ${vec(options.stain)}, smoothstep(0.45, 0.8, tone) * 0.7);
  float ridge = 1.0 - smoothstep(0.0, 0.02, abs(fbm(p * 7.0 + 4.0) - 0.5));
  col = mix(col, ${vec(options.stain)}, ridge * ${(options.cracks ?? 0.0).toFixed(2)});
  col *= 1.0 + 0.7 * h;
  ${options.extra ?? ""}
  return vec4(col, h);
}`;
}
