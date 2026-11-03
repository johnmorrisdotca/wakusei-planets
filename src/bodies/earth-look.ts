import { registerLook } from "../scene/look.ts";

// The Earth's realistic and painted looks, drawn like every other body's from the Blue Marble picture, so they share the page's one WebGL context and have stills like the rest.
registerLook({
  id: "earth",
  surface: `
vec4 surface(vec3 p) {
  float land = smoothstep(0.52, 0.58, fbm(p * 2.6 + 3.0));
  vec3 sea = vec3(0.05, 0.17, 0.38);
  vec3 ground = mix(vec3(0.22, 0.38, 0.16), vec3(0.62, 0.55, 0.40), smoothstep(0.55, 0.8, fbm(p * 5.0)));
  float ice = smoothstep(radians(66.0), radians(76.0), abs(lat(p)));
  return vec4(mix(mix(sea, ground, land), vec3(0.93, 0.96, 0.98), ice), 0.0);
}`,
  atmosphere: { colour: [0.32, 0.52, 0.95], strength: 0.5, power: 3 },
  wrap: 0.12,
  limb: 0.12,
  mapped: true,
  painted: { map: "earth", widths: [512, 1024, 2048], far: 2048, relief: 0 },
});
