import { STELLAR_INTERIOR_DATA as data } from "./data/stellar-interior.ts";
import type { InteriorLayer } from "./interior.ts";
import type { InteriorProfile } from "./interior-profile.ts";
import type { StarNumbers } from "./star.ts";
import { STELLAR_MODEL_IDS } from "./stellar-model-ids.ts";

type Localized = { en: string; ja: string };

interface StellarExample {
  id: string;
  name: Localized;
  numbers: StarNumbers;
  interior: InteriorProfile;
  /** The number of inner layers shown in a separate magnified detail. */
  detail?: number;
}

const MESA = "https://github.com/MESAHub/mesa/blob/24.08.1/";

function example(id: string, name: Localized, model: { radiusKm: number; temperatureK: number }, luminosityClass: StarNumbers["luminosityClass"], path: string, layers: readonly InteriorLayer[], note: Localized, detail?: number): StellarExample {
  return {
    id,
    name,
    numbers: { name: name.en, temperatureK: model.temperatureK, radiusSun: model.radiusKm / 695700, luminosityClass },
    interior: { radiusKm: model.radiusKm, radiusAbout: true, layers, source: { page: MESA + path, read: "2026-11-27" }, note },
    ...(detail === undefined ? {} : { detail }),
  };
}

const dwarf = example(STELLAR_MODEL_IDS.dwarf, { en: "0.20 M☉ red dwarf", ja: "0.20 太陽質量の赤色矮星" }, data.dwarf, "V", "data/star_data/zams_models/zams_z2m2_y28.data", [
  { id: "convective-interior", name: { en: "Convective interior", ja: "対流する内部" }, madeOf: { en: "well-mixed hydrogen and helium", ja: "よく混ざった水素とヘリウム" }, outerKm: data.dwarf.radiusKm, about: false, colour: "#c66c44", flow: true },
], {
  en: "MESA 4afeff1, 0.199526 M☉. Age zero on the main sequence. Initial helium Y = 0.28, heavy elements Z = 0.02.",
  ja: "MESA 4afeff1、0.199526 太陽質量。年齢ゼロの主系列（ZAMS）のモデルです。初期ヘリウム質量分率 Y = 0.28、初期重元素質量分率 Z = 0.02。",
});

const massive = example(STELLAR_MODEL_IDS.massive, { en: "20 M☉ hot main-sequence star", ja: "20 太陽質量の高温主系列星" }, data.massive, "V", "star/test_suite/20M_pre_ms_to_core_collapse/standard_zams.mod", [
  { id: "convective-core", name: { en: "Convective core", ja: "対流核" }, madeOf: { en: "hydrogen fuses into helium", ja: "水素が核融合してヘリウムになる" }, outerKm: data.massive.coreKm, about: true, colour: "#f6cc76", flow: true },
  { id: "radiative-envelope", name: { en: "Mostly radiative envelope", ja: "主に放射で熱を運ぶ外層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: data.massive.radiusKm, about: false, colour: "#698fac" },
], {
  en: "MESA c9ff9db, model 441. Mass 20 M☉, age 0.928 million years, initial Z = 0.0142. Thin surface convection zones lie within the envelope.",
  ja: "MESA c9ff9db、モデル 441。質量は 20 太陽質量、年齢は 92.8万年、初期重元素質量分率 Z = 0.0142。外層の表面近くには、薄い対流層がいくつかあります。",
});

const giant = example(STELLAR_MODEL_IDS.giant, { en: "Red giant at helium ignition", ja: "ヘリウム点火が始まる赤色巨星" }, data.giant, "III", "star/test_suite/1M_pre_ms_to_wd/standard_start_he_core_flash.mod", [
  { id: "helium-core", name: { en: "Hydrogen-exhausted core", ja: "水素を使い尽くした中心核" }, madeOf: { en: "mostly helium", ja: "主にヘリウム" }, outerKm: data.giant.coreKm, about: true, colour: "#efe0ba" },
  { id: "hydrogen-shell", name: { en: "Hydrogen-burning shell", ja: "水素燃焼殻" }, madeOf: { en: "hydrogen fuses into helium", ja: "水素が核融合してヘリウムになる" }, outerKm: data.giant.burningShellKm, about: true, colour: "#f29a46" },
  { id: "radiative-region", name: { en: "Radiative region", ja: "放射層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: data.giant.envelopeBaseKm, about: true, colour: "#936074" },
  { id: "convective-envelope", name: { en: "Convective envelope", ja: "対流外層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: data.giant.envelopeTopKm, about: true, colour: "#b3674a", flow: true },
  { id: "atmosphere", name: { en: "Outer layers", ja: "最外層" }, madeOf: { en: "hydrogen and helium", ja: "水素とヘリウム" }, outerKm: data.giant.radiusKm, about: false, colour: "#88433f" },
], {
  en: "MESA 15121, model 9589. Mass 0.804 M☉ from a 1 M☉ progenitor, age 12.284 billion years, initial Z = 0.02. The hydrogen shell supplies almost all the luminosity at this early onset of helium ignition.",
  ja: "MESA 15121、モデル 9589。初期質量は 1 太陽質量、このモデルの質量は 0.804 太陽質量。年齢は 122.84億年、初期重元素質量分率 Z = 0.02。ヘリウム点火が始まったばかりのこの時点では、光度のほとんどを水素燃焼殻がまかなっています。",
}, 2);

const whiteDwarf = example(STELLAR_MODEL_IDS.whiteDwarf, { en: "0.61 M☉ hot white dwarf", ja: "0.61 太陽質量の高温白色矮星" }, data.whiteDwarf, "D", "star/test_suite/wd_cool_0.6M/co_wd_settled.mod", [
  { id: "carbon-oxygen-core", name: { en: "Carbon–oxygen core", ja: "炭素・酸素核" }, madeOf: { en: "mostly oxygen and carbon", ja: "主に酸素と炭素" }, outerKm: data.whiteDwarf.coreKm, about: true, colour: "#718fa9" },
  { id: "helium-layer", name: { en: "Helium-rich layer", ja: "ヘリウムに富む層" }, madeOf: { en: "helium above the C/O mixture", ja: "炭素・酸素の混合物を覆うヘリウム" }, outerKm: data.whiteDwarf.heliumOutsideKm, about: true, colour: "#aaa5d0" },
  { id: "hydrogen-layer", name: { en: "Hydrogen-rich envelope", ja: "水素に富む外層" }, madeOf: { en: "mostly hydrogen", ja: "主に水素" }, outerKm: data.whiteDwarf.radiusKm, about: false, colour: "#e9d2a8" },
], {
  en: "MESA f3de5e0, model 1406. Mass 0.61132 M☉, age 433 million years from the progenitor calculation, initial Z = 0.02. This snapshot starts the cooling test.",
  ja: "MESA f3de5e0、モデル 1406。質量は 0.61132 太陽質量、前駆星の進化計算の開始から 4.33億年、初期重元素質量分率 Z = 0.02。冷却計算のテストの開始時点の構造です。",
});

export const STELLAR_EXAMPLES = [dwarf, massive, giant, whiteDwarf] as const;

/** A model is selected by an explicit name. Spectral class alone does not select an interior. */
export function stellarExample(id: string | null | undefined): StellarExample | undefined {
  return STELLAR_EXAMPLES.find((model) => model.id === id);
}
