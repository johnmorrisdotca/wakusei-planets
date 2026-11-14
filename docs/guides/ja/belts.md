---
title: 小惑星帯とカイパーベルト
section: how-to
order: 17
description: 本物の小天体の7つの帯 (メインベルト、ヒルダ群、木星トロヤ群、ケンタウルス族、カイパーベルト) を、帯ごとに1回の描画で宇宙ビューに出します。メインベルトの中を飛ぶこともでき、同じデータをサーバーでも使えます。
---

[English](../belts.md)

`<wakusei-space>` は、はじめから帯を描きます。NASA/JPL の小天体データベース (Small-Body Database) にある番号つきの小天体を数千個、それぞれ本当の軌道で、表示している日付の場所に、7つの帯と7つの色で出します。太陽系全体が入るところまでズームを引くと、メインベルトは火星と木星のあいだの帯に、トロヤ群は木星の軌道上の2つの群れに、カイパーベルトは海王星の外に見えます。`@johnmorrisdotca/wakusei-planets/belts` は、同じデータを表示なしで使えるようにしたものです。

| 帯 | どんな帯か | 知られている数 | 描く数 |
|---|---|---|---|
| `main` | 火星と木星のあいだ、太陽から2.0〜3.2天文単位 | 1,429,419 | 1,300 |
| `hilda` | 木星と共鳴して、太陽から3.9〜4.1天文単位 | 7,929 | 220 |
| `trojan` | 木星の軌道上の、木星の60度前と60度後ろの2つの群れ、太陽から4.6〜5.5天文単位 | 16,472 | 520 |
| `centaur` | 巨大惑星の軌道と交わる氷の天体、太陽から5.5〜30.1天文単位 | 1,087 | 200 |
| `classical` | カイパーベルトのうち、ほぼ円形の軌道のもの (39.4〜48.4天文単位) | 3,000 | 300 |
| `resonant` | 海王星と共鳴するもの (冥王星などのプルティノは3:2共鳴)、太陽から36〜63天文単位 | 2,306 | 500 |
| `scattered` | 海王星に外へはじき出された、細長くかたむいた軌道のもの、太陽から30〜2,700天文単位 | 2,266 | 300 |

距離は `BELTS[id].innerAu` と `outerAu` (天文単位) です。メインベルト、木星トロヤ群、ケンタウルス族はデータベースの分類の限界、ほかはこのパッケージが切った範囲です (散乱円盤に外側の限界はなく、2,700は運んでいる天体のうち最も遠いものよりわずかに大きい値です)。「知られている数」は、2026年11月10日にデータベースにあった数です (小惑星は全部で1,580,096個、うち番号がついているのは895,910個)。「描く数」は、各帯の番号つきの天体のうちいちばん明るいものです。数千個の点で見せられるのは、それくらいだからです。ヒルダ群とカイパーベルトの3種類は、軌道要素で切り分けています (本当の共鳴かどうかは、数字ではなく、秤動と呼ばれる天体のゆれ方で決まります)。ケレス、ベスタ、パラス、ケイロン、ポルス、冥王星とほかの準惑星は、それぞれ個別の天体なので、帯の中には入れていません。オールトの雲には描く軌道がありません。縮めた縮尺では、その内側のふち (太陽から約2,000天文単位) を、3つの円でできた殻にして、名前をつけて描きます。

## 表示の中で

```html
<wakusei-space scale="true"></wakusei-space>
<script type="module">
  import "@johnmorrisdotca/wakusei-planets/space/element";
  const space = document.querySelector("wakusei-space");
  space.belts = ["main", "trojan"]; // この2つだけ。[] (または belts="off") で、なし
</script>
```

