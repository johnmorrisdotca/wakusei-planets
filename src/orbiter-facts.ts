// What is known about each orbiter: names, operator, launch, instruments, a line about it in our own words, and the state of its mission. Every fact is typed from the craft's own
// JPL Horizons object page (NASA/JPL, public domain), read 2026-11-11 by scripts/make-orbiter-data.py (NOTICE.md names them); a fact the page does not give is left out, never guessed.
// The Japanese names and lines are ours.

/**
 * One instrument an orbiter carries, as its Horizons page lists it.
 *
 * @example
 * ```ts
 * import { ORBITER_FACTS, type OrbiterInstrument } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const camera: OrbiterInstrument = ORBITER_FACTS.lro.instruments.find((one) => one.short === "LROC")!;
 * console.log(camera.name);
 * ```
 */
export interface OrbiterInstrument {
  name: string;
  short?: string;
}

/**
 * Facts about one orbiter.
 *
 * @example
 * ```ts
 * import { ORBITER_FACTS, type OrbiterFacts } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * const hope: OrbiterFacts = ORBITER_FACTS.hope;
 * console.log(hope.name.en, hope.operator, hope.about.en);
 * ```
 */
export interface OrbiterFacts {
  /** The craft's name in English and Japanese. */
  name: { en: string; ja: string };
  /** The body it goes round. */
  centre: "moon" | "mars";
  /** The agency or organisation that runs it. */
  operator: string;
  /** The launch: the date (ISO, UTC, to the minute where the page gives one), the rocket, and the site, as the page gives them. */
  launch: { date: string; vehicle?: string; site?: string };
  /** The instruments the page lists (none listed: an empty list). */
  instruments: readonly OrbiterInstrument[];
  /** One line about the craft, in our own words. */
  about: { en: string; ja: string };
  /** `flying`: in orbit and tracked; `ended`: the mission is over, or contact was lost (the date, where the page gives one). */
  status: { state: "flying" | "ended"; since?: string; note?: { en: string; ja: string } };
  /** JPL Horizons' number for the craft, where its page is. */
  horizonsId: number;
}

/**
 * The orbiters' facts by id.
 *
 * @example
 * ```ts
 * import { ORBITER_FACTS } from "@johnmorrisdotca/wakusei-planets/orbiters";
 *
 * console.log(Object.keys(ORBITER_FACTS).length, "orbiters;", ORBITER_FACTS.danuri.operator);
 * ```
 */
