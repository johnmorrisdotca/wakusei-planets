---
title: 知られている衛星すべて
section: how-to
order: 20
description: "惑星と準惑星の、知られている衛星すべて (JPL の 2026-11-11 時点の一覧で 468個)。名前と仮符号、見つけた人と年、平均軌道、わかっている大きさ、好きな日の位置と、その位置がどれだけずれていたか。表 (約35 kB) は /moon-catalogue だけが持ちます。"
---

[English](../moon-catalogue.md)

このパッケージは29個の衛星をくわしく描きます。それぞれに見た目、大きさ、自転があり、軌道は JPL Horizons に合わせたものか、発表された理論から計算したものです。`/moon-catalogue` は、それ以外も含めて知られている衛星をすべて並べます。JPL の 2026-11-11 時点の一覧で 468個です。名前 (まだ名前のない衛星は仮符号)、まわる惑星、見つかった年と見つけた人、平均軌道、測った大きさか計算できる大きさ、グループがあります。どの日にどこにあるかも平均軌道から求め、その位置がどれだけずれるかを測った値もいっしょに示します。DOM も three.js も使わず、どこでも動き、読み込みの手順も要りません。表 (gzip で約35 kB) はこの入口だけが持ち、`/moon-catalogue` を読み込まないページには入りません。

```ts
import { catalogueMoonPosition, catalogueMoonsOf, findCatalogueMoon, moonCounts, MOON_CATALOGUE_FETCHED } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";

const saturn = moonCounts().saturn!;
console.log(`Saturn has ${saturn.total} known moons, ${saturn.named} with a name (as of ${MOON_CATALOGUE_FETCHED})`);
const himalia = findCatalogueMoon("Himalia")!;
console.log(himalia.label, "found", himalia.discovery.year, "by", himalia.discovery.by, "in the", himalia.group, "group");
const [x, y, z] = catalogueMoonPosition(himalia, new Date("2026-11-11T00:00:00Z"))!;
console.log("about", Math.round(Math.hypot(x, y, z) / 1e6), "million km from Jupiter; placed", himalia.grade, `(worst ${himalia.accuracy!.worstDegrees.toFixed(1)} degrees off)`);
console.log(catalogueMoonsOf("jupiter", "carme").length, "moons in Jupiter's Carme group");
```

## 数

| 惑星・準惑星 | 衛星 | 名前あり | 位置あり |
|---|---|---|---|
| 地球 | 1 | 1 | 1 |
| 火星 | 2 | 2 | 2 |
| 木星 | 115 | 57 | 115 |
| 土星 | 293 | 63 | 292 |
| 天王星 | 29 | 27 | 29 |
| 海王星 | 16 | 14 | 16 |
| 冥王星 | 5 | 5 | 5 |
| オルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス | 1、2、1、1、1、1 | 6 | 0 |
| **合計** | **468** | **175** | **460** |

`moonCounts()` でこの数が、`MOON_CATALOGUE_FETCHED` で読み取った日がわかります。ケレスとセドナには、知られている衛星がありません。

「位置あり」は平均軌道のある衛星です。位置がないのは8個です。土星の環の中の小さな衛星 S/2009 S 1 (JPL の一覧に軌道がない) と、冥王星以外の準惑星の衛星7個 (JPL の Small-Body Satellites に軌道がない) です。その7個のうち4個 (ヴァンス、ヒイアカ、ナマカ、ディスノミア) はこのパッケージがくわしく描く衛星で、メインの入口が [NOTICE.md](../../../NOTICE.md) にある論文の軌道で位置を求めます。また、ダフニスは軌道はありますが、2026年ごろの Horizons の位置がないため、くらべることができません。そのため `unmeasured` です。

## 衛星ごとの情報

| 項目 | 内容 |
|---|---|
| `id`、`label`、`name`、`designation`、`number` | id ("himalia"、"s-2003-j-18")、表示する文字 (名前、なければ仮符号)、IAU の名前、仮符号、ローマ数字の IAU 番号 |
| `ja` | 日本語の名前。このパッケージがくわしく描く29個だけで、カタカナは確認ずみです。ほかの衛星は `null` で、日本語のページでも英語の名前か仮符号で表示します |
| `host`、`code` | まわる惑星か準惑星と、Horizons での JPL (NAIF) 番号 (イオは 501) |
| `discovery` | `year`、`by` (JPL が書いているとおりの発見者か探査機のチーム)、`reference` (発表された場所: IAU 回報、小惑星電子回報 MPEC、CBET、古くから名前のある衛星は "IAU WGPSN") |
| `orbit` | 平均軌道: `a`、`e`、`w`、`m`、`i`、`node`、`periodDays` (Horizons に合わせたもの)、近点と昇交点がひとまわりする年数 (`apsisYears`、`nodeYears`)、基準の面 (`frame` と `pole`)、元期 (2026-01-01)、もとにした JPL の暦 |
| `retrograde`、`group` | 惑星の自転と逆向きにまわるかどうかと、グループ (下で説明) |
| `radiusKm`、`radiusSigmaKm`、`radiusFrom`、`albedo`、`magnitude` | 大きさとその出どころ (下で説明)、JPL が示すアルベドと V(1,0) 等級 |
| `accuracy`、`grade` | `catalogueMoonPosition` が JPL Horizons からどれだけずれていたかと、その段階 (下で説明) |
| `full` | このパッケージがくわしく描く29個は `true`。それらはメインの入口の `moonVector` と `system` のほうがずっと正確です |

