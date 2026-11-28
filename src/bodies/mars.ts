import { registerLook } from "../scene/look.ts";

registerLook({
  id: "mars",
  surface: /* glsl */ `
// Robbins–Hynek's circular diameters give different cumulative slopes across the
// resolved diameter ranges. The catalogue densities set the broad regional weights.
float craterDensity(vec3 centre) {
  float south = 1.0 - smoothstep(-0.42, -0.10, centre.z);
  float north = smoothstep(0.37, 0.64, centre.z);
  float regional = mix(0.60, 1.0, south) * mix(1.0, 0.38, north);
  float local = 0.85 + 0.11 * sin(dot(centre, vec3(9.0, -12.0, 4.0))) + 0.13 * sin(dot(centre, vec3(6.0, 5.0, 10.0)));
  return regional * local;
}

float sampledDiameter(float percentile, float low, float high, float slope) {
  return low * pow(mix(1.0, pow(low / high, slope), percentile), -1.0 / slope);
}

vec2 marsCraters(vec3 p, float pixel, float frequency, float low, float high, float slope, float seed, float coverage) {
  // The diameter divided by 6,780 km gives the angular radius on the unit globe.
  if (high / 6780.0 < pixel) return vec2(0.0);
  vec3 q = p * frequency + seed;
  vec3 cell = floor(q);
  vec2 height = vec2(0.0);
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 c = cell + vec3(float(x), float(y), float(z));
    vec3 raw = c + hash33(c) - seed;
    float shell = length(raw);
    if (abs(shell - frequency) > 0.55) continue;
    vec3 centre = raw / shell;
    if (hash13(c + 3.7) > craterDensity(centre) * coverage) continue;
    float percentile = hash13(c + 17.3);
    // Of the observed 16–80 km craters, 44% are in the 16–24 km interval.
    float diameter = low == 16.0
      ? (percentile < 0.439 ? sampledDiameter(percentile / 0.439, 16.0, 24.0, 1.35)
                           : sampledDiameter((percentile - 0.439) / 0.561, 24.0, high, slope))
      : sampledDiameter(percentile, low, high, slope);
    float radius = diameter / 6780.0;
    if (abs(centre.z) > cos(radians(16.0) + 1.2 * radius)) continue;
    // In the close albedo layer the soft mark includes the ground around the rim.
    vec3 offset = (p - centre) / (low < 16.0 ? radius * 1.8 : radius);
    float freshness = hash13(c + 21.4);
    float uneven = 1.0 + 0.06 * sin(dot(offset, vec3(4.0, -3.0, 2.0)) + freshness * 6.28)
                       + 0.035 * sin(dot(offset, vec3(1.0, 7.0, -4.0)));
    float d = length(offset) / uneven;
    if (d > 1.55) continue;
    float pixels = radius / pixel;
    float visible = smoothstep(0.7, 2.3, pixels);
    float weathering = mix(0.38, 1.0, freshness * freshness);
    float bowl = -(1.0 - smoothstep(0.07 + 0.22 * freshness, 1.05, d));
    float rim = exp(-pow((d - 0.99) * (3.4 + 3.1 * freshness), 2.0)) * (0.028 + 0.21 * freshness * freshness);
    float profile = min(0.075, 0.030 + diameter / 7100.0) * visible * weathering * (bowl + rim);
    float relief = smoothstep(3.8, 9.0, pixels);
    height += vec2(profile, profile * relief * relief * (0.26 + 0.37 * freshness));
  }
  return height;
}

vec4 surface(vec3 p) {
  float pixel = max(max(length(dFdx(p)), length(dFdy(p))), 1e-6);
  vec2 fine = marsCraters(p, pixel, 42.7, 16.0, 80.0, 2.19, 13.0, 1.0);
  vec2 h = fine + marsCraters(p, pixel, 8.3, 80.0, 256.0, 2.47, 29.0, 1.0)
         + marsCraters(p, pixel, 3.0, 256.0, 1024.0, 2.54, 41.0, 0.58);
  // Close to the older southern terrain the 8–16 km population resolves as
  // overlapping soft albedo marks. These small craters do not tip the surface.
  float close = (1.0 - smoothstep(0.00255, 0.00348, pixel)) * (1.0 - smoothstep(-0.24, 0.03, p.z));
  if (close > 0.0) {
    h.x += close * (1.4 * fine.x + 5.1 * marsCraters(p, pixel * 0.52, 54.5, 8.0, 16.0, 1.07, 63.0, 1.0).x);
    h.y *= 1.0 - 0.28 * close;
  }
  float la = lat(p);
  float dk = smoothstep(0.5, 0.64, fbm(p * 2.1 + 7.0) + 0.14 * (1.0 - abs(la + 0.3) * 1.7));
  dk = max(dk, oval(p, 70.0, 8.0, 16.0, 11.0, 0.6) * 0.95);
  vec3 col = mix(vec3(0.80, 0.47, 0.26), vec3(0.34, 0.20, 0.15), dk * 0.85);
  col = mix(col, vec3(0.88, 0.62, 0.40), oval(p, 70.0, -42.0, 9.0, 9.0, 0.6) * 0.6);
  col *= 0.9 + 0.22 * fbm(p * 11.0);
  col *= 1.0 + h.x;
  float valles = (1.0 - smoothstep(0.0, 0.03, abs(la + 0.12 + 0.05 * sin(lon(p) * 2.0)))) * oval(p, -75.0, -10.0, 35.0, 12.0, 0.5);
  col = mix(col, vec3(0.30, 0.17, 0.13), valles * 0.7);
  float wob = (fbm(p * 7.0) - 0.5) * 0.14;
  float cap = smoothstep(radians(79.0), radians(83.0), abs(la) + wob);
  col = mix(col, vec3(0.96, 0.96, 0.98), cap);
  return vec4(col, h.y * (1.0 - smoothstep(0.0, 0.72, cap)));
}`,
  atmosphere: { colour: [0.85, 0.6, 0.45], strength: 1, power: 4 },
  relief: 0.7,
  ambient: 0.03,
  painted: { map: "mars", widths: [512, 1024, 2048], far: 2048 },
});
