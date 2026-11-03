import { registerLook } from "../scene/look.ts";
import { ice, rock } from "../scene/recipes.ts";

registerLook({
  id: "io",
  surface: `
vec4 surface(vec3 p) {
  float n = fbm(p * 3.0 + 1.0);
  float m = fbm(p * 9.0 + 4.0);
  vec3 col = mix(vec3(0.93, 0.83, 0.34), vec3(0.98, 0.93, 0.62), n);
  col = mix(col, vec3(0.86, 0.46, 0.17), smoothstep(0.52, 0.74, m) * 0.75);
  col = mix(col, vec3(0.96, 0.96, 0.92), smoothstep(0.68, 0.85, fbm(p * 5.0 + 8.0)) * 0.65);
  float c = -craters(p, 6.5, 1.0, 21.0);
  col = mix(col, vec3(0.20, 0.12, 0.07), smoothstep(0.06, 0.26, c) * 0.8);
  float pele = oval(p, 105.0, -19.0, 13.0, 13.0, 0.5) - oval(p, 105.0, -19.0, 6.0, 6.0, 0.5);
  col = mix(col, vec3(0.78, 0.2, 0.1), clamp(pele, 0.0, 1.0) * 0.55);
  return vec4(col, 0.0);
}`,
  ambient: 0.02,
  painted: { map: "io", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({ id: "europa", surface: ice({ base: "#e9e0cd", stain: "#a2623e", cracks: 0.85, craters: 0.2 }), ambient: 0.02, painted: { map: "europa", widths: [512, 1024] } });
registerLook({
  id: "ganymede",
  surface: rock({ dark: "#5f5448", light: "#b6aa99", craters: 0.9, contrast: 0.9, seed: 12, patches: 3.4, extra: "col = mix(col, vec3(0.30, 0.25, 0.21), oval(p, -140.0, 20.0, 38.0, 50.0, 0.4) * 0.7); col += vec3(0.28) * smoothstep(0.05, 0.2, -h) * 0.6;" }),
  relief: 0.6,
  ambient: 0.02,
  painted: { map: "ganymede", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({ id: "callisto", surface: rock({ dark: "#3f3832", light: "#7d7265", craters: 1.8, contrast: 0.9, seed: 21, patches: 3.2, extra: "col += vec3(0.4, 0.4, 0.42) * smoothstep(0.05, 0.22, -h);" }), relief: 0.9, ambient: 0.02, painted: { map: "callisto", widths: [512, 1024, 2048], far: 2048 } });
