// The flat map's own words, in English and Japanese. The names of the bodies, the orbiters and the places come from the package's own tables (`BODIES`, `ORBITER_FACTS`, each place's `name`), not from here.
// The keys that chikyu-earth's flat map also has (`map`, `controls`, `myPlace`, `footprint`, `groundTrack`, `zoomIn`, `zoomOut`, `all`, `help`, `lookGroup`, `lookMap`, `lookPhoto`, `key`, `keyShow`, `keyHide`, `keyMarks`) say the same thing in the same words, so a page that swaps one map for the other keeps its wording.

/**
 * The two languages the flat map's words come in.
 *
 * @example
 * ```ts
 * import { FLAT_WORDS, type FlatLang } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * const lang: FlatLang = "ja";
 * console.log(FLAT_WORDS[lang].zoomIn);
 * ```
 */
export type FlatLang = "en" | "ja";

/**
 * The words the flat map writes, one table for each language: `{body}`, `{name}`, `{altitude}` and the like are filled in. The Japanese is standard, polite Japanese.
 *
 * @example
 * ```ts
 * import { FLAT_WORDS } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(FLAT_WORDS.en.footprint, FLAT_WORDS.ja.footprint);
 * ```
 */
export const FLAT_WORDS: Readonly<Record<FlatLang, Readonly<Record<string, string>>>> = {
  en: {
    map: "Flat map of {body}",
    controls: "Map controls",
    myPlace: "My place",
    centreHome: "Centre the map on my place",
    centreOn: "Centre the map on {where}",
    nearSide: "Near side",
    farSide: "Far side",
    primeMeridian: "Prime meridian",
    layersFilter: "What to show",
    orbiters: "Orbiters",
    landing: "Landing and rover sites",
    crash: "Crash and impact sites",
    planned: "Planned landings",
    feature: "Named features",
    footprint: "Footprint",
    groundTrack: "Ground track",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    all: "All",
    kind_crewed: "crewed landing",
    kind_landing: "landing",
    kind_rover: "rover",
    kind_crash: "crash",
    kind_impact: "impact",
    kind_entry: "entry",
    kind_planned: "planned landing",
    kind_feature: "named feature",
    kind_hardware: "hardware",
    kind_orbiter: "orbiter",
    status_tracked: "path fitted to tracking",
    status_predicted: "path carried on from tracking",
    status_modelled: "mean orbit only, position approximate",
    status_none: "no public path",
    announceOrbiter: "{name}, orbiting {body}, {altitude} km up{note}",
    announcePlace: "{name}, {kind} on {body}, {lat}, {lon}",
    approximate: ", position approximate",
    mapMissing: "The map picture could not be loaded. The marks are still in place.",
    nothing: "Nothing to show.",
    help: "Arrow keys move from one orbiter or mark to the next, Enter chooses it, plus and minus zoom.",
    shown: "{orbiters} orbiters and {places} places shown",
    oppositeMeridian: "Opposite side",
    lookGroup: "Look of the map",
    lookMap: "Map",
    lookPhoto: "Photo",
    key: "Key",
    keyShow: "Show the key to the map",
    keyHide: "Hide the key to the map",
    keyMarks: "What the marks on the map are",
    keySun: "The Sun is overhead",
    keyNight: "The night side, darker",
    keySunrise: "Sunrise or sunset line: the Sun is on the horizon",
    keyHome: "My place",
    keyOrbiter: "An orbiter",
    keyOrbiterApprox: "An orbiter whose position is approximate",
    keyRing: "What you chose",
    keyFootprint: "Footprint: the area that can see the orbiter",
    keyTrack: "Ground track: dashed behind the orbiter, solid ahead",
    creditShort: "{body}: {who}",
    creditWide: "{body}: {who} ({licence})",
    announceMark: "{name}, {lat}, {lon}",
    kind_mark: "mark",
  },
  ja: {
    map: "{body}の平面地図",
    controls: "地図の操作",
    myPlace: "自分の場所",
    centreHome: "地図の中心を自分の場所にする",
    centreOn: "地図の中心を{where}にする",
    nearSide: "表側",
    farSide: "裏側",
    primeMeridian: "本初子午線",
    layersFilter: "表示するもの",
    orbiters: "周回機",
    landing: "着陸地点と探査車の地点",
    crash: "墜落・衝突地点",
    planned: "着陸予定地点",
    feature: "地形の名前",
    footprint: "可視範囲",
    groundTrack: "地上軌跡",
    zoomIn: "拡大",
    zoomOut: "縮小",
    all: "すべて",
    kind_crewed: "有人着陸",
    kind_landing: "着陸",
    kind_rover: "探査車",
    kind_crash: "墜落",
    kind_impact: "衝突",
    kind_entry: "大気圏突入",
    kind_planned: "着陸予定",
    kind_feature: "地形",
    kind_hardware: "機器・部品",
    kind_orbiter: "周回機",
    status_tracked: "追跡データに合わせた軌道",
    status_predicted: "追跡データから延長した軌道",
    status_modelled: "平均軌道のみ、位置はおおよそ",
    status_none: "公開された軌道データなし",
    announceOrbiter: "{name}、{body}の周回機、高度 {altitude} km{note}",
    announcePlace: "{name}、{body}の{kind}、{lat}、{lon}",
    approximate: "、位置はおおよそ",
    mapMissing: "地図の画像を読み込めませんでした。印はそのまま表示します。",
    nothing: "表示するものがありません。",
    help: "矢印キーで次の周回機や印へ移り、Enter キーで選びます。プラスとマイナスのキーで拡大・縮小します。",
    shown: "周回機{orbiters}機と地点{places}か所を表示中",
    oppositeMeridian: "反対側",
    lookGroup: "地図の見た目",
    lookMap: "地図",
    lookPhoto: "写真",
    key: "凡例",
    keyShow: "地図の凡例を表示する",
    keyHide: "地図の凡例を閉じる",
    keyMarks: "地図の印が表すもの",
    keySun: "太陽が真上にある場所",
    keyNight: "夜の側：暗くなっています",
    keySunrise: "日の出・日の入りの線：太陽が地平線にあるところ",
    keyHome: "自分の場所",
    keyOrbiter: "周回機",
    keyOrbiterApprox: "位置がおおよその周回機",
    keyRing: "選んだもの",
    keyFootprint: "可視範囲：その周回機が見える範囲",
    keyTrack: "地上軌跡：周回機の後ろは点線、前は実線",
    creditShort: "{body}：{who}",
    creditWide: "{body}：{who}（{licence}）",
    announceMark: "{name}、{lat}、{lon}",
    kind_mark: "印",
  },
};

