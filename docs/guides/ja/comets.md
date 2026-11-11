---
title: 彗星
section: how-to
order: 19
description: "有名な34個の彗星の軌道 (JPL 小天体データベース)。任意の日の位置、太陽と地球からの距離、軌道の線、前回と次回の近日点通過、関連する流星群、そして新しく見つかった彗星を、新しいリリースを待たずに加える入口。"
---

`/comets` は、有名な34個の彗星を集めたもので、それぞれが任意の日にどこにいるかに答えます。各彗星には、NASA/JPL 小天体データベースの軌道、英語と日本語の名前、種類、そして流星群の母天体であるものにはその流星群が付いています。DOM も three.js も使わず、どこでも動き、読み込みの手順も要りません。表 (gzip で約6 kB) はこの入口だけが持ち、`/comets` を読み込まないページには入りません。

```ts
import { cometDistance, cometPerihelia, cometPosition, findComet } from "@johnmorrisdotca/wakusei-planets/comets";

const comet = findComet("hale-bopp")!;
const perihelion = new Date(Date.UTC(1997, 2, 29, 12));
const d = cometDistance(comet, perihelion);
console.log(comet.name.en, comet.name.ja, "was", d.sunAu.toFixed(2), "au from the Sun and", d.earthAu.toFixed(2), "au from the Earth");
console.log("x, y, z in au:", cometPosition(comet, perihelion).map((v) => v.toFixed(3)).join(", "));
console.log("1P Halley, last and next perihelion:", cometPerihelia("1P", Date.UTC(2026, 10, 11)));
```

## 収録している彗星

| 種類 | 数 | 彗星 |
|---|---|---|
| `periodic` (周期彗星: 周期200年未満の閉じた軌道で、戻ってきたもの) | 20 | 1P ハレー、2P エンケ、7P ポンス・ウィンネッケ、8P タットル、9P テンペル第1、12P ポンス・ブルックス、13P オルバース、17P ホームズ、19P ボレリー、21P ジャコビニ・ツィンナー、29P シュワスマン・ワハマン第1、45P 本田・ムルコス・パジュサーコヴァー、46P ウィルタネン、55P テンペル・タットル、67P チュリュモフ・ゲラシメンコ、73P シュワスマン・ワハマン第3、81P ヴィルト第2、96P マックホルツ第1、103P ハートレー第2、109P スイフト・タットル |
| `long-period` (長周期彗星: 周期200年以上の閉じた軌道、または恒星間と確かめられていない開いた軌道) | 11 | C/1995 O1 ヘール・ボップ、C/1996 B2 百武、C/2020 F3 ネオワイズ、C/2006 P1 マックノート、C/2011 W3 ラブジョイ、C/2012 S1 アイソン、C/2022 E3 ZTF、C/2023 A3 紫金山・アトラス、C/1973 E1 コホーテク、C/1975 V1 ウェスト、C/2021 A1 レナード |
| `interstellar` (恒星間天体: 離心率が1をはっきり超える開いた軌道) | 3 | 1I オウムアムア、2I ボリソフ、3I アトラス |

`listComets()` は、この順に全部を返し、`listComets("periodic")` は1つの種類だけを返します。`findComet(key)` は、id (`halley`)、符号 (`1P`、`C/1995 O1`)、英語名のどれでも受け付け、大文字と小文字は区別しません。記録には、`en` と `ja` の `name`、`kind`、軌道要素、軌道の質 (`condition`: データベースの符号で、0が最良、9が最悪。符号がある場合のみ)、観測の数と期間の日数、わかっている場合は核の直径、そして `showers` があります。

彗星 `halley` の id は、宇宙ビューがハレー彗星に使うものと同じです。2つは、同じ彗星を精度の異なる2通りの扱いで求めたものです。`heliocentric("halley", ...)` と宇宙ビューは、1800年から2200年まで Horizons にあてはめた表を使い、惑星の引力を含みます。`/comets` は小天体データベースの解を単純な二体問題の軌道として扱い、元期 (1968-01-20) では正確で、そこから離れるとずれます。元期の前後1年以内では2つは 1e-5 au 以内で一致します。ハレー彗星の位置は、日付が重要なら `heliocentric` のほうがよく、`/comets` は軌道要素、軌道の線、流星群を持つ入口です。

## 彗星の位置

