import { registerLook } from "../scene/look.ts";

registerLook({
  id: "mars",
  surface: `
vec4 surface(vec3 p) {
  float h = craters(p, 4.0, 0.4, 2.0) * 0.8 + craters(p, 12.0, 0.4, 9.0) * 0.4;
  float la = lat(p);
  float dk = smoothstep(0.5, 0.64, fbm(p * 2.1 + 7.0) + 0.14 * (1.0 - abs(la + 0.3) * 1.7));
  dk = max(dk, oval(p, 70.0, 8.0, 16.0, 11.0, 0.6) * 0.95);
  vec3 col = mix(vec3(0.80, 0.47, 0.26), vec3(0.34, 0.20, 0.15), dk * 0.85);
  col = mix(col, vec3(0.88, 0.62, 0.40), oval(p, 70.0, -42.0, 9.0, 9.0, 0.6) * 0.6);
  col *= 0.9 + 0.22 * fbm(p * 11.0);
  col *= 1.0 + 0.7 * h;
  float valles = (1.0 - smoothstep(0.0, 0.03, abs(la + 0.12 + 0.05 * sin(lon(p) * 2.0)))) * oval(p, -75.0, -10.0, 35.0, 12.0, 0.5);
  col = mix(col, vec3(0.30, 0.17, 0.13), valles * 0.7);
  float wob = (fbm(p * 7.0) - 0.5) * 0.14;
  float cap = smoothstep(radians(79.0), radians(83.0), abs(la) + wob);
  col = mix(col, vec3(0.96, 0.96, 0.98), cap);
  return vec4(col, h);
}`,
  atmosphere: { colour: [0.85, 0.6, 0.45], strength: 0.16, power: 4 },
  relief: 0.7,
  ambient: 0.03,
  painted: { map: "mars", widths: [512, 1024, 2048], far: 2048 },
});
