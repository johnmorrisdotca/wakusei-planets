// Which body's surface picture comes from which source, written from the rows of NOTICE.md (the "Surface pictures" table). Pure: no DOM, no three.js.
// A page that shows a body names only that body's row. The English credit is the table's credit column, unchanged; the Japanese says the same fact.
import { BODIES, type BodyId } from "./facts.ts";

/**
 * One body's surface picture: who made the map, the licence named in `NOTICE.md`, and, for a CC BY 4.0 map, what this package changed.
 *
 * @example
 * ```ts
 * import { PICTURE_CREDITS, type PictureCredit } from "@johnmorrisdotca/wakusei-planets";
 *
 * const jupiter: PictureCredit = PICTURE_CREDITS.find((row) => row.id === "jupiter")!;
 * console.log(jupiter.licence);
 * ```
 */
export interface PictureCredit {
  /** The body, as `BODY_IDS` names it. */
  readonly id: BodyId;
  /** The licence of that body's map in `NOTICE.md`: `CC BY 4.0` or `Public domain`. */
  readonly licence: "CC BY 4.0" | "Public domain";
  /** The credit column of `NOTICE.md` for this picture, in English, and the same fact in Japanese. */
  readonly credit: { readonly en: string; readonly ja: string };
  /** What this package changed, from the table's "What was done" column. Present for a CC BY 4.0 map, which asks that changes be named. */
  readonly changes?: { readonly en: string; readonly ja: string };
  /** Another picture drawn with the body (Saturn's rings), with its own credit and licence. */
  readonly also?: { readonly en: string; readonly ja: string };
}

const cc = (
  id: BodyId,
  en: string,
  ja: string,
  changesEn: string,
  changesJa: string,
  also?: { en: string; ja: string },
): PictureCredit => ({
  id,
  licence: "CC BY 4.0",
  credit: { en, ja },
  changes: { en: changesEn, ja: changesJa },
  ...(also === undefined ? {} : { also: { en: also.en, ja: also.ja } }),
});

const pd = (id: BodyId, en: string, ja: string): PictureCredit => ({ id, licence: "Public domain", credit: { en, ja } });

/**
 * The surface picture of every body that has one, in the order of the table in `NOTICE.md`. A body with no row is drawn from numbers and has no picture to credit.
 * The English of a CC BY 4.0 row is that table's credit column. Jupiter and Uranus keep the authors' own attribution sentences, including the spelling of the name.
 *
 * @example
 * ```ts
 * import { PICTURE_CREDITS } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(PICTURE_CREDITS.filter((row) => row.licence === "CC BY 4.0").map((row) => row.id).join(","));
 * ```
 */