```ts
import { cometDistance, cometOrbit, cometPosition, cometTrust } from "@johnmorrisdotca/wakusei-planets/comets";

const day = new Date(Date.UTC(2020, 6, 3));
const [x, y, z] = cometPosition("neowise", day);
console.log("NEOWISE at perihelion:", x.toFixed(3), y.toFixed(3), z.toFixed(3), "au; from the Sun", cometDistance("neowise", day).sunAu.toFixed(3), "au");
console.log(cometTrust("neowise", day));
const line = cometOrbit("halley", 200);
console.log(line.length / 3, "points to draw Halley's orbit through, closed");
```

`cometPosition(comet, when)` は、太陽から見た x、y、z を天文単位で、J2000 黄道座標 (`heliocentric` と同じ軸) で返すので、彗星と惑星を1つの場面に描けます。`comet` は記録か、`findComet` が受け付けるキーです。運動は二体問題で、ケプラー問題を普遍変数で解いているため、閉じた軌道、放物線に近い軌道 (e = 0.99999 や 1.00001)、放物線、離心率が3を超える開いた軌道が、すべて同じコードで求まります。`cometDistance` は `sunAu` と `earthAu` を返します。地球はこのパッケージの `heliocentric("earth", ...)` で、光行時間は考えていません。

`cometOrbit(comet, points, maxAu)` は、線を引くための `3 * points` 個の数 (x、y、z。au。`Float32Array`) を返します。遠日点が `maxAu` (既定は40、海王星の外) 以内の閉じた軌道は楕円全体で、線が閉じるよう最初の点が最後にも付きます。それ以外の軌道は、近日点を通る、太陽から `maxAu` の距離に入ってから出るまでの弧です。点は、線が曲がる太陽の近くで密になります。尾や彗星そのものを描くことは `/comets` には含まれません。

## どこまで信じてよいか

`COMET_ACCURACY` が言葉で述べ、`cometTrust(comet, when)` が、ある時刻が彗星の元期からどれだけ離れているか、前後1年以内かを答えます。軌道要素は、元期で正確な1つの接触軌道です。惑星は彗星を引き、彗星自身のジェットが彗星を押すので、実際の軌道は楕円からずれていきます。長周期彗星の位置は、元期の近くでだけ良好です。同じ解を指定した JPL Horizons と、12個の彗星について各元期の前後1年以内の7つの日付で比べました (`test/data/comets-horizons.json`)。

| 内容 | 最大の差 |
|---|---|
| 閉じた軌道8個と、2I ボリソフ、マックノートの開いた軌道。元期の前後1年以内 | 2.5e-3 au 未満 (ボレリー。元期の300日前、4.8 au のとき) |
| 1I オウムアムア。同じ条件 | 5.2e-3 au (距離の千分の2.0)。小さな固有の押す力が計算に入っていません |
| C/2012 S1 アイソン。同じ条件 | 1.3e-2 au。1年以内に太陽から 0.012 au のところを通りました |
| 1P ハレー彗星の1986年の近日点。元期から18年 | 0.035 au、距離の6%。(この軌道自身の近日点は1986-02-08で、1日早い) |
| C/1995 O1 ヘール・ボップの1997年の近日点。元期から25年 | 0.065 au、7%。(この軌道の近日点は1997-03-29。実際は1997-04-01) |

元期そのものでは差は 1e-10 au 未満で、時刻系と計算は正しく、残りは惑星の引力とジェットによるものです。ある日を詳しく見るときは、Horizons に問い合わせてください。

## 前回と次回の近日点

