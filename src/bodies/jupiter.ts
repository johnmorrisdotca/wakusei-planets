import { registerLook } from "../scene/look.ts";
import { gas } from "../scene/recipes.ts";

registerLook({
  id: "jupiter",
  surface: gas({
    stops: [[-90, "#6f685f"], [-70, "#8f8070"], [-58, "#b9a48a"], [-48, "#a98d72"], [-40, "#e2d3bb"], [-32, "#b58b6c"], [-26, "#e5d6bf"], [-19, "#b2704f"], [-12, "#c98a62"], [-6, "#ecdcbc"], [0, "#efdfb8"], [6, "#e8d4ae"], [10, "#a96b4d"], [16, "#b97c58"], [21, "#e9dac0"], [27, "#b9916f"], [33, "#ead9bf"], [40, "#a98873"], [50, "#d2bfa2"], [60, "#a49080"], [70, "#8a7b6e"], [90, "#6c6560"]],
    turbulence: 0.05,
    streaks: 0.22,
    plateau: 0.22,
    extra: `
    float spot = oval(p, -48.0, -22.0, 9.5, 6.0, 0.55);
    float halo = oval(p, -48.0, -22.0, 14.0, 9.0, 0.5) - spot;
    vec3 spotCol = mix(vec3(0.70, 0.31, 0.20), vec3(0.86, 0.52, 0.36), fbm(p * 16.0 + 2.0));
    col = mix(col, col * 0.78, clamp(halo, 0.0, 1.0) * 0.5);
    col = mix(col, spotCol, spot);
    float oval2 = oval(p, -70.0, -33.0, 3.0, 2.2, 0.5);
    col = mix(col, vec3(0.93, 0.88, 0.80), oval2 * 0.8);`,
  }),
  atmosphere: { colour: [0.75, 0.7, 0.62], strength: 0.12, power: 3.5 },
  limb: 0.45,
  painted: { map: "jupiter", widths: [512, 1024, 2048], far: 2048, relief: 0 },
});
