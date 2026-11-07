import { registerLook } from "../scene/look.ts";
import { gas } from "../scene/recipes.ts";

registerLook({
  id: "neptune",
  surface: gas({
    stops: [[-90, "#2b45b4"], [-60, "#3153c6"], [-35, "#2a47b6"], [-15, "#3a60d4"], [0, "#2e4ebf"], [20, "#3c61d3"], [45, "#3050c0"], [90, "#3a5ccf"]],
    turbulence: 0.022,
    streaks: 0.1,
    extra: `
    float spot = oval(p, -30.0, -24.0, 11.0, 6.5, 0.5);
    col = mix(col, vec3(0.10, 0.17, 0.46), spot * 0.9);
    float cirrus = smoothstep(0.6, 0.8, fbm(vec3(p.xy * 3.0, p.z * 30.0) + 8.0)) * smoothstep(0.5, 0.0, abs(degrees(la) + 38.0) / 10.0);
    col = mix(col, vec3(0.86, 0.9, 1.0), clamp(cirrus + oval(p, -8.0, -28.0, 7.0, 2.0, 0.6) * 0.8, 0.0, 1.0) * 0.55);`,
  }),
  atmosphere: { colour: [0.35, 0.5, 0.95], strength: 0.42, power: 2.8 },
  limb: 0.3,
  ambient: 0.05,
  painted: { map: "neptune", widths: [512, 1024, 2048], far: 2048, relief: 0, turn: "bands" },
});