`cometPerihelia(comet, when)` は、`last` と `next` (1970年からのミリ秒、UTC)、`basis`、`lastObserved` を返します。収録している周期彗星では、日付は JPL のもので、記録 (`perihelion`) に入っています。JPL Horizons にあるその彗星の最新の回帰の記録の接触軌道要素を、2026-11-11 に最も近い近日点通過で求めたものが前回の近日点で、次回の近日点は惑星の引力を含めて軌道を積分したものなので、周期を1回繰り返しただけの予測ではありません。`basis` は `"jpl"` で、`lastObserved` は、JPL の軌道解が記録していることで、彗星が見られたかどうかではありません。解の最後の観測が前回の通過の150日以内にあれば true です。1P ハレー彗星は前回 1986-02-09、次回 2061-07-28。2P エンケ彗星は 2023-10-22 と 2027-02-10。67P は 2021-11-02 と 2028-04-09。109P スイフト・タットル彗星は 1992-12-12 と 2126-07-12 です (Horizons の記録 90000030、90000091、90000703、90000985)。最新の通過より古い解が2つあります。21P (2025年) と 46P (2024年) はその通過で観測されましたが、記録にある解はそれより前のものなので、`lastObserved` は `false` で、前回の近日点はその解からの JPL の予測であり、実際より数日ずれています (21P の実際は 2025-03-29、JPL の日付は 2025-03-25)。前回の日付より前、または次回の日付より後では、接触軌道の周期から繰り返して求め、`basis` は `"estimated"` です。短い軌道では数か月、長い軌道では1年ほどの精度です。収録している放物線や開いた軌道の彗星、または周期が1万年を超える楕円軌道の彗星 (百武彗星は約7万年) の近日点は、JPL の1回だけで (`"jpl"`)、過去なら `last`、未来なら `next` で、もう一方は `null` です (7万年の周期を繰り返すと 99940 年の日付になってしまいます)。`cometFromElements` の彗星は、渡された日付 (`"elements"`) を持ちます。

## 流星群

彗星と流星群のつながりがよく確立されている場合は、記録が IAU の符号とともに流星群を示します。1P ハレー彗星はみずがめ座η流星群 (`ETA`) とオリオン座流星群 (`ORI`)、2P エンケ彗星はおうし座流星群 (`TAU`)、8P タットル彗星はこぐま座流星群 (`URS`)、21P ジャコビニ・ツィンナー彗星はりゅう座流星群 (`DRA`)、55P テンペル・タットル彗星はしし座流星群 (`LEO`)、109P スイフト・タットル彗星はペルセウス座流星群 (`PER`) です。ほかの彗星は `showers: []` で、推測で書くことはしていません。

## 新しいリリースを待たずに彗星を加える

```ts
import { cometDistance, cometFromElements, cometOrbit } from "@johnmorrisdotca/wakusei-planets/comets";

const comet = cometFromElements({
  designation: "C/2099 A1", name: { en: "Example", ja: "例彗星" },
  e: 0.9998, q: 0.6, i: 133.2, node: 241.5, w: 98.1, perihelion: Date.UTC(2099, 5, 1, 6),
});
console.log(comet.kind, comet.periodYears?.toFixed(0), "years;", cometDistance(comet, Date.UTC(2099, 8, 1)).sunAu.toFixed(2), "au from the Sun");
console.log(cometOrbit(comet, 50).length / 3, "points");
```

`cometFromElements` は、小惑星センターや JPL が公表する形の軌道要素を受け取ります。`e`、au 単位の `q`、度単位の `i`、`node`、`w`、そして近日点通過時刻を、`tp` (JPL が使う TDB のユリウス日) または `perihelion` (`Date` かミリ秒) のどちらかで渡します。値を検査し、角度を0〜360度にそろえ、id の代わりにどの関数にも渡せる記録を返します。収録している彗星の一覧は変わりません。種類は軌道から決まります (周期200年未満の閉じた軌道は周期彗星、それ以外は長周期彗星)。恒星間天体なら `kind: "interstellar"` を渡してください。小惑星やほかの天体も、同じ形でこの入口を通れるようにする予定です。

## 入力が正しくないとき

収録にない id は、id の一覧を書いた `RangeError` になり、記録でないものは `TypeError` になります。`Date` でも数でもない `when` は `TypeError`、無効な値や有限でない値は `RangeError` です。元期から遠い日付は、拒否されず、上に書いたずれを含んだまま答えます。`cometFromElements` の不正な要素 (負の離心率、近日点距離0、180度を超える傾斜、数でない値) は、項目名を書いた `RangeError` か `TypeError` になります。

## 数値の出どころ

軌道要素は、NASA/JPL 小天体データベース API (<https://ssd-api.jpl.nasa.gov/sbdb.api>、キー不要) から、彗星ごとに1回のリクエストで、2026-11-11 に `scripts/make-comet-data.py` が全桁で読み、`src/data/comets.ts` に書いたものです。比較に使った値は JPL Horizons (<https://ssd.jpl.nasa.gov/api/horizons.api>) のものです。NASA/JPL のデータは米国政府の著作物でパブリックドメインです。[NOTICE.md](../../../NOTICE.md) にも記しています。名前、種類、流星群との対応は、このパッケージで定めたものです。
