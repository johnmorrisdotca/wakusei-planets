import { registerLook } from "../scene/look.ts";
import { gas } from "../scene/recipes.ts";

registerLook({
  id: "saturn",
  surface: gas({
    stops: [[-90, "#9c9484"], [-72, "#b4a684"], [-60, "#c1ae86"], [-45, "#e1cf9f"], [-30, "#cdb581"], [-15, "#e6d3a0"], [-5, "#f0e0b0"], [5, "#ead9a8"], [15, "#d7c18c"], [30, "#e4d2a2"], [45, "#cdb88a"], [60, "#d9c698"], [75, "#a9a083"], [90, "#7d8794"]],
    turbulence: 0.016,
    streaks: 0.09,
    plateau: 0.3,
  }),
  atmosphere: { colour: [0.9, 0.82, 0.62], strength: 0.12, power: 3.5 },
  limb: 0.4,
});
