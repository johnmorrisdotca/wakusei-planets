import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

registerLook({
  id: "pluto",
  surface: rock({
    dark: "#5f4033",
    light: "#c9a784",
    craters: 0.35,
    contrast: 0.6,
    seed: 5,
    patches: 2.6,
    extra: `
    col = mix(col, vec3(0.20, 0.10, 0.09), oval(p, 105.0, -6.0, 55.0, 14.0, 0.6) * 0.88);
    float heart = clamp(oval(p, 178.0, 20.0, 23.0, 27.0, 0.35) + oval(p, 226.0, 24.0, 21.0, 20.0, 0.5) * 0.75 + oval(p, 205.0, -10.0, 13.0, 30.0, 0.5) * 0.6, 0.0, 1.0);
    col = mix(col, vec3(0.95, 0.90, 0.82), heart * 0.92);
    h *= 1.0 - heart;`,
  }),
  atmosphere: { colour: [0.6, 0.7, 0.9], strength: 0.12, power: 5 },
  relief: 0.4,
  ambient: 0.025,
});
