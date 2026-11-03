import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

registerLook({
  id: "moon",
  surface: rock({
    dark: "#77746f",
    light: "#b9b5ad",
    craters: 0.65,
    contrast: 0.5,
    seed: 3,
    patches: 3,
    extra: `
    float edge = (fbm(p * 7.0 + 2.0) - 0.5) * 0.35;
    float m = 0.0;
    m = max(m, oval(p, -15.0 + 6.0 * edge, 35.0, 24.0, 15.0, 0.35 + edge));
    m = max(m, oval(p, 18.0, 28.0, 11.0, 9.0, 0.4));
    m = max(m, oval(p, 31.0, 8.0, 14.0, 11.0, 0.4));
    m = max(m, oval(p, 59.0, 17.0, 8.0, 7.0, 0.4));
    m = max(m, oval(p, 52.0, -4.0, 10.0, 10.0, 0.4));
    m = max(m, oval(p, -16.0, -21.0, 11.0, 8.0, 0.4));
    m = max(m, oval(p, -39.0, -24.0, 6.0, 6.0, 0.4));
    m = max(m, oval(p, -57.0, 12.0, 14.0, 26.0, 0.4 + edge));
    m = max(m, oval(p, 4.0, 13.0, 7.0, 6.0, 0.4));
    m = max(m, oval(p, 35.0, -15.0, 6.0, 6.0, 0.4));
    m = max(m, oval(p, 0.0, 58.0, 40.0, 5.0, 0.5) * 0.75);
    m *= 0.85 + 0.3 * fbm(p * 5.0);
    col = mix(col, vec3(0.31, 0.31, 0.33), clamp(m, 0.0, 1.0) * 0.92);
    h *= 1.0 - clamp(m, 0.0, 1.0) * 0.75;
    float tycho = acos(clamp(dot(p, dirOf(-11.0, -43.0)), -1.0, 1.0));
    float ray = smoothstep(1.0, 0.04, tycho) * (0.35 + 0.65 * smoothstep(0.5, 0.8, fbm(vec3(atan(p.z + 0.68, p.y + 0.2) * 2.4, tycho * 3.0, 1.7))));
    col = mix(col, vec3(0.95, 0.94, 0.92), ray * 0.45 * smoothstep(0.02, 0.2, tycho) * (1.0 - m));
    col = mix(col, vec3(0.97), smoothstep(0.035, 0.0, tycho) * 0.8);`,
  }),
  relief: 0.8,
  ambient: 0.02,
  painted: { map: "moon", widths: [512, 1024, 2048], far: 2048 },
});
