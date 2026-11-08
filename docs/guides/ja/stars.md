---
title: 望遠鏡なしで見える星
section: how-to
order: 15
description: 6.0 等級までの5,080個の星。名前、位置、固有運動、距離、色。gzip で約100 kB、依存はありません。
---

`/stars` は惑星の後ろに広がる空です。暗い場所で目で見えるすべての星、5,080個を、イェール輝星カタログから集めました。どの星にも、カタログ番号、名前 (あれば)、位置、動く速さ、明るさ、色、距離があります。どこでも動き、時計のほかは読み込みません。表は gzip で約100 kB で、最初に星をたずねたときに読み込まれます。パッケージのほかの部分はこれを読み込みません。

```ts
import { starByName, starColour, starDistanceLightYears, starPosition, stars } from "@johnmorrisdotca/wakusei-planets/stars";

const sirius = starByName("Sirius")!;
console.log(sirius.designation, sirius.magnitude, sirius.spectralClass);
console.log(starColour(sirius), starDistanceLightYears(sirius)?.toFixed(1), "light-years");
console.log(starPosition(starByName("Arcturus")!, Date.UTC(2100, 0, 1)).declination.toFixed(3));
console.log(stars({ magnitude: 2 }).length, "stars as bright as magnitude 2");
```

## 星をさがす

| 関数 | 返すもの |
|---|---|
| `stars({ magnitude? })` | ある等級までの明るい星を、明るい順に (指定しなければ5,080個すべて) |
| `starByHr(hr)` | 輝星カタログ (Harvard Revised) の番号で星を1つ。シリウスは2491 |
| `starByName(text)` | 名前 (`Sirius`) か星座内の記号 (`α CMa`、`9 CMa`) で星を1つ。大文字小文字は区別しません |

星の数: 1等級まで15個、2等級まで50個、3等級まで174個、4等級まで518個、5等級まで1,630個、6等級まで5,080個です。小さな空を描くページなら、4等級を指定して518個だけ使えます。

`Star` には `hr`、`name`、`designation`、`constellation`、`rightAscension` と `declination` (度、J2000)、`magnitude`、`colourIndex`、`spectralClass`、`properMotionRaMas`、`properMotionDecMas`、`parallaxMas` があります。111個の星には IAU の星の名前ワーキンググループの綴りで名前がついています。ほかの星はバイエル記号 (`β Cru`) かフラムスティード番号 (`9 CMa`) で呼びます。名前のない星は `name` が `undefined` です。

## 星のいる場所

`rightAscension` と `declination` はカタログの値で、J2000、FK5 座標系です (ICRS と秒角のごく小さな差しかありません)。赤経は時間の0.1秒まで、つまり赤道で1.5秒角まで、赤緯は1秒角まで書かれているので、ここでの位置もそのくらいの精度です。赤経は0から360の度で、時間ではありません。

`starPosition(star, when?)` は、星の固有運動を直線として足して、位置を未来や過去に進めます。座標系は J2000 のままです。ここにある星のほとんどで、直線は何百年たっても秒角よりずっと小さな誤差におさまります。速く動くわずかな星を何千年も追うには向きません。ある日の空の見え方にするには、J2000 の位置を [`/coordinates`](coordinates.md) で変換します。

## 距離と色

`starDistanceLightYears(star)` は 3261.56 を視差 (ミリ秒角) で割った値です。カタログの視差は近い星にはよく合います (シリウスは8.7光年)。遠い星には粗く (ベテルギウスやポラリスは数百光年で、誤差も同じくらい大きい)、約100光年より遠い距離は目安と考えてください。`undefined` は、カタログに視差がないことを表します。

`starColour(star)` は描くための `#rrggbb` の色です。星の B-V 色指数を温度に直し (`starTemperatureK`、バレステロスの式)、温度を黒体の色に直します (`blackBodyColour`)。カメラが写す色なので、青白いリゲルとオレンジ色のベテルギウスは、目で見る色ではなく写真の色になります。色指数のない星は白です。

## データのもと

イェール輝星カタログ (Hoffleit と Warren 1991、天文データセンターと CDS のカタログ V/50) は [NOTICE.md](../../../NOTICE.md) に出典を書いています。これを使うのは、もっと大きなカタログ (ヒッパルコス、ティコ、ガイア) が ESA により非商用でしか使えないライセンスで、MIT のパッケージでは引き継げないからです。カタログ自身の説明書は公有 (パブリックドメイン) と書き、カタログと著者の名前を示すよう求めています。正式なライセンス文はなく、NOTICE.md にもそう書いてあります。6.0 等級より暗い星は、このパッケージにはありません。
