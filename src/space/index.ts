// The space view's pure parts: where the bodies are (this package's own models), the two scales and, for riding along, where a camera looks. They import on a server. The element is `@johnmorrisdotca/wakusei-planets/space/element`.
export { AU_IN_EARTH_RADII, blend, createTrack, EARTH_RADIUS_KM, eclipticToScene, frameAt, moonOrbit, planetOrbit, SPACE_DWARFS, SPACE_MINORS, SPACE_PLANETS, type SpaceDwarf, type SpaceFrame, type SpaceMinor, type SpacePlanet, type SpaceVec3 } from "./frame.ts";
export { compress, MOON_COMPRESSED, moonDistance, moonSizeFactor, orbitLine, placeAround, placeBodies, placeMoon, placeSun, radiusIn, SUN_COMPRESSED, truePosition, type ScaleMode } from "./scale.ts";
export { groundDirection } from "./aim.ts";
export { RIDE_FOV, ridePose, type RideInput, type RideLook, type RidePose } from "./ride.ts";
export { chooseLabels, LABEL_GAP, nameSpot, type LabelBox } from "./labels.ts";
export { bodyKindOf, findBody, HOP_ORDER, hopFrom, hostOf, systemOf, type SpaceKind } from "./bodies.ts";
export { besideMoon, BESIDE_RADII, type BesideCamera, type BesideInput } from "./beside.ts";
export { ARROWS_PER_ORBIT, arrowCount, arrowSites, MAX_ARROWS_PER_ORBIT, chevron, spinArrow, type OrbitArrow } from "./arrows.ts";
export { spinAxis, type SpinAxis } from "./spin.ts";
export { COVER_ARROW_GAP, COVER_MIN_PX, coverArrows, coveredBy, type CoverArrow, type CoverEntry } from "./covered.ts";
export { TRAVEL_CLEARANCE, arrivalSide, travelArrival, travelPlan, travelPose, type ArrivalCompanion, type TravelBody, type TravelInput, type TravelKind, type TravelPlan, type TravelSample, type TravelSight, type TravelView } from "./travel.ts";
export { regionOrbits, regionView, SUN_REGIONS, type SunRegion } from "./regions.ts";
export { SIGHT_STEP_PX, sightChanged, sightOf, withinMargin, type Sight, type SightEdge, type SightInput } from "./sight.ts";
export { besideFace, facingPoint, faceView, subCameraPoint, surfaceDirection, type Face, type FaceView } from "./face.ts";