/**
 * The words with their `{name}` places filled in; a key a language does not have is said in English, and a key neither has comes back as it is.
 *
 * @param lang - `en` or `ja`.
 * @param key - A key of `FLAT_WORDS`.
 * @param values - What goes in the `{...}` places.
 * @returns The sentence.
 *
 * @example
 * ```ts
 * import { say } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(say("en", "map", { body: "Mars" }), "|", say("ja", "map", { body: "火星" }));
 * ```
 */
export const say = (lang: FlatLang, key: string, values: Record<string, string | number> = {}): string =>
  (FLAT_WORDS[lang][key] ?? FLAT_WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));

/**
 * A latitude or longitude with its hemisphere, in the language's way: `3.01° S` and `23.47° E`, or `南緯3.01°` and `東経23.47°`.
 *
 * @param lang - `en` or `ja`.
 * @param axis - `lat` or `lon`.
 * @param degrees - Degrees, north and east positive.
 * @returns The text.
 *
 * @example
 * ```ts
 * import { coordinateText } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(coordinateText("en", "lat", -3.01), "|", coordinateText("ja", "lon", 23.47));
 * ```
 */
export function coordinateText(lang: FlatLang, axis: "lat" | "lon", degrees: number): string {
  const value = Math.abs(degrees).toFixed(2);
  if (lang === "ja") return `${axis === "lat" ? (degrees < 0 ? "南緯" : "北緯") : degrees < 0 ? "西経" : "東経"}${value}°`;
  return `${value}° ${axis === "lat" ? (degrees < 0 ? "S" : "N") : degrees < 0 ? "W" : "E"}`;
}

/**
 * A latitude or longitude as a short label for the map's grid: `30°N` and `60°W`, or `北緯30°` and `西経60°`; `0°` for the equator and the prime meridian, and `180°` for the opposite meridian.
 *
 * @param lang - `en` or `ja`.
 * @param axis - `lat` or `lon`.
 * @param degrees - Degrees, north and east positive.
 * @returns The label.
 *
 * @example
 * ```ts
 * import { gridText } from "@johnmorrisdotca/wakusei-planets/flat";
 *
 * console.log(gridText("en", "lat", 30), gridText("en", "lon", -60), gridText("ja", "lat", -30), gridText("en", "lon", 0));
 * ```
 */
export function gridText(lang: FlatLang, axis: "lat" | "lon", degrees: number): string {
  const value = Math.abs(Math.round(degrees));
  if (value === 0 || (axis === "lon" && value === 180)) return `${value}°`;
  if (lang === "ja") return `${axis === "lat" ? (degrees < 0 ? "南緯" : "北緯") : degrees < 0 ? "西経" : "東経"}${value}°`;
  return `${value}°${axis === "lat" ? (degrees < 0 ? "S" : "N") : degrees < 0 ? "W" : "E"}`;
}
