// Which source objects this package made, apart from `own.ts` (which holds the credits of the package's own data, and the picture credits with them) so that an entry point that only needs to mark a source, such as `/asteroids`, does not carry them. Pure.

/** The source objects this package made itself: only these are its own, whatever id a caller's source gives itself. */
const MADE_HERE = new WeakSet<object>();

/** Marks a source object as made by this package. */
export function madeHere<T extends object>(source: T): T {
  MADE_HERE.add(source);
  return source;
}

/** True for a source object this package made (`tilesSource`), false for any other. */
export const isOwnSource = (source: object): boolean => MADE_HERE.has(source);
