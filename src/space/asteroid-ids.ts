// The ids of the asteroids of /asteroids, in table order: what the space view needs to tell an asteroid from a body (and to say so when the option `asteroids` is off) without loading the table, which is a chunk of its own
// that the view reaches only when the option is turned on. A test holds this list to the table. And how the view keys the asteroids among its own names (labels, places, the sight): two of them, `europa` and `dione`, have the id of a moon.
/** The ids of the 102 bodies of `/asteroids`, in table order. Eros and Bennu are bodies of the package, so they are not in this list. */
export const ASTEROID_IDS: readonly string[] = [
  "hygiea", "interamnia", "europa", "davida", "euphrosyne", "patientia", "sylvia", "juno", "cybele", "thisbe", "eunomia", "psyche", "bamberga", "doris", "ursula",
  "camilla", "hermione", "lomia", "dione", "daphne", "aurora", "egeria", "eugenia", "fortuna", "iris", "chicago", "themis", "gaspra", "ida", "mathilde", "lutetia",
  "steins", "annefrank", "braille", "dinkinesh", "donaldjohanson", "masursky", "apl", "itokawa", "ryugu", "toutatis", "didymos", "arrokoth",
  "apophis", "torifune", "1998-ky26", "2024-yr4", "phaethon", "icarus", "geographos", "toro", "cruithne", "kamooalewa", "1950-da", "florence", "ganymed", "apollo",
  "aten", "amor", "atira", "hermes", "wilson-harrington", "duende", "nereus", "golevka", "adonis", "eurybates", "polymele", "leucus", "orus", "patroclus", "hektor",
  "achilles", "agamemnon", "nestor", "priamus", "diomedes", "odysseus", "ajax", "menelaus", "aneas", "anchises", "chariklo", "nessus", "asbolus", "hylonome",
  "echeclus", "bienor", "thereus", "salacia", "varuna", "ixion", "varda", "mani", "2014-uz224", "albion", "leleakuhonua", "huya", "chaos", "typhon", "2012-vp113",
  "2018-ag37",
];

/** The prefix of an asteroid's key in the view: two asteroids (`europa`, `dione`) have the id of a moon of the package, so the view keeps its own names for them apart by it. A page never sees it: events, `sight()` and `riding` say the plain id. */
export const ASTEROID_PREFIX = "asteroid:";

/** The view's key of an asteroid. */
export const asteroidKey = (id: string): string => ASTEROID_PREFIX + id;

/** The asteroid's plain id from the view's key, or `undefined` for a key that is not an asteroid's. */
export const asteroidIdOf = (key: string): string | undefined => (key.startsWith(ASTEROID_PREFIX) ? key.slice(ASTEROID_PREFIX.length) : undefined);
