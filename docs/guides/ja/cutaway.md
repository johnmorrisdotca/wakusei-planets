---
title: 内部の断面
section: how-to
order: 20
description: 天体を開いて層を見る。断面は頼むまでオフで、名前を挙げたモデルの数値だけを描き、おおよその数値はおおよそと書く。
---

断面は必要なときにオンにします。属性を付けないか `cutaway="off"` にすると、天体は丸ごとのままです。凡例には層の名前、表面からの深さ、成分を表示します。深さはキロメートルで、有効数字3桁です。

例では先に `@johnmorrisdotca/wakusei-planets/element` を読み込みます。陰影つきの地球には `@johnmorrisdotca/wakusei-planets/earth` と `three` も必要です。詳しくは[見た目と天体](looks-and-bodies.md)を参照してください。

## 従来の断面

値を指定せずに `cutaway` を付けると、球の4分の1が開き、重なった殻が見えます。殻は真球で、天体を回しても縁の円は中心を共有します。太陽は切れ目のない円盤で描きます。スマートフォンでは凡例が天体の下に並びます。

```html
<wakusei-body body="earth" look="realistic" lang="ja" cutaway></wakusei-body>
```

![地球の従来の断面。重なった殻と層の凡例](../../images/cutaway/ja-earth-classic.webp)

## 2D の断面

`look="line"` と `cutaway="half"` または `cutaway="quarter"` を組み合わせると、すべての層が同心円で見える平面の断面を描きます。WebGL は不要です。3D の描画に失敗した場合も、同じ断面を表示します。スマートフォンでは凡例が断面の下に並びます。

```html
<wakusei-body body="earth" look="line" lang="ja" cutaway="quarter"></wakusei-body>
```

![4つの層を同心円で示す地球の平面断面](../../images/cutaway/ja-earth-section.webp)

## 3D の2分の1断面

`half` を指定すると、球の上下を結ぶ軸の周りに180度開きます。天体を回しても断面はこちらを向きます。スマートフォンでは、球と断面全体が凡例の上に収まります。

```html
<wakusei-body body="earth" look="realistic" lang="ja" cutaway="half"></wakusei-body>
```

![地球の半分を開き、同じ平面にすべての層を示した図](../../images/cutaway/ja-earth-half.webp)

## 3D の4分の1断面

`quarter` を指定すると、90度のくさび形の部分が開き、2つの断面が見えます。天体を回して表面を見ている間も、開口部はこちらを向きます。スマートフォンでは2つの断面が凡例の上に収まります。

```html
<wakusei-body body="earth" look="realistic" lang="ja" cutaway="quarter"></wakusei-body>
```

![地球の4分の1を開き、2つの断面と球の表面を示した図](../../images/cutaway/ja-earth-quarter.webp)

## 断面の流れを動かす

`half` または `quarter` の断面に `cutaway-flow` を付けると、地球と月の液体の外核、木星の金属水素の流れを描きます。2D でも使えます。地球の表面近くの明るい点は、マグマが局所的にたまる様子を示しています。スマートフォンでもパソコンでも、デモでは図の上のボタンで再生と一時停止を切り替えられます。自分のページでは属性を外すと止まります。天体が画面の外に出たときやタブが非表示のとき、動きを減らす設定が有効なときは、流れが止まります。

```html
<wakusei-body body="earth" look="realistic" lang="ja" cutaway="quarter" cutaway-flow></wakusei-body>
```

![4分の1を開いた地球。液体の外核に流れの筋が見える](../../images/cutaway/ja-earth-flow.webp)

## 断面を表示できる天体

層の厚さは下に挙げた出典の値に従います。「約」は出典の推定値です。従来の断面を選んだ場合、太陽は円盤で描きます。