情報源にない数は `null` で、推測では埋めません。

## グループ

`group` は、このパッケージが平均軌道を下のきまりで分けたものです。名前はよく使われているもので、そのグループでいちばん大きい衛星の名前です。JPL が平均軌道を黄道を基準に示している衛星 (惑星のふくらみより太陽の引力の影響が大きい。月だけは例外) と、惑星の半径の100倍より遠い衛星は不規則衛星、それ以外は規則衛星とします。

| グループ | きまり | 数 |
|---|---|---|
| `major` | 規則衛星で、半径150 km 以上 | 20 |
| `inner` | 規則衛星で、それより小さく、その惑星のいちばん内側の `major` より内側 | 33 |
| `regular` | ほかの規則衛星 (フォボス、ダイモス、ヒペリオン、軌道を分け合う土星の小さな衛星、冥王星の小さな衛星) | 14 |
| `themisto` | 木星、順行、900万 km より近い | 1 |
| `himalia` | 木星、順行、1000万〜1300万 km、35度より小さい | 11 |
| `carpo` | 木星、順行、45度以上 | 2 |
| `valetudo` | 木星、ほかの順行の衛星 | 1 |
| `ananke` | 木星、逆行、160度より小さい、2200万 km より近い | 29 |
| `carme` | 木星、逆行、160度以上 | 41 |
| `pasiphae` | 木星、逆行、160度より小さい、2200万 km 以上 | 22 |
| `inuit` | 土星、順行、42度以上 | 39 |
| `gallic` | 土星、順行、42度より小さい | 19 |
| `norse` | 土星、逆行 | 210 |
| `prograde` | 天王星と海王星、順行 | 5 |
| `retrograde` | 天王星と海王星、逆行 | 13 |
| `none` | 平均軌道がない | 8 |

距離は軌道長半径、角度は黄道に対する軌道傾斜角です。グループの境目は、この表で衛星の軌道がかたまりに分かれるところに引きました。境目の近くの衛星は、どちらに入れることもできます。

## 衛星の位置と、どこまで信用できるか

`catalogueMoonPosition(moon, when)` は、惑星の中心からの x、y、z をキロメートルで返します (J2000 黄道座標。`moonVector` と同じ軸)。平均軌道で計算します。軌道の形、面、近点と昇交点がまわる速さは JPL の「Planetary Satellite Mean Elements」のものです。軌道の上のどこにいるかと、軌道にそって進む速さは、JPL Horizons に合わせました。2026-01-01 の位置で場所を決め、1日後、31日後、90日後の位置で速さを決めています。JPL の平均軌道要素をそのまま使うと、土星、天王星、海王星、冥王星の衛星は、元期でも Horizons から数十度ずれるためです (このパッケージの29個の衛星でも同じことがわかり、Horizons に合わせた軌道に変えました)。平均軌道は、太陽の引力による月ごとのゆれや、衛星どうしの引力を入れていないので、位置は本当の位置から少しずつずれます。すべての衛星を、合わせるのに使っていない日 (2025-07-02、2026-07-02、2027-07-02) に Horizons とくらべました。`accuracy` は、いちばん大きいずれの距離と、惑星から見た角度です:

| `grade` | 2026年ごろのいちばん大きいずれ | 数 | 規則衛星 | 不規則衛星 |
|---|---|---|---|---|
| `close` | 1度より小さい | 37 | 36 | 1 |
| `rough` | 10度より小さい | 140 | 17 | 123 |
| `loose` | 10度以上: 軌道は合っているが、軌道の上の位置は合っていない | 282 | 13 | 269 |
| `unmeasured` | くらべる Horizons の位置がない | 1 | 1 | 0 |
| `none` | 軌道がない | 8 | | |

