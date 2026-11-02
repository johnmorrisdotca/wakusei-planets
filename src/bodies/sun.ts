import { registerLook } from "../scene/look.ts";

registerLook({
  id: "sun",
  emissive: true,
  limb: 0.5,
  surface: `
vec4 surface(vec3 p) {
  float g = fbm(p * 24.0);
  float g2 = fbm(p * 70.0 + 4.0);
  float cell = smoothstep(0.32, 0.72, mix(g, g2, 0.55));
  vec3 col = mix(vec3(1.0, 0.52, 0.10), vec3(1.0, 0.9, 0.52), cell);
  float act = smoothstep(radians(40.0), radians(10.0), abs(lat(p)));
  float spot = smoothstep(0.64, 0.72, fbm(p * 5.0 + 3.0)) * act;
  float pen = smoothstep(0.57, 0.64, fbm(p * 5.0 + 3.0)) * act;
  col = mix(col, vec3(0.62, 0.22, 0.05), pen * 0.55);
  col = mix(col, vec3(0.16, 0.04, 0.01), spot * 0.92);
  return vec4(col * 1.12, 0.0);
}`,
});