| 天体 | 表示 | 出典 | 模式的な層の比率 |
|---|---|---|---|
| 地球 | 従来、2D、2分の1、4分の1 | [NASA 地球ファクトシート][earth-sheet]、[NASA Science 地球の解説][earth-facts] | いいえ |
| 火星 | 従来、2D、2分の1、4分の1 | [NASA 火星ファクトシート][mars-sheet] | いいえ |
| 月 | 従来、2D、2分の1、4分の1 | [NASA 月ファクトシート][moon-sheet]、[NASA Science 月の解説][moon-facts] | いいえ |
| 水星 | 従来、2D、2分の1、4分の1 | [NASA 水星ファクトシート][mercury-sheet]、[NASA Science 水星の解説][mercury-facts] | いいえ |
| 太陽 | 従来、2D、2分の1、4分の1 | [NASA 太陽ファクトシート][sun-sheet]、[NASA Science 太陽の解説][sun-facts] | いいえ |
| 木星 | 従来、2D、2分の1、4分の1 | [NASA 木星ファクトシート][jupiter-sheet]、[Militzer ほか（2022）のモデル A][jupiter-model] | いいえ |
| 土星 | 従来、2D、2分の1、4分の1 | [NASA 土星ファクトシート][saturn-sheet]、[NASA Science 土星の解説][saturn-facts]、[Mankovich と Fuller（2021）][saturn-model] | いいえ |

以下の天体は、層の境界を示す採用済みの出典がないため、丸ごと描きます。断面を指定すると、そのことを凡例に表示します。金星、天王星、海王星について参照した NASA Science のページは中心核に触れていますが、その半径の数値はありません。イオ、エウロパ、ガニメデ、タイタンについて参照した NASA のファクトシートには、層の境界の数値がありません。

| 天体 | 表示 | 層の出典 | 模式的な層の比率 |
|---|---|---|---|
| 金星、天王星、海王星 | 全体 | — | — |
| 冥王星、ケレス、オルクス、ハウメア、クワオアー、マケマケ、ゴンゴン、エリス、セドナ | 全体 | — | — |
| ベンヌ、エロス、ベスタ、パラス、アロコス | 全体 | — | — |
| キロン、フォルス | 全体 | — | — |
| ハレー彗星 | 全体 | — | — |
| フォボス、ダイモス | 全体 | — | — |
| イオ、エウロパ、ガニメデ、カリスト、アマルテア、テーベ | 全体 | — | — |
| ミマス、エンケラドス、テティス、ディオネ、レア、タイタン、イアペトゥス、ハイペリオン、フェーベ、ヤヌス、エピメテウス、プロメテウス、パンドラ、アトラス、パン、ダフニス、ヘレネ、テレスト、カリプソ | 全体 | — | — |
| ミランダ、アリエル、ウンブリエル、ティタニア、オベロン | 全体 | — | — |
| プロテウス、ラリッサ、トリトン、ネレイド | 全体 | — | — |
| カロン、ニクス、ヒドラ、ステュクス、ケルベロス | 全体 | — | — |
| ヴァンス | 全体 | — | — |
| ヒイアカ、ナマカ | 全体 | — | — |
| ディスノミア | 全体 | — | — |

`interiorOf("earth")` から、地球の凡例が使う層のデータを取得できます。出典と確認日は [NOTICE.md](../../../NOTICE.md) に記載しています。

## 地球

体積平均半径は 6371 km、核の外側は 3485 km です (NASA の地球ファクトシート、2026-11-13 に読んだ)。内核の半径は約 1221 km で、鉄とニッケルの固体です。外核は鉄とニッケルの液体です。地殻は岩石で、陸では深さ約 30 km です。マントルは核とその地殻のあいだの岩石なので、その外側は平均半径から約 30 km を引いたところです。同じページは海底の地殻を約 5 km とも書いています。この断面が描く地殻は、陸の数値の1枚です。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| 地殻 | 0 km から 約30 km | 岩石 |
| マントル | 約30 km から 2,890 km | 岩石 |
| 外核 | 2,890 km から 約5,150 km | 鉄とニッケル、液体 |
| 内核 | 約5,150 km から 6,370 km | 鉄とニッケル、固体 |

## 火星

体積平均半径は 3389.5 km、核の半径は 1830 km です (NASA の火星ファクトシート、2026-11-13 に読んだ)。ページはどちらの成分も述べておらず、核の外側を分けてもいないので、凡例は「述べられていない」と書き、層は2枚です。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| 核の外側 | 0 km から 1,560 km | 述べられていない |
| 核 | 1,560 km から 3,390 km | 述べられていない |

## 月

