// The data door of the planets (`@johnmorrisdotca/wakusei-planets/door`, MODULES-831): one way to hand the package outside data, and to see whose data is on the screen. A source is a small typed object that carries its
// own licence and credit. A map source (`BodyMapSource`) is the finer map of a body in tiles, and `tilesSource` is the package's own folder of them, which is what the `tiles` attribute means; a record source of
// small bodies (`SmallBodySource`) is drawn as points in `<wakusei-space>`. `<wakusei-body>` and `<wakusei-space>` take `sources` and `addSource`, and `credits()` says whose data was in the last drawn frame.
// The shapes and the four small functions are `../data-door.ts`, the same file in every package of the family (kazoku-ui's templates/data-door.ts). Nothing here is imported by the main entry or the elements' own
// entries beyond what they use: a page that never uses the door pays nothing. With no outside source every view draws what it always drew. Pure: no DOM, no three.js, no clock.
export { createTileStore, creditLine, loadRecords, MAX_IN_FLIGHT, MAX_RECORDS, TILE_BUDGET_BYTES, validateSource } from "../data-door.ts";
export type { BitmapLike, Credit, DataSource, ImageTile, Licence, MapPlace, RecordsRead, RecordSource, SourceInfo, TileLoader, TileSource, TileStats, TileStore, TileStoreOptions } from "../data-door.ts";
export { DEFAULT_LEVELS, forgetManifests, imageBytes, mapKeys, tileKeyParts, tilesSource, type BodyMapPlace, type BodyMapSource, type MapLayer, type TilesSourceOptions } from "./map.ts";
export { OWN_SOURCES, ownCredit } from "./own.ts";
export { createSourceBook, creditsOf, type SourceBook, type SourceBookOptions, type SourceStats } from "./book.ts";
export { GAUSS_K, isSmallBody, MAX_POINTS, packSmallBodies, readSmallBodies, smallBodyAt, smallBodyNumbers, type SmallBodiesRead, type SmallBody, type SmallBodySource } from "./small-bodies.ts";
