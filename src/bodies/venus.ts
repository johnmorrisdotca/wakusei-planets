import { registerLook } from "../scene/look.ts";
import { cloud } from "../scene/recipes.ts";

registerLook({
  id: "venus",
  surface: cloud({ light: "#f6ebc6", dark: "#bf9552", swirl: 1 }),
  atmosphere: { colour: [1, 0.9, 0.62], strength: 0.55, power: 2.6 },
  limb: 0.35,
  ambient: 0.07,
});
