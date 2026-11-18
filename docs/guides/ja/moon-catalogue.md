---
title: 知られている衛星すべて
section: how-to
order: 20
description: "惑星と準惑星の、知られている衛星すべて (JPL の 2026-11-18 時点の一覧で 468個)。名前と仮符号、見つけた人と年、平均軌道、わかっている大きさ、好きな日の位置と、その位置がどれだけずれていたか。表 (約35 kB) は /moon-catalogue だけが持ちます。"
---

[English](../moon-catalogue.md)

このパッケージは29個の衛星をくわしく描きます。それぞれに見た目、大きさ、自転があり、軌道は JPL Horizons に合わせたものか、発表された理論から計算したものです。`/moon-catalogue` は、それ以外も含めて知られている衛星をすべて並べます。JPL の 2026-11-18 時点の一覧で 468個です。名前 (まだ名前のない衛星は仮符号)、まわる惑星、見つかった年と見つけた人、平均軌道、測った大きさか計算できる大きさ、グループがあります。どの日にどこにあるかも平均軌道から求め、その位置がどれだけずれるかを測った値もいっしょに示します。DOM も three.js も使わず、どこでも動き、読み込みの手順も要りません。表 (gzip で約35 kB) はこの入口だけが持ち、`/moon-catalogue` を読み込まないページには入りません。

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
| `ja` | 日本語の名前 (カタカナ)。このパッケージがくわしく描く29個の衛星と、`scripts/moon-catalogue-ja.json` に載っている129個の衛星の名前です。後者は、国立科学博物館の衛星表 (主に『理科年表』による) と日本語版ウィキペディアという、公表されている日本語の一覧に載っているカタカナを、出どころとともに書き留めたものです。日本語の一覧にまだカタカナがない、名前のある17個の衛星とすべての仮符号は `null` で、日本語のページでも英語の名前か仮符号で表示します |
| `host`、`code` | まわる惑星か準惑星と、Horizons での JPL (NAIF) 番号 (イオは 501) |
| `discovery` | `year`、`by` (JPL が書いているとおりの発見者か探査機のチーム)、`reference` (発表された場所: IAU 回報、小惑星電子回報 MPEC、CBET、古くから名前のある衛星は "IAU WGPSN") |
| `orbit` | 平均軌道: `a`、`e`、`w`、`m`、`i`、`node`、`periodDays` (Horizons に合わせたもの)、近点と昇交点がひとまわりする年数 (`apsisYears`、`nodeYears`)、基準の面 (`frame` と `pole`)、元期 (2026-01-01)、もとにした JPL の暦 |
| `retrograde`、`group` | 惑星の自転と逆向きにまわるかどうかと、グループ (下で説明) |
| `radiusKm`、`radiusSigmaKm`、`radiusFrom`、`albedo`、`magnitude`、`magnitudeFrom` | 大きさとその出どころ (下で説明)、JPL が示すアルベド、等級 (JPL のデータの V(1,0) 等級、またはウィキペディアの表の絶対等級) と、そのどちらなのか (`sheet` か `wikipedia`) |
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

## 衛星群ごと

`moonFamilies(host)` は、惑星の衛星を、一覧として読む順に並べて返します。内側の衛星群から順に、それぞれの衛星群の中では惑星に近い順です。衛星群は `group` を惑星ごとにまとめ直したもので、一覧のための並べ方であり、別の分類ではありません。惑星の衛星は、かならずどれか一つの衛星群に入ります。

| 惑星 | 衛星群と、それぞれの衛星の数 |
|---|---|
| 木星 | `galilean` 4、`inner` 4 (アマルテア、テーベ、メティス、アドラステア)、`himalia` 11、`ananke` 29、`carme` 41、`pasiphae` 22、`other` 4 (4つの群のどれにも入らない不規則衛星: テミスト、カルポ、バレトゥードー、S/2018 J 4) |
| 土星 | `inner` 25 (おもな衛星と内側の衛星)、`inuit` 39、`gallic` 19、`norse` 210 |
| 天王星、海王星 | `inner` (19と8) と `irregular` (10と8) |
| 地球、火星、冥王星、ほかの準惑星 | 一つの衛星群 `moons` |

衛星群には、英語と日本語の名前 `names`、衛星の数 `count`、名前のある数 `named`、大きさのある数 `sized`、そのうち大きさが見積もりの数 `estimated`、いちばん大きい半径と小さい半径 (`largestKm`、`smallestKm`。見積もりかどうかは `largestIsEstimate`、`smallestIsEstimate`)、向き `direction` (`prograde`、`retrograde`、`mixed`、軌道のある衛星がない天体では `null`)、軌道を衛星群ごとに描く色 `color`、そして `moons` があります。`moons` の各衛星には `radiusKm` と、見積もりかどうかの `estimate` があります。`radiusFrom` が `derived` のとき、大きさは見積もりです (「大きさ」を参照)。衛星群の `estimated` は、そうした衛星の数です。大きさのない衛星の `radiusKm` は `null` で、推測した値は入れません。