export const ORBITER_FACTS = {
  lro: {
    name: { en: "Lunar Reconnaissance Orbiter", ja: "ルナー・リコネサンス・オービター" },
    centre: "moon",
    operator: "NASA (Goddard Space Flight Center)",
    launch: { date: "2009-06-18T09:32Z", vehicle: "Atlas V", site: "Cape Canaveral, launch complex 41" },
    instruments: [
      { name: "Cosmic Ray Telescope for the Effects of Radiation", short: "CRaTER" },
      { name: "Diviner Lunar Radiometer Experiment", short: "DLRE" },
      { name: "Lyman Alpha Mapping Project", short: "LAMP" },
      { name: "Lunar Exploration Neutron Detector", short: "LEND" },
      { name: "Lunar Orbiter Laser Altimeter", short: "LOLA" },
      { name: "Lunar Reconnaissance Orbiter Camera", short: "LROC" },
      { name: "Mini-RF Technology Demonstration", short: "Mini-RF" },
    ],
    about: { en: "NASA's mapping orbiter since 2009: a global geodetic grid, day and night temperatures, high-resolution pictures and the hunt for water at the poles, now in a low-maintenance orbit as a relay and south-pole observer.", ja: "2009年から月の地図づくりを続けるNASAの周回機です。全球の測地グリッド、昼夜の温度、高解像度の画像を作り、極の水を探してきました。いまは手のかからない軌道で、中継と南極の観測を続けています。" },
    status: { state: "flying" },
    horizonsId: -85,
  },
  "chandrayaan-2": {
    name: { en: "Chandrayaan-2 orbiter", ja: "チャンドラヤーン2号 オービター" },
    centre: "moon",
    operator: "ISRO",
    launch: { date: "2019-07-22T09:13Z", vehicle: "GSLV Mk III", site: "Satish Dhawan Space Centre, Sriharikota" },
    instruments: [],
    about: { en: "India's lunar orbiter: it carried the Vikram lander and Pragyan rover, which were lost on landing in 2019, and goes on in a near-circular polar orbit about 100 km up, studying the surface, the exosphere and signs of water ice.", ja: "インドの月周回機。2019年の着陸で失われたヴィクラム着陸機とプラギャン探査車を運び、いまは高度約100 kmのほぼ円形の極軌道で、表面、外気圏、水氷の兆候を調べています。" },
    status: { state: "flying" },
    horizonsId: -152,
  },
  danuri: {
    name: { en: "Danuri (KPLO)", ja: "ダヌリ (KPLO)" },
    centre: "moon",
    operator: "KARI (Korea Aerospace Research Institute)",
    launch: { date: "2022-08-04T23:08Z", vehicle: "Falcon 9 Block 5", site: "Cape Canaveral, SLC-40" },
    instruments: [
      { name: "Lunar Terrain Imager", short: "LUTI" },
      { name: "Wide-Angle Polarimetric Camera", short: "PolCam" },
      { name: "KPLO Magnetometer", short: "KMAG" },
      { name: "KPLO Gamma Ray Spectrometer", short: "KGRS" },
      { name: "Disruption Tolerant Network experiment", short: "DTNPL" },
      { name: "ShadowCam (NASA)", short: "ShadowCam" },
    ],
    about: { en: "South Korea's first lunar mission: it reached the Moon by a ballistic transfer in December 2022 and images landing sites, maps minerals and the magnetic field, and looks into the permanently shadowed craters with NASA's ShadowCam.", ja: "韓国初の月探査機。2022年12月に弾道月遷移軌道で月に着き、着陸地点の撮影、鉱物と磁場の地図づくり、NASAのShadowCamによる永久影のクレーターの観測をしています。" },
    status: { state: "flying" },
    horizonsId: -155,
  },
  "artemis-p1": {
    name: { en: "ARTEMIS P1", ja: "ARTEMIS P1" },
    centre: "moon",
    operator: "NASA (University of California, Berkeley)",
    launch: { date: "2007-02-17T23:01Z", vehicle: "Delta II 7925-10C", site: "Cape Canaveral" },
    instruments: [
      { name: "Fluxgate Magnetometer", short: "FGM" },
      { name: "Electrostatic Analyzer", short: "ESA" },
      { name: "Solid-State Telescope", short: "SST" },
      { name: "Search Coil Magnetometer", short: "SCM" },
      { name: "Electric Field Instrument", short: "EFI" },
    ],
    about: { en: "One of the five THEMIS satellites, sent on from Earth orbit in 2009 and the first craft to orbit an Earth-Moon Lagrange point; since 2011 it circles the Moon on a long, lopsided orbit (about 100 by 19,000 km, 26 hours) studying the solar wind and the lunar wake.", ja: "THEMIS衛星5機のうちの1機。2009年に地球軌道から送り出され、地球と月のラグランジュ点を初めて周回した探査機です。2011年からは細長い月周回軌道 (約100 × 19,000 km、26時間) で太陽風と月の後流を調べています。" },
    status: { state: "flying" },
    horizonsId: -192,
  },
  "artemis-p2": {
    name: { en: "ARTEMIS P2", ja: "ARTEMIS P2" },
    centre: "moon",
    operator: "NASA (University of California, Berkeley)",
    launch: { date: "2007-02-17T23:01Z", vehicle: "Delta II 7925-10C", site: "Cape Canaveral" },
    instruments: [
      { name: "Fluxgate Magnetometer", short: "FGM" },
      { name: "Electrostatic Analyzer", short: "ESA" },
      { name: "Solid-State Telescope", short: "SST" },
      { name: "Search Coil Magnetometer", short: "SCM" },
      { name: "Electric Field Instrument", short: "EFI" },
    ],
    about: { en: "ARTEMIS P1's twin, the first craft to orbit the Earth-Moon L1 point; in a long lunar orbit since July 2011, measuring particles and fields where the Moon meets the solar wind.", ja: "ARTEMIS P1の双子機で、地球と月のL1点を初めて周回しました。2011年7月から細長い月周回軌道で、月が太陽風と出会う場所の粒子と電磁場を測っています。" },
    status: { state: "flying" },
    horizonsId: -193,
  },
  capstone: {
    name: { en: "CAPSTONE", ja: "キャップストーン" },
    centre: "moon",
    operator: "NASA (Advanced Space)",
    launch: { date: "2022-06-28T09:55:52Z", vehicle: "Electron (Rocket Lab)", site: "Mahia Peninsula, New Zealand" },
    instruments: [],
    about: { en: "A 25 kg CubeSat that flew the near-rectilinear halo orbit planned for the Gateway outpost, passing within about 1,600 km of one lunar pole and 70,000 km from the other every seven days, and tested navigation with LRO. Its halo orbit is no ellipse, so no path is drawn for it.", ja: "ゲートウェイ拠点のために計画された近直線ハロー軌道を飛んだ25 kgのキューブサット。7日ごとに、月の一方の極の約1,600 km以内を通り、もう一方の極からは70,000 km離れ、LROとの航法の試験をしました。ハロー軌道は楕円ではないので、経路は描きません。" },
    status: { state: "ended", since: "2026-07", note: { en: "Horizons' page says no further updates for this completed mission (note of 2026-07-28); its track ends 2026-08-14.", ja: "Horizonsのページに、このミッションは完了したので今後の更新はない、とあります (2026-07-28の注記)。経路データは2026-08-14で終わります。" } },
    horizonsId: -1176,
  },
  mro: {
    name: { en: "Mars Reconnaissance Orbiter", ja: "マーズ・リコネサンス・オービター" },
    centre: "mars",
    operator: "NASA (JPL)",
    launch: { date: "2005-08-12T11:43Z", vehicle: "Atlas V", site: "Cape Canaveral" },
    instruments: [],
    about: { en: "NASA's high-resolution eye on Mars since 2006, in a near-circular polar orbit of about 112 minutes after six months of aerobraking; it also relays the rovers' data.", ja: "2006年から火星を高解像度で見つめるNASAの探査機です。6か月の大気制動のあと、周期約112分のほぼ円形の極軌道にあり、探査車のデータの中継もしています。" },
    status: { state: "flying" },
    horizonsId: -74,
  },
  odyssey: {
    name: { en: "2001 Mars Odyssey", ja: "2001マーズ・オデッセイ" },
    centre: "mars",
    operator: "NASA (JPL)",
    launch: { date: "2001-04-07T15:02Z", vehicle: "Delta II 7925" },
    instruments: [
      { name: "Thermal Emission Imaging System", short: "THEMIS" },
      { name: "Gamma Ray Spectrometer", short: "GRS" },
      { name: "Mars Radiation Environment Experiment", short: "MARIE" },
    ],
    about: { en: "The longest-serving craft at Mars: it mapped the surface's elements and minerals, found water ice buried near the poles, measured radiation in orbit, and has relayed most of the rovers' data since 2004.", ja: "火星で最も長く働く探査機。表面の元素と鉱物を地図にし、極の近くに埋まった水氷を見つけ、軌道上の放射線を測り、2004年から探査車のデータの大半を中継しています。" },
    status: { state: "flying" },
    horizonsId: -53,
  },
  maven: {
    name: { en: "MAVEN", ja: "メイヴン" },
    centre: "mars",
    operator: "NASA (Goddard Space Flight Center)",
    launch: { date: "2013-11-18T18:28Z", vehicle: "Atlas V 401", site: "Cape Canaveral, SLC-41" },
    instruments: [
      { name: "Particles and Fields Package", short: "PFP" },
      { name: "Imaging Ultraviolet Spectrometer", short: "IUVS" },
      { name: "Neutral Gas and Ion Mass Spectrometer", short: "NGIMS" },
    ],
    about: { en: "The Mars Atmosphere and Volatile Evolution orbiter studied how the upper atmosphere is lost to space from a 150 by 6,200 km orbit; contact was lost in December 2025 and NASA ended the mission in 2026, so its last known orbit is shown as modelled.", ja: "火星の上層大気がどう宇宙へ失われるかを、150 × 6,200 kmの軌道から調べた探査機。2025年12月に交信が途絶え、2026年にNASAがミッションを終えたので、最後に分かっている軌道をモデルの軌道として示します。" },
    status: { state: "ended", since: "2025-12-06", note: { en: "Horizons' page: no contact since 2025-12-06, with evidence of an unplanned change of velocity on 2025-12-04; its fit reaches 2025-12-04 and its track ends 2026-03-01.", ja: "Horizonsのページ: 2025-12-06から交信がなく、2025-12-04に予定外の速度変化があった形跡があります。フィットは2025-12-04まで、経路データは2026-03-01で終わります。" } },
    horizonsId: -202,
  },
  "mars-express": {
    name: { en: "Mars Express", ja: "マーズ・エクスプレス" },
    centre: "mars",
    operator: "ESA",
    launch: { date: "2003-06-02", vehicle: "Soyuz-Fregat", site: "Baikonur" },
    instruments: [],
    about: { en: "Europe's first Mars orbiter, in a long elliptical orbit (about 258 by 11,560 km, 6 hours 43 minutes) since December 2003; its Beagle 2 lander was lost on arrival.", ja: "ヨーロッパ初の火星周回機。2003年12月から細長い楕円軌道 (約258 × 11,560 km、6時間43分) にあります。運んだ着陸機ビーグル2は到着時に失われました。" },
    status: { state: "flying" },
    horizonsId: -41,
  },
  tgo: {
    name: { en: "ExoMars Trace Gas Orbiter", ja: "エクソマーズ・トレース・ガス・オービター" },
    centre: "mars",
    operator: "ESA (with Roscosmos)",
    launch: { date: "2016-03-14T09:31Z", vehicle: "Proton", site: "Baikonur" },
    instruments: [
      { name: "Atmospheric Chemistry Suite", short: "ACS" },
      { name: "Colour and Stereo Surface Imaging System", short: "CaSSIS" },
      { name: "Fine Resolution Epithermal Neutron Detector", short: "FREND" },
      { name: "Nadir and Occultation for Mars Discovery", short: "NOMAD" },
    ],
    about: { en: "ESA's orbiter hunting methane and other trace gases from a circular 400 km orbit inclined 74 degrees, reached by a year of aerobraking in 2017; the Schiaparelli lander it carried was destroyed on landing.", ja: "メタンなどの微量ガスを探すESAの周回機。2017年に1年かけた大気制動で、軌道傾斜角74度、高度400 kmの円軌道に入りました。運んだ着陸機スキアパレッリは着陸時に壊れました。" },
    status: { state: "flying" },
    horizonsId: -143,
  },
  hope: {
    name: { en: "Hope (Emirates Mars Mission)", ja: "ホープ (エミレーツ・マーズ・ミッション)" },
    centre: "mars",
    operator: "Mohammed Bin Rashid Space Centre (United Arab Emirates)",
    launch: { date: "2020-07-19T21:58:14Z", vehicle: "H-IIA 202", site: "Tanegashima, Japan" },
    instruments: [
      { name: "Emirates eXploration Imager", short: "EXI" },
      { name: "Emirates Mars Ultraviolet Spectrometer", short: "EMUS" },
      { name: "Emirates Mars Infrared Spectrometer", short: "EMIRS" },
    ],
    about: { en: "The United Arab Emirates' weather satellite for Mars: from a high orbit of about 22,000 by 44,000 km (55 hours) it watches the whole atmosphere through the day and the year.", ja: "アラブ首長国連邦の火星気象衛星。約22,000 × 44,000 km (55時間) の高い軌道から、一日と一年を通して大気全体を見ています。" },
    status: { state: "flying" },
    horizonsId: -62,
  },
  "tianwen-1": {
    name: { en: "Tianwen-1 orbiter", ja: "天問1号 オービター" },
    centre: "mars",
    operator: "CNSA",
    launch: { date: "2020-07-23T04:41Z", vehicle: "Long March 5", site: "Wenchang, Hainan" },
    instruments: [],
    about: { en: "China's first Mars mission, an orbiter with seven instruments that carried the Zhurong rover to Utopia Planitia in 2021. Horizons holds only a volunteers' track of its cruise, ending at arrival, so no orbit is drawn for it.", ja: "中国初の火星ミッション。7つの観測機器を持つ周回機で、2021年に探査車「祝融号」をユートピア平原へ運びました。Horizonsにはボランティアによる巡航の追跡しかなく、到着で終わるので、軌道は描きません。" },
    status: { state: "flying", note: { en: "No public orbit track: Horizons' record is the cruise to Mars, from ground-based volunteers, ending 2021-02-10.", ja: "公開された軌道データはありません。Horizonsの記録は地上のボランティアによる火星への巡航の追跡で、2021-02-10で終わります。" } },
    horizonsId: -9901491,
  },
} as const satisfies Record<string, OrbiterFacts>;