帯は1つにつき1回のインスタンス描画です。各天体の場所は、軌道要素と日付からグラフィックスカードが求めるので、時間を進めてもCPUの負荷は増えず、止めた表示は何も描き直しません。要素のデータは別のチャンク (gzip で約70 kB) になっていて、はじめて描くときに表示が読み込みます。ページや要素本体には入りません。帯は、データの入口 (data door) にあるこのパッケージ自身のソース (`wakusei-belts`) です。画像や位置と同じ行に「NASA/JPL小天体データベース」(パブリックドメイン) とクレジットが出て、`data="own"` でも消えず、`space.sources` には入りません。属性 `belts` はプロパティと同じ意味です (`belts="off"`、または名前を空白で区切る)。

## 帯の中を飛ぶ

`enterBelt()` は、カメラを帯の中へ飛ばします。帯の真ん中を太陽のまわりに回る円の上を進みます。この円は黄道に6度かたむいていて、帯の厚みを通りぬけます。カメラは進む向きを向き、上が黄道の北になります。ドラッグで見まわせます。縮尺は「本当の距離」です (縮めた縮尺では、天体のあいだを動くカメラの位置を決められないからです)。速さは、ゲーム内の時間で1日あたり0.3天文単位です。天体そのものの約30倍なので、天体は流れて過ぎていきます。デモの「1秒で1時間」の速さでは、メインベルトを1周するのに約20分かかります。

```js no-run
const space = document.querySelector("wakusei-space");
space.enterBelt("main"); // または "hilda"、"trojan"、"centaur"、"classical"、"resonant"、"scattered"
space.addEventListener("wakusei-ride", () => console.log(space.flyingThrough)); // "main"、leaveBelt() のあとは null
space.leaveBelt();
```

表示には、いま見ている帯のことを1行で出します (言語は要素の `lang`)。知られている天体の数、となりの天体までの距離がふつう数百万kmあること (メインベルトでは月までの距離の約10倍。月は地球から384,400 km)、ここはほとんど何もない空間であること、描いた点はいちばん明るいごく一部だけで、見えるように大きくしてあること、です。ありのままの間隔を示すのが目的です。帯は、岩がぎっしり詰まった野原ではありません。

## サーバーやスクリプトで

belts の入口は純粋です。ページも three.js も使いません。

```ts
import { beltDensity, beltNote, beltPositions, beltSpacing, loadBeltBodies } from "@johnmorrisdotca/wakusei-planets/belts";

const bodies = await loadBeltBodies(); // すべての帯。それぞれ明るい順
const jd = 2461350.5; // ユリウス日 (TT)
const main = bodies.filter((body) => body.belt === "main");
const place = beltPositions(main, jd); // それぞれの x、y、z (au)。太陽中心、J2000の黄道
console.log(main.length, place.length / 3);

const density = beltDensity(bodies, jd, { from: 1, to: 6, bins: 5 }); // 距離の区間ごとの数と、1立方auあたりの数
console.log(density.count.join(", "));

const spacing = beltSpacing("main", bodies, jd); // となりの天体までの距離 (km)
console.log(Math.round(spacing.known / 1e4), "万km (知られている天体だけがあるとしたときの、となりまでの距離)");
console.log(beltNote("main", spacing, "ja"));
```

`BELTS` は各帯の名前、色、数を、`BELT_TOTALS` はデータベースにあった数を持ちます。`parseBeltRows` はデータの文字列を読み、`beltsSource()` は別の表示に渡せる、データの入口のソースとしての帯、`beltFlight(belt)` は飛ぶ点 (`space.ride(point, { around: "sun", look: "ahead" })` が受け取る `RidePoint`) です。軌道は、各天体の2026年6月9日 (ユリウス日 2461200.5) の軌道要素から求める二体問題の楕円なので、惑星の引力は入っていません。前後数年は1度ほどの精度で、元期から離れるほど悪くなります (木星と共鳴するトロヤ群とヒルダ群が、いちばん先にずれます)。データは `scripts/make-belts-data.py` が小天体データベースへの数回の問い合わせから作ります。何を問い合わせたかは NOTICE.md にあります。