```ts
import { moonFamilies, moonOrbitKey } from "@johnmorrisdotca/wakusei-planets/moon-catalogue";

for (const family of moonFamilies("jupiter")) {
  console.log(family.names.ja, family.count, "個、うち大きさが見積もりの衛星", family.estimated, "個");
}
// 軌道の色の意味: 凡例はデータで返り、色ごとの衛星の数もわかります
console.log(moonOrbitKey("direction").map((entry) => `${entry.names.ja}: ${entry.count}`));
```

`moonOrbitKey("group")` と `moonOrbitKey("direction")` は、宇宙の表示が描く軌道の色 (`moon-colors`) の凡例です。項目ごとに `id`、`names` (英語と日本語)、`color`、`count` があります。衛星を表示している惑星を渡す (`moonOrbitKey("group", ["saturn"])`) と、その惑星の分だけ数えます。`moonOrbitColor(moon, by)` は一つの衛星の軌道の色、`catalogueMoonOrbit(moon, when)` は軌道そのもので、惑星のまわりを一周する閉じた点の列です。単位はキロメートルで、`catalogueMoonPosition` と同じ座標軸です。

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

## 2026-12-01の近くでは、不規則衛星は Horizons に合う

巨大惑星の不規則衛星には、現在に近い日付について、ずっとよい位置があります。それぞれの衛星について、2026-12-01 の JPL Horizons の接触軌道 (その日の位置と速さに合う二体問題の軌道) を `osculating` (`MOON_OSCULATING_EPOCH_JD`、2461375.5) として持っていて、`catalogueMoonPosition` は、その日から `MOON_OSCULATING_DAYS` (150日) 以内ではこれを使い、それより外では平均軌道を使います。393個すべてについて、軌道を決めるのに使っていない16の日付 (前後15日から210日まで) で Horizons と比べました。150日以内の、衛星と日付のすべての組み合わせでは、中央値が0.06度、100組のうち95組が0.9度以内で、いちばん悪いのは、期間のはしにある木星の衛星のいくつかで、7度です。土星の衛星でいちばん悪いのは1.1度、天王星と海王星では0.1度です。平均軌道は数十度もずれます。`accuracy` と `grade` は、これまでどおり平均軌道について、この期間の外の日付で測ったものです。

数値は `src/data/moon-osculating.ts` に整数で入っていて (gzip で約7 kB。`/moon-catalogue` のチャンクが増えた分です)、`scripts/make-moon-osculating.py` が作ります。Horizons への問い合わせは衛星ごとに1回で、元期と比べるための日付をまとめて頼み、結果はリポジトリの外にキャッシュします。更新するには、このスクリプトを新しい `--epoch` で実行します。

## 大きさ

`radiusFrom` は半径の出どころです。`measured` は JPL の「Planetary Satellite Physical Parameters」にある46個 (不確かさは `radiusSigmaKm`)、`sheet` は Horizons のデータに半径がある19個、`derived` は382個です。その内訳は、V(1,0) 等級だけがデータにある26個と、ほかのどこにも大きさがない不規則衛星356個で、後者の等級は、英語版ウィキペディアの木星、土星、天王星、海王星の衛星の表にある絶対等級です (`magnitudeFrom` が `sheet` か `wikipedia` かを示します。`wikipedia` のときは、ページが `MOON_MAGNITUDE_PAGES[host]`、読んだ日 (2026-11-18) が `MOON_MAGNITUDES_READ` です)。それらの表は、不規則衛星の等級を小惑星センターの Natural Satellites Ephemeris Service から取っています。使っているのはその等級ひとつだけで、表の直径やほかの列は使っていません。

等級は `scripts/moon-catalogue-magnitudes.json` に入れてあり、`scripts/make-moon-magnitudes.py` が作ります (4つのページに、1ページ1回ずつアクセスします)。ビルドスクリプトがこのファイルを読むので、`--refresh` でも残ります。小惑星センター自身の発見の回報を読むのが最初の案でしたが、同センターの robots.txt はプログラムによる読み取りを許していません。

`derived` の半径は、NASA/JPL の小惑星の大きさの計算と同じ式 D = 10^(3.1236 − 0.5 log10(アルベド) − 0.2 V) の半分で、アルベドは Horizons のデータにあればその値、なければ `ASSUMED_ALBEDO` (0.04、ヒマリアのデータの値) を使います。382個のどれにもデータにアルベドがないので、どれも、この暗さと仮定した見積もりです。表の直径と比べると、木星の暗い衛星28個では、差が2倍を超えます (こちらのほうが約2.2倍から2.8倍大きくなります)。そのため、いちばん小さい衛星の大きさは、数倍の誤差を含む見積もりです。なお、土星の表には、直径は0.04を仮定したものだと注記されていますが、木星の表は、こうした暗い衛星の直径をシェパード本人のページから取っています。絶対等級 H が17ほどのとき、表の1 kmになるにはアルベドが0.3ほど必要ですが、こちらは、こうした衛星に多い暗さの0.04を仮定しています。1 kmとした根拠は、表に示されていません。残りの21個には大きさがありません。内訳は、冥王星以外の準惑星の衛星7個 (データにも表にも、大きさも等級もありません)、表の等級が直径から計算されている `inner` と `regular` の規則衛星13個 (その等級を使うと堂々めぐりになります)、そして表に載っていないフィロフロシネです。

