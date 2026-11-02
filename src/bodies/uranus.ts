import { registerLook } from "../scene/look.ts";
import { gas } from "../scene/recipes.ts";

registerLook({
  id: "uranus",
  surface: gas({
    stops: [[-90, "#b4e8ee"], [-55, "#9fdce3"], [-25, "#97d5dd"], [0, "#9ad8df"], [25, "#a0dce3"], [55, "#a8e0e7"], [90, "#bdeef3"]],
    turbulence: 0.01,
    streaks: 0.035,
    plateau: 0.4,
  }),
  atmosphere: { colour: [0.55, 0.88, 0.92], strength: 0.4, power: 2.8 },
  limb: 0.3,
  ambient: 0.05,
  painted: { map: "uranus", widths: [512, 1024, 2048], far: 2048, relief: 0 },
});
