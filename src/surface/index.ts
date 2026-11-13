// The standing view: the Moon's measured ground, the Sun and the Earth as a person standing there sees them. `import "@johnmorrisdotca/wakusei-planets/surface/element"` registers `<wakusei-surface>`.
export { moonSky, localFrame, type MoonSky, type SkyDirection } from "./sky.ts";
export { SURFACE_SITES, siteById, type SurfaceSite } from "./site.ts";
export { EYE_HEIGHT, FOV_LIMITS, WALK_SPEED, clampLook, forward, stepOver, viewProjection, type Look } from "./view.ts";
export { decodeHeight, drop, emptyLevel, fillFromCoarser, groundAt, sampleLevel, tileAddress, type HeightLevel, type HeightLevelInfo, type TerrainManifest } from "./height.ts";
export { loadPlan, loadTerrain, type LoadJob, type LoadOptions, type Terrain, type TerrainProgress } from "./load.ts";
export type { SurfaceState } from "./element.ts";
export { keepAway, objectParts, objectsOf, partShadows, traverseOf, KEEP_OUT, type Part, type SiteObject } from "./objects.ts";
export { craterIn, craterProfile, madeGround, setKeepOut, rimBoost, rocksAround, standingPlace, type Crater, type Rock } from "./detail.ts";
export { rockMesh, type RockMesh } from "./rocks.ts";