## 宇宙の表示で

`<wakusei-space>` の `moons` は、どの惑星で表の衛星をすべて描くかを決めます。`major` (今の初期値) は、この表示がくわしく描く衛星だけを描きます。`all` は、その惑星のほかの衛星を、軌道つきの、押せる小さな点としてすべて描きます。惑星ごとにも、すべての惑星まとめても決められ、惑星に決めた値があれば、初期値よりそちらが優先されます。

```html
<wakusei-space moons="major" moons-of="jupiter=all saturn=all" moon-colors="direction"></wakusei-space>
```

```ts
space.moons = "all";                 // すべての惑星に (自分の値がない惑星の初期値)
space.setMoons("all", "saturn");     // 土星だけ
space.setMoons("major");             // すべての惑星に。惑星ごとの値は消えます
space.moonsFor("saturn");            // "all"
space.moonHosts;                     // 衛星をすべて表示している惑星。表示の順
space.moonColors = "direction";      // 軌道の色: "group" (初期値) か "direction"
```

点は `catalogueMoonPosition` が示す位置にあり、縮めた縮尺では、くわしく描く衛星と同じ方法で近くに寄せます。軌道は閉じた線で、衛星群の色 (`moon-colors="group"`。衛星群ごとの `color`) か、向きの色 (`direction`。青は惑星の自転と同じ向き、赤は逆向き) で描きます。`moonOrbitKey(by, hosts)` はその色の凡例をデータで返すので、ページは自分の凡例をそこから描けます。点は1回の描画、軌道は別の1回の描画で、縮尺、色分け、暦の月が変わったときに1回だけ作り、そのあとは惑星といっしょに動かすだけです。止まっているあいだは何も描かず、同じ縮尺での描画は何も作り直しません。表は別のかたまりで、いずれかの惑星をはじめて `all` にしたときに読み込みます。一度もしない表示は読み込みません。`stats.allMoons` で、`all` の惑星があるか、表を読み込んだか、前回の描画で描いた点と軌道の数、表示している惑星がわかります。three.js の一部だけを渡すページ (`setThreeLoader`) は、`Points`、`PointsMaterial`、`LineSegments`、`LineBasicMaterial` を含めてください。

点は、名前のあるどの天体よりも優先度が低く、9 CSSピクセル以内の押す操作に応えます。最初に押すと衛星が選ばれ、`{ id, name, kind: "catalogue-moon", host }` を持つ `wakusei-body-select`、`wakusei-body-click`、`wakusei-moon-click` が発火します。同じ衛星をもう一度押すと、その惑星が表示の中心になります。点の上にポインターを置くと、同じ内容の `wakusei-body-hover` が発火します。`all-moons` と `space.allMoons` も、すべての惑星を `moons="all"` にする形で使えます。デモの宇宙のページには、スイッチと、いま見ている惑星の衛星群を並べるパネルがあり、衛星群ごとの数と大きさ (見積もりの大きさには印がつきます) と色の凡例を表示します。測ったずれが10度以上の衛星には「おおよその位置」と書きます。

点は、それぞれの衛星の軌道と、軌道の上のだいたいの位置を示します。規則衛星のずれはだいたい0.5度以内ですが、外側の小さな衛星の多くは、1年のうちに数十度ずれることがあります (数は「数」の節の表を参照)。点は正確な位置ではありません。

## 新しい情報に合わせる

新しい衛星は毎年発表され、軌道もよりくわしくなります。`python3 -I scripts/make-moon-catalogue.py --cache DIR --refresh` は JPL のページをもう一度読み (すでにある衛星の Horizons の答えは保存したものを使うので、問い合わせが増えるのは新しい衛星の分だけです)、書きこむ前に、リポジトリの表とのちがいを表示します: 新しい衛星、なくなった衛星、名前がついた仮符号、変わった軌道、大きさ、発見、グループ。`--dry` はちがいを表示するだけで、何も書きません。そのあと、`test/moon-catalogue.test.ts` で固定している数と、このガイドの数を合わせます。JPL の利用条件にあるとおり、問い合わせは一度に一つずつ、間をあけて行い、実行時に JPL に問い合わせることはありません。

## 数の出どころ

すべて NASA/JPL (Solar System Dynamics。米国政府の著作物で、クレジットは NASA/JPL-Caltech) のもので、2026-11-18 に `scripts/make-moon-catalogue.py` で読み取りました。平均軌道は「Planetary Satellite Mean Elements」(軌道の上の位置と速さは Horizons)、名前、仮符号、年、発見者、発表は「Planetary Satellite Discovery Circumstances」、測った半径は「Planetary Satellite Physical Parameters」、冥王星以外の準惑星の衛星は Small-Body Satellites API、衛星ごとのデータと、合わせたりくらべたりした位置は JPL Horizons のものです。リンクと利用条件は [NOTICE.md](../../../NOTICE.md) にあります。