体積平均半径は 1737.4 km です (NASA の月ファクトシート)。層は NASA Science の月の事実で、2026-11-26 に読みました。鉄を多く含む固体の内核は半径 240 km、液体の鉄の殻は厚さ 90 km (330 km のところに描く)、表側の地殻は厚さ約 40 km です。裏側は約 60 km まであり、こちらが描く地殻ではありません。ページは一部が溶けた層の名前を挙げ、厚さを述べていないので、その層だけの殻はありません。マントルは、ページがかんらん石と輝石だろうと書いている部分です。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| 地殻 | 0 km から 約40 km | 岩石 |
| マントル | 約40 km から 1,410 km | かんらん石と輝石 |
| 外核 | 1,410 km から 1,500 km | 鉄、液体 |
| 内核 | 1,500 km から 1,740 km | 鉄、固体 |

## 水星

体積平均半径は 2439.7 km です (NASA の水星ファクトシート)。NASA Science の水星の事実を 2026-11-26 に読むと、金属の核は半径約 2074 km で一部が溶けており、残りは岩石のマントルと地殻で、二つには分けてありません。同じページは、その殻の厚さを約 400 km とも書いています。この断面は、述べられた核の半径とファクトシートの半径を使うので、描く殻は 365.7 km です。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| マントルと地殻 | 0 km から 約366 km | 岩石 |
| 核 | 約366 km から 2,440 km | 金属、一部は溶けている |

## 太陽

体積平均半径は 695700 km です (NASA の太陽ファクトシート)。NASA Science の太陽の事実を 2026-11-26 に読むと、中心核の厚さは約 138000 km です。この断面は、その数値を中心核の外側の半径として使います。ページは放射層と対流層の名前を挙げ、その境を述べていないので、1枚の層です。光球は大気なので描きません。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| 放射層と対流層 | 0 km から 約558,000 km | 水素とヘリウム |
| 中心核 | 約558,000 km から 696,000 km | 水素がヘリウムに変わる |

## 木星

Militzer ほか 2022、"Juno Spacecraft Measurements of Jupiter's Gravity Imply a Dilute Core" (Planet. Sci. J.、doi 10.3847/PSJ/ac7ec8) のモデル A を 2026-11-26 に読みました。そのモデルの集まりでは、遷移層の内側は半径の 0.41 (0.03 の幅)、外側は 0.63 (0.01 の幅) です。同じモデルは、金属水素を 0.63 から 0.72、ヘリウムの雨を 0.72 から 0.83 に置きます。半径はファクトシートの 69911 km です。これは一つのモデルの境で、目で見た壁ではありません。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| 外層 | 0 km から 11,900 km | 水素とヘリウム |
| ヘリウムの雨 | 11,900 km から 19,600 km | ヘリウムが液滴になって沈む |
| 金属水素 | 19,600 km から 約25,900 km | 金属状の水素 |
| 遷移層 | 約25,900 km から 約41,200 km | 重元素が減っていく |
| 均質な内層 | 約41,200 km から 69,900 km | 重元素 18% |

## 土星

Mankovich と Fuller、2021、"A diffuse core in Saturn revealed by ring seismology" (Nature Astronomy、doi 10.1038/s41550-021-01448-3) を 2026-11-26 に読みました。境界のぼやけた核が、氷と岩石で、半径のおよそ 60% までのびます。半径はファクトシートの 58232 km です。外層は水素とヘリウムで、NASA Science の土星の事実によります。60% は論文の「およそ」なので、おおよそと印をつけます。

| 層 | 表面からの深さ | 成分 |
|---|---|---|
| 外層 | 0 km から 約23,300 km | 水素とヘリウム |
| 境界のぼやけた核 | 約23,300 km から 58,200 km | 氷と岩石が混ざっている |

[earth-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
[earth-facts]: https://science.nasa.gov/earth/facts/
[mars-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
[moon-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
[moon-facts]: https://science.nasa.gov/moon/facts/
[mercury-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html
[mercury-facts]: https://science.nasa.gov/mercury/facts/
[sun-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
[sun-facts]: https://science.nasa.gov/sun/facts/
[jupiter-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html
[jupiter-model]: https://doi.org/10.3847/PSJ/ac7ec8
[saturn-sheet]: https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html
[saturn-facts]: https://science.nasa.gov/saturn/facts/
[saturn-model]: https://doi.org/10.1038/s41550-021-01448-3
