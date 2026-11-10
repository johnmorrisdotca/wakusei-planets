// The space view's pure parts: where the bodies are (this package's own models), the two scales and, for riding along, where a camera looks. They import on a server. The element is `@johnmorrisdotca/wakusei-planets/space/element`.
export { AU_IN_EARTH_RADII, blend, createTrack, EARTH_RADIUS_KM, frameAt, moonOrbit, planetOrbit, SPACE_PLANETS, type SpaceFrame, type SpacePlanet, type SpaceVec3 } from "./frame.ts";
export { compress, MOON_COMPRESSED, moonDistance, orbitLine, placeAround, placeBodies, placeMoon, placeSun, radiusIn, SUN_COMPRESSED, truePosition, type ScaleMode } from "./scale.ts";
export { groundDirection } from "./aim.ts";
export { RIDE_FOV, ridePose, type RideInput, type RideLook, type RidePose } from "./ride.ts";
export { chooseLabels, LABEL_GAP, type LabelBox } from "./labels.ts";