export const PICTURE_CREDITS: readonly PictureCredit[] = [
  cc(
    "mercury",
    "Shady Tex and Solar System Scope",
    "Shady TexとSolar System Scope",
    "Natural grey, resized to 512, 1024 and 2048. The normal map is not used.",
    "自然な灰色にし、512、1024、2048に縮小しました。法線マップは使っていません。",
  ),
  cc(
    "venus",
    "Solar System Scope",
    "Solar System Scope",
    "Equirectangular surface map, resized to 512, 1024 and 2048.",
    "正距円筒図法の表面の地図を、512、1024、2048に縮小しました。",
  ),
  pd("mars", "NASA / Jet Propulsion Lab / USGS", "NASA / Jet Propulsion Lab / USGS"),
  cc(
    "jupiter",
    'This work is based on "Jupiter" (https://sketchfab.com/3d-models/jupiter-6380860bdb4247b98b30643615c3afab) by Nestaeric (https://sketchfab.com/Nestaeric) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
    "Nestaeric（https://sketchfab.com/Nestaeric）による「Jupiter」（https://sketchfab.com/3d-models/jupiter-6380860bdb4247b98b30643615c3afab）をもとにしています。ライセンスは CC-BY-4.0（http://creativecommons.org/licenses/by/4.0/）です",
    "The band half of the texture, with the Great Red Spot and turbulent detail, resized to 512, 1024 and 2048.",
    "大赤斑と細かい乱れのある帯の半分を使い、512、1024、2048に縮小しました。",
  ),
  cc(
    "saturn",
    "Solar System Scope; pole caps by Nestaeric",
    "Solar System Scope。極の冠はNestaeric",
    "The bands are Solar System Scope's map. The last 20 degrees at each pole are reprojected from Nestaeric's caps, and the north cap has the hexagon.",
    "縞はSolar System Scopeの地図です。両極の端の20度はNestaericの冠を張り直し、北の冠には六角形があります。",
    {
      en: "Rings: NASA / JPL / Space Science Institute (public domain).",
      ja: "環：NASA / JPL / Space Science Institute（パブリックドメイン）。",
    },
  ),
  cc(
    "uranus",
    'This work is based on "Uranus" (https://sketchfab.com/3d-models/uranus-0009a69dbace44608c0bd09af9ba20db) by NestaEric (https://sketchfab.com/Nestaeric) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
    "NestaEric（https://sketchfab.com/Nestaeric）による「Uranus」（https://sketchfab.com/3d-models/uranus-0009a69dbace44608c0bd09af9ba20db）をもとにしています。ライセンスは CC-BY-4.0（http://creativecommons.org/licenses/by/4.0/）です",
    "The band half of the texture, which has a bright spot, resized to 512, 1024 and 2048.",
    "明るい斑のある帯の半分を使い、512、1024、2048に縮小しました。",
  ),
  cc(
    "neptune",
    "Solar System Scope",
    "Solar System Scope",
    "Equirectangular map, resized to 512, 1024 and 2048.",
    "正距円筒図法の地図を、512、1024、2048に縮小しました。",
  ),
  pd("pluto", "NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute", "NASA / Johns Hopkins University Applied Physics Laboratory / Southwest Research Institute"),
  cc("sun", "Solar System Scope", "Solar System Scope", "Equirectangular map, resized to 512, 1024 and 2048.", "正距円筒図法の地図を、512、1024、2048に縮小しました。"),
  pd("moon", "NASA's Scientific Visualization Studio (Ernie Wright, Noah Petro); Lunar Reconnaissance Orbiter Camera", "NASA Scientific Visualization Studio（Ernie Wright、Noah Petro）、Lunar Reconnaissance Orbiter Camera"),
  pd("io", "NASA / JPL (Galileo SSI and Voyager images); the file page names no author", "NASA / JPL（Galileo SSIとVoyagerの画像）。ファイルのページに作者の名はありません"),
  pd("europa", "U.S. Geological Survey / Planetary Data System / Tammy Becker", "U.S. Geological Survey / Planetary Data System / Tammy Becker"),
  pd("ganymede", "USGS", "USGS"),
  pd("callisto", "USGS", "USGS"),
  pd("titan", "NASA / JPL / Space Science Institute", "NASA / JPL / Space Science Institute"),
  pd("earth", "NASA Earth Observatory (Reto Stockli), Blue Marble", "NASA Earth Observatory（Reto Stockli）、Blue Marble"),
  pd("rhea", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute"),
  pd("enceladus", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute"),
  pd("mimas", "NASA/JPL/Space Science Institute", "NASA/JPL/Space Science Institute"),
  pd("ceres", "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA", "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA"),
  pd("vesta", "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (as the file page gives it; hosted by the USGS Astrogeology Science Center's Gazetteer of Planetary Nomenclature)", "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA（ファイルのページの表記。USGS Astrogeology Science CenterのGazetteer of Planetary Nomenclatureが公開）"),
  pd("tethys", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute"),
  pd("dione", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute"),
  pd("iapetus", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute", "NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute"),
  pd("triton", "NASA/JPL-Caltech/Lunar & Planetary Institute (Paul Schenk; Voyager 2 images)", "NASA/JPL-Caltech/Lunar & Planetary Institute（Paul Schenk、Voyager 2の画像）"),
  pd("charon", "NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute (via the IAU)", "NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute（IAU経由）"),
];

const BY_ID = new Map(PICTURE_CREDITS.map((row) => [row.id, row]));

/**
 * The credit for Mercury's finer map tiles. Their detail is a public-domain map, and their colour is the 2048 picture, which is CC BY 4.0, so the tiles carry that credit too.
 * The words are the Mercury row of `NOTICE.md`'s "Finer map tiles" table.
 *
 * @param lang - `en` or `ja`.
 * @returns The one sentence.
 *
 * @example
 * ```ts
 * import { mercuryTilesCredit } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(mercuryTilesCredit("en").includes("CC BY 4.0"));
 * ```
 */
export function mercuryTilesCredit(lang: "en" | "ja"): string {
  return lang === "ja"
    ? "水星の細かい地図のタイルの色は、2048の絵（Solar System Scopeの地図、CC BY 4.0）の色です。タイルもその出典を持ちます。"
    : "The colour of Mercury's finer map tiles is the 2048 picture's (Solar System Scope's map, CC BY 4.0), so these tiles carry that credit too.";
}

const phrase = (row: PictureCredit, lang: "en" | "ja"): string => {
  const name = BODIES[row.id].name[lang];
  if (lang === "ja") {
    const licence = row.licence === "CC BY 4.0" ? "CC BY 4.0" : "パブリックドメイン";
    const changes = row.changes === undefined ? "" : `変更：${row.changes.ja}`;
    const also = row.also === undefined ? "" : row.also.ja;
    return `${name}：${row.credit.ja}（${licence}）。${changes}${also}`;
  }
  const licence = row.licence === "CC BY 4.0" ? "CC BY 4.0" : "public domain";
  const changes = row.changes === undefined ? "" : ` Changes made: ${row.changes.en}`;
  const also = row.also === undefined ? "" : ` ${row.also.en}`;
  return `${name}: ${row.credit.en} (${licence}).${changes}${also}`;
};

/**
 * The credit line for the surface pictures of the named bodies, in one language. A name is a body id in any case (`Jupiter`, `moon`). A body with no picture is left out.
 * Only the named bodies are credited: Jupiter names Nestaeric and CC BY 4.0, and the Moon and Mars, whose maps are public domain, name no CC BY 4.0 source.
 * An empty list, or a list of bodies with no pictures, is an empty string.
 *
 * @param bodies - The bodies a page is showing.
 * @param lang - `en` or `ja`.
 * @returns The line, or `""` when none of the bodies has a picture.
 *
 * @example
 * ```ts
 * import { picturesCredit } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(picturesCredit(["Jupiter"], "en").includes("Nestaeric"));
 * console.log(picturesCredit(["Moon", "Mars"], "en").includes("CC BY") === false);
 * ```
 */
export function picturesCredit(bodies: readonly string[], lang: "en" | "ja"): string {
  const seen = new Set<string>();
  const rows: PictureCredit[] = [];
  for (const name of bodies) {
    const id = name.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const row = BY_ID.get(id as BodyId);
    if (row !== undefined) rows.push(row);
  }
  if (rows.length === 0) return "";
  const head = lang === "ja" ? "表面の地図：" : "Surface pictures: ";
  return head + rows.map((row) => phrase(row, lang)).join(lang === "ja" ? "" : " ");
}
