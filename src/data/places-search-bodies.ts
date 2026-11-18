// Made by scripts/make-places-search-data.py. Do not edit by hand.
// The bodies that have a search list, and how each list is fetched (a chunk of its own for a bundler). Used by `/places/search`.
export const PLACE_SEARCH_BODIES = [
  "moon",
  "mars",
  "mercury",
  "venus",
  "io",
  "europa",
  "ganymede",
  "callisto",
  "titan",
  "enceladus",
  "mimas",
  "tethys",
  "dione",
  "rhea",
  "iapetus",
  "miranda",
  "ariel",
  "umbriel",
  "titania",
  "oberon",
  "triton",
  "pluto",
  "charon",
  "ceres",
  "vesta",
  "eros",
  "ryugu",
  "bennu",
  "dimorphos",
  "tempel-1",
  "67p",
  "jupiter",
  "saturn",
  "amalthea",
  "dactyl",
  "deimos",
  "didymos",
  "dinkinesh",
  "donaldjohanson",
  "epimetheus",
  "gaspra",
  "hyperion",
  "ida",
  "itokawa",
  "janus",
  "lutetia",
  "mathilde",
  "phobos",
  "phoebe",
  "proteus",
  "steins",
  "thebe",
] as const;

export type PlaceSearchBody = (typeof PLACE_SEARCH_BODIES)[number];

export async function readSearchTable(body: PlaceSearchBody | "moon-satellites"): Promise<readonly import("../place-search.ts").PlaceHit[]> {
  switch (body) {
    case "67p": return (await import("../places/search/67p.ts")).PLACE_HITS_67P;
    case "amalthea": return (await import("../places/search/amalthea.ts")).PLACE_HITS_AMALTHEA;
    case "ariel": return (await import("../places/search/ariel.ts")).PLACE_HITS_ARIEL;
    case "bennu": return (await import("../places/search/bennu.ts")).PLACE_HITS_BENNU;
    case "callisto": return (await import("../places/search/callisto.ts")).PLACE_HITS_CALLISTO;
    case "ceres": return (await import("../places/search/ceres.ts")).PLACE_HITS_CERES;
    case "charon": return (await import("../places/search/charon.ts")).PLACE_HITS_CHARON;
    case "dactyl": return (await import("../places/search/dactyl.ts")).PLACE_HITS_DACTYL;
    case "deimos": return (await import("../places/search/deimos.ts")).PLACE_HITS_DEIMOS;
    case "didymos": return (await import("../places/search/didymos.ts")).PLACE_HITS_DIDYMOS;
    case "dimorphos": return (await import("../places/search/dimorphos.ts")).PLACE_HITS_DIMORPHOS;
    case "dinkinesh": return (await import("../places/search/dinkinesh.ts")).PLACE_HITS_DINKINESH;
    case "dione": return (await import("../places/search/dione.ts")).PLACE_HITS_DIONE;
    case "donaldjohanson": return (await import("../places/search/donaldjohanson.ts")).PLACE_HITS_DONALDJOHANSON;
    case "enceladus": return (await import("../places/search/enceladus.ts")).PLACE_HITS_ENCELADUS;
    case "epimetheus": return (await import("../places/search/epimetheus.ts")).PLACE_HITS_EPIMETHEUS;
    case "eros": return (await import("../places/search/eros.ts")).PLACE_HITS_EROS;
    case "europa": return (await import("../places/search/europa.ts")).PLACE_HITS_EUROPA;
    case "ganymede": return (await import("../places/search/ganymede.ts")).PLACE_HITS_GANYMEDE;
    case "gaspra": return (await import("../places/search/gaspra.ts")).PLACE_HITS_GASPRA;
    case "hyperion": return (await import("../places/search/hyperion.ts")).PLACE_HITS_HYPERION;
    case "iapetus": return (await import("../places/search/iapetus.ts")).PLACE_HITS_IAPETUS;
    case "ida": return (await import("../places/search/ida.ts")).PLACE_HITS_IDA;
    case "io": return (await import("../places/search/io.ts")).PLACE_HITS_IO;
    case "itokawa": return (await import("../places/search/itokawa.ts")).PLACE_HITS_ITOKAWA;
    case "janus": return (await import("../places/search/janus.ts")).PLACE_HITS_JANUS;
    case "jupiter": return (await import("../places/search/jupiter.ts")).PLACE_HITS_JUPITER;
    case "lutetia": return (await import("../places/search/lutetia.ts")).PLACE_HITS_LUTETIA;
    case "mars": return (await import("../places/search/mars.ts")).PLACE_HITS_MARS;
    case "mathilde": return (await import("../places/search/mathilde.ts")).PLACE_HITS_MATHILDE;
    case "mercury": return (await import("../places/search/mercury.ts")).PLACE_HITS_MERCURY;
    case "mimas": return (await import("../places/search/mimas.ts")).PLACE_HITS_MIMAS;
    case "miranda": return (await import("../places/search/miranda.ts")).PLACE_HITS_MIRANDA;
    case "moon": return (await import("../places/search/moon.ts")).PLACE_HITS_MOON;
    case "moon-satellites": return (await import("../places/search/moon-satellites.ts")).PLACE_HITS_MOON_SATELLITES;
    case "oberon": return (await import("../places/search/oberon.ts")).PLACE_HITS_OBERON;
    case "phobos": return (await import("../places/search/phobos.ts")).PLACE_HITS_PHOBOS;
    case "phoebe": return (await import("../places/search/phoebe.ts")).PLACE_HITS_PHOEBE;
    case "pluto": return (await import("../places/search/pluto.ts")).PLACE_HITS_PLUTO;
    case "proteus": return (await import("../places/search/proteus.ts")).PLACE_HITS_PROTEUS;
    case "rhea": return (await import("../places/search/rhea.ts")).PLACE_HITS_RHEA;
    case "ryugu": return (await import("../places/search/ryugu.ts")).PLACE_HITS_RYUGU;
    case "saturn": return (await import("../places/search/saturn.ts")).PLACE_HITS_SATURN;
    case "steins": return (await import("../places/search/steins.ts")).PLACE_HITS_STEINS;
    case "tempel-1": return (await import("../places/search/tempel-1.ts")).PLACE_HITS_TEMPEL_1;
    case "tethys": return (await import("../places/search/tethys.ts")).PLACE_HITS_TETHYS;
    case "thebe": return (await import("../places/search/thebe.ts")).PLACE_HITS_THEBE;
    case "titan": return (await import("../places/search/titan.ts")).PLACE_HITS_TITAN;
    case "titania": return (await import("../places/search/titania.ts")).PLACE_HITS_TITANIA;
    case "triton": return (await import("../places/search/triton.ts")).PLACE_HITS_TRITON;
    case "umbriel": return (await import("../places/search/umbriel.ts")).PLACE_HITS_UMBRIEL;
    case "venus": return (await import("../places/search/venus.ts")).PLACE_HITS_VENUS;
    case "vesta": return (await import("../places/search/vesta.ts")).PLACE_HITS_VESTA;
    default: throw new RangeError(`no search list for ${String(body)}`);
  }
}
