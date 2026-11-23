// The flat map's pure parts and the element's types (`@johnmorrisdotca/wakusei-planets/flat`): the map's geometry, the bodies it draws, the Sun and the sunrise line, the orbiters over the ground, the night's shading, coverage circles and ground tracks, the two looks (the photo and the line map's tones), the marks a page adds, and the words. They import on a server and need no browser.
// The element itself is in `@johnmorrisdotca/wakusei-planets/flat/define`, which registers `<wakusei-flat>`.
export { FLAT_BODIES, ORBITER_COLOURS, flatBody, isFlatBody, orbiterColour, orbiterName, type FlatBodyId, type FlatBodyInfo } from "./bodies.ts";
export { MAX_ZOOM, clampView, pixelsPerDegree, projectFlat, unprojectFlat, wrapLongitude, zoomAbout, type FlatView } from "./geometry.ts";
export { MERCATOR_LIMIT, PROJECTIONS, fitMap, graticule, isProjection, mapExtent, mapOutline, mapPixels, mapSun, projectMap, resampleMap, unprojectMap, type GraticuleLine, type MapCentre, type MapFit, type MapLine, type MapPixels, type ProjectionId } from "./projections.ts";
export { circleOutline, flatMoonTrackHalf, flatMoonTracks, flatMoons, flatOrbiter, flatSun, flatSunRate, flatTrack, hasPath, moonsOfBody, shadeNight, sunriseLine, trackPieces, type FlatMoon, type FlatOrbiter } from "./scene.ts";
export { FLAT_LOOKS, MAP_LAND, MAP_LINE, MAP_SEA, MAP_TONES, bandEdges, creditLicence, creditWho, pictureWidth, pictureWidths, readLook, toneMap, toneRamp, type FlatLook, type Tone } from "./look.ts";
export { MARK_SHAPES, markName, readMarks, type FlatMark, type HeldMark, type MarkShape, type MarkText } from "./marks.ts";
export { readFlatPlaces, readerMarks } from "./reader-places.ts";
export { FLAT_WORDS, coordinateText, gridText, say, type FlatLang } from "./words.ts";
export type { FlatPick, WakuseiFlat } from "./element.ts";