規則衛星はよく合います。いちばん大きいずれの中央値は、`major` で0.5度、`inner` で0.6度です。不規則衛星は合いません。太陽の引力で、数か月のうちに軌道の上を数十度も前後にゆれ、平均軌道ではその動きを追えないためです。いちばん大きいずれの中央値は、土星の `norse` で10度、木星の `himalia` で12度、土星の `inuit` と `gallic` で25〜27度、木星の `ananke` で35度、`carme` と `pasiphae` では50度をこえます。

どの段階も、このパッケージがくわしく描く29個ほど正確ではありません。その29個は、メインの入口から求めると、ずれは数秒角から数分角におさまります ([正確さ](accuracy.md)を見てください)。何十年も離れた日 (1990年、2000年、2040年) では、ずれはずっと大きくなります (`accuracy.farDegrees`)。この表の位置は、小さな衛星が惑星のまわりのどのあたりにいるかを見せるためのもので、望遠鏡を向けるためのものではありません。

## 大きさ

`radiusFrom` は半径の出どころです。`measured` は JPL の「Planetary Satellite Physical Parameters」にある46個 (不確かさは `radiusSigmaKm`)、`sheet` は Horizons のデータに半径がある19個、`derived` は V(1,0) 等級だけがある26個です。`derived` の半径は、NASA/JPL の小惑星の大きさの計算と同じ式 D = 10^(3.1236 − 0.5 log10(アルベド) − 0.2 V) の半分で、アルベドは Horizons のデータにあればその値、なければ `ASSUMED_ALBEDO` (0.04、ヒマリアのデータの値) を使います。26個のどれにもアルベドがないので、どれも、この暗さと仮定した見積もりです。残りの377個は、ほとんどが2000年以降に見つかった衛星で、データに半径も等級もないため、大きさはありません。

## 宇宙の表示で

`<wakusei-space all-moons>` (または `space.allMoons = true`) は、表の衛星のうち、この表示がくわしく描かないものを、平均軌道の位置に小さな点で惑星のまわりに描きます。すべての点を1回の描画でまとめて描きます。縮めた縮尺では、くわしく描く衛星と同じ方法で近くに寄せます。表は、はじめてオンにしたときに別のかたまりとして読み込みます。一度もオンにしない表示は読み込みません。点は表示が描くときだけ描くので、止まっているあいだは何も描きません。`stats.allMoons` で、オンかどうか、表を読み込んだかどうか、前回の描画で描いた点の数がわかります。three.js の一部だけを渡すページ (`setThreeLoader`) は、`Points` と `PointsMaterial` を含めてください。デモの宇宙のページには「すべての衛星」のスイッチがあり、オンにすると点を描き、いま見ている惑星の衛星の一覧をグループといっしょに表示します。一覧では、測ったずれが10度以上の衛星に「おおよその位置」と書きます。

点は、それぞれの衛星の軌道と、軌道の上のだいたいの位置を示します。規則衛星のずれはだいたい0.5度以内ですが、外側の小さな衛星の多くは、1年のうちに数十度ずれることがあります (468個のうち282個は10度以上ずれます)。点は正確な位置ではありません。

## 新しい情報に合わせる

新しい衛星は毎年発表され、軌道もよりくわしくなります。`python3 -I scripts/make-moon-catalogue.py --cache DIR --refresh` は JPL のページをもう一度読み (すでにある衛星の Horizons の答えは保存したものを使うので、問い合わせが増えるのは新しい衛星の分だけです)、書きこむ前に、リポジトリの表とのちがいを表示します: 新しい衛星、なくなった衛星、名前がついた仮符号、変わった軌道、大きさ、発見、グループ。`--dry` はちがいを表示するだけで、何も書きません。そのあと、`test/moon-catalogue.test.ts` で固定している数と、このガイドの数を合わせます。JPL の利用条件にあるとおり、問い合わせは一度に一つずつ、間をあけて行い、実行時に JPL に問い合わせることはありません。

## 数の出どころ

すべて NASA/JPL (Solar System Dynamics。米国政府の著作物で、クレジットは NASA/JPL-Caltech) のもので、2026-11-11 に `scripts/make-moon-catalogue.py` で読み取りました。平均軌道は「Planetary Satellite Mean Elements」(軌道の上の位置と速さは Horizons)、名前、仮符号、年、発見者、発表は「Planetary Satellite Discovery Circumstances」、測った半径は「Planetary Satellite Physical Parameters」、冥王星以外の準惑星の衛星は Small-Body Satellites API、衛星ごとのデータと、合わせたりくらべたりした位置は JPL Horizons のものです。リンクと利用条件は [NOTICE.md](../../../NOTICE.md) にあります。
