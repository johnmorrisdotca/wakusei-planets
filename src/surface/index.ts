// The standing view: the Moon's measured ground, the Sun and the Earth as a person standing there sees them. `import "@johnmorrisdotca/wakusei-planets/surface/element"` registers `<wakusei-surface>`.
export { moonSky, standSky, marsAir, localFrame, type MoonSky, type StandSky, type SkyAir, type Rgb, type SkyDirection } from "./sky.ts";
export { SURFACE_SITES, MOON_GRAVITY, MARS_GRAVITY, siteById, type SurfaceSite } from "./site.ts";
export { flatManifest, flatTerrain } from "./flat.ts";
export { EYE_HEIGHT, FOV_LIMITS, WALK_SPEED, clampLook, forward, stepOver, viewProjection, type Look } from "./view.ts";
export { decodeHeight, drop, emptyLevel, fillFromCoarser, groundAt, sampleLevel, tileAddress, type HeightLevel, type HeightLevelInfo, type TerrainManifest } from "./height.ts";
export { loadPlan, loadTerrain, type LoadJob, type LoadOptions, type Terrain, type TerrainProgress } from "./load.ts";
export type { SurfaceState } from "./element.ts";
export { ascentParts, landerParts, roverParts } from "./shapes.ts";
export { calloutsBy, CALLOUTS, clockText, LANDING, landingAt, type Callout, type LandingPose } from "./landing.ts";
export { DustField } from "./dust.ts";
export { MODEL_NODES, fromModelFrame, modelPose, modelShadowParts, rigOf, type ModelNodes, type Rig } from "./rig.ts";
export { driveParts, driveStep, driveView, startDrive, ROVER, type DriveDrag, type DriveInput, type DriveState, type DriveView } from "./drive.ts";
export { keepAway, objectParts, objectsOf, partShadows, traverseOf, KEEP_OUT, type Part, type SiteObject } from "./objects.ts";
export { craterIn, craterProfile, madeGround, setKeepOut, rimBoost, rocksAround, standingPlace, type Crater, type Rock } from "./detail.ts";
export { rockMesh, type RockMesh } from "./rocks.ts";
