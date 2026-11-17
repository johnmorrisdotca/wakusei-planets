// The flat solar system's own words, in English and Japanese. The names of the bodies, the belts, the comets and the craft come from the package's own tables, not from here.
// The keys the flat maps also have (`map`, `controls`, `layersFilter`, `zoomIn`, `zoomOut`, `all`, `help`, `nothing`, `shown`) say the same kind of thing in the same words, so a page that swaps one map for the other keeps its wording.
import type { FlatLang } from "./words.ts";

/**
 * The words the flat solar system writes, one table for each language: `{name}`, `{distance}` and the like are filled in. The Japanese is standard, polite Japanese.
 *
 * @example
 * ```ts
 * import { SYSTEM_WORDS } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(SYSTEM_WORDS.en.orbits, SYSTEM_WORDS.ja.orbits);
 * ```
 */
export const SYSTEM_WORDS: Readonly<Record<FlatLang, Readonly<Record<string, string>>>> = {
  en: {
    map: "Flat map of the solar system",
    controls: "Map controls",
    centreOn: "Centre the map on {where}",
    sun: "Sun",
    earth: "Earth",
    layersFilter: "What to show",
    planets: "Planets",
    dwarfs: "Dwarf planets and small bodies",
    belts: "Belts",
    comets: "Comets",
    craft: "Spacecraft",
    orbits: "Orbits",
    track: "Paths",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    all: "All",
    scaleSqueezed: "Squeezed scale",
    scaleTrue: "To scale",
    scaleNoteSqueezed: "Distances are squeezed so the inner planets show; the rings are {rings} au from the Sun.",
    scaleNoteTrue: "Distances are in proportion; the rings are {rings} au from the Sun.",
    kind_star: "star",
    kind_planet: "planet",
    "kind_dwarf-planet": "dwarf planet",
    kind_asteroid: "asteroid",
    kind_centaur: "centaur",
    kind_comet: "comet",
    kind_spacecraft: "spacecraft",
    kind_belt: "belt body",
    announceBody: "{name}, {kind}, {distance} au from the Sun{note}",
    announceSun: "{name}, the Sun, at the middle of the map",
    predicted: ", position predicted",
    help: "Arrow keys move from one body to the next, Enter chooses it, plus and minus zoom.",
    shown: "{n} bodies shown",
    nothing: "Nothing to show.",
    ring: "{n} au",
  },
  ja: {
    map: "太陽系の平面図",
    controls: "地図の操作",
    centreOn: "地図の中心を{where}にする",
    sun: "太陽",
    earth: "地球",
    layersFilter: "表示するもの",
    planets: "惑星",
    dwarfs: "準惑星と小天体",
    belts: "小惑星帯など",
    comets: "彗星",
    craft: "探査機",
    orbits: "軌道",
    track: "航跡",
    zoomIn: "拡大",
    zoomOut: "縮小",
    all: "すべて",
    scaleSqueezed: "圧縮表示",
    scaleTrue: "実寸表示",
    scaleNoteSqueezed: "内側の惑星が見えるよう距離を圧縮しています。輪は太陽から{rings} auです。",
    scaleNoteTrue: "距離は実際の比で表示しています。輪は太陽から{rings} auです。",
    kind_star: "恒星",
    kind_planet: "惑星",
    "kind_dwarf-planet": "準惑星",
    kind_asteroid: "小惑星",
    kind_centaur: "ケンタウルス族",
    kind_comet: "彗星",
    kind_spacecraft: "探査機",
    kind_belt: "小惑星帯などの天体",
    announceBody: "{name}、{kind}、太陽から{distance} au{note}",
    announceSun: "{name}、地図の中心にある太陽",
    predicted: "、位置は予測",
    help: "矢印キーで次の天体へ移り、Enter キーで選びます。プラスとマイナスのキーで拡大・縮小します。",
    shown: "天体{n}個を表示中",
    nothing: "表示するものがありません。",
    ring: "{n} au",
  },
};

/**
 * The words with their `{name}` places filled in; a key a language does not have is said in English, and a key neither has comes back as it is.
 *
 * @param lang - `en` or `ja`.
 * @param key - A key of `SYSTEM_WORDS`.
 * @param values - What goes in the `{...}` places.
 * @returns The sentence.
 *
 * @example
 * ```ts
 * import { saySystem } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(saySystem("en", "shown", { n: 40 }), "|", saySystem("ja", "shown", { n: 40 }));
 * ```
 */
export const saySystem = (lang: FlatLang, key: string, values: Record<string, string | number> = {}): string =>
  (SYSTEM_WORDS[lang][key] ?? SYSTEM_WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
