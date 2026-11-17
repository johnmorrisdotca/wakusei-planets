// How the space view keys the asteroids of /asteroids among its own names (labels, places, the sight): two of them, `europa` and `dione`, have the id of a moon of the package.
/** The prefix of an asteroid's key in the view: two asteroids (`europa`, `dione`) have the id of a moon of the package, so the view keeps its own names for them apart by it. A page never sees it: events and `sight()` say the plain id. */
export const ASTEROID_PREFIX = "asteroid:";

/** The view's key of an asteroid. */
export const asteroidKey = (id: string): string => ASTEROID_PREFIX + id;

/** The asteroid's plain id from the view's key, or `undefined` for a key that is not an asteroid's. */
export const asteroidIdOf = (key: string): string | undefined => (key.startsWith(ASTEROID_PREFIX) ? key.slice(ASTEROID_PREFIX.length) : undefined);
