import { registerLook } from "../scene/look.ts";
import { cloud } from "../scene/recipes.ts";

registerLook({
  id: "venus",
  surface: cloud({ light: "#f6ebc6", dark: "#bf9552", swirl: 0.78, extra: /* glsl */ `
    // Shear bends the low-latitude UV cloud front back at middle latitudes.
    float latitude = lat(p);
    float latitudeFromEquator = abs(latitude);
    float longitude = lon(p);
    float bend = 1.08 * (sqrt(latitude * latitude + 0.020) - 0.141);
    float curl = 0.19 * sin(latitude * 2.8) + 0.18 * (fbm(p * 5.0 + 7.0) - 0.5);
    float front = wrapPi(longitude - 0.28 + bend + curl);
    float wake = wrapPi(longitude - 2.67 + bend * 0.58 - curl * 0.85);
    float belt = 1.0 - smoothstep(0.86, 1.4, latitudeFromEquator);
    float branch = exp(-pow((front + 0.06) / 0.25, 2.0));
    float edge = exp(-pow((front - 0.26) / 0.23, 2.0));
    float tail = exp(-pow((latitude - 0.03 * sin(front * 2.0)) / 0.16, 2.0)) * smoothstep(0.02, 0.24, front) * (1.0 - smoothstep(0.78, 1.58, front));
    float farFront = exp(-pow(wake / 0.34, 2.0));
    float shear = 0.039 * exp(-pow(front / 0.65, 2.0)) * sin(front * 3.2 + latitude * 4.0);
    float filaments = fbm(vec3(p.xy * 8.0, (p.z + shear) * 25.0) + 9.0) - 0.48;
    col *= 1.0 + belt * (0.13 * edge - 0.17 * branch - 0.12 * tail - 0.085 * farFront) + 0.21 * filaments;
  ` }),
  atmosphere: { colour: [1, 0.9, 0.62], strength: 1, power: 2.6 },
  limb: 0.35,
  ambient: 0.07,
  painted: { map: "venus", widths: [512, 1024, 2048], far: 2048 },
});
