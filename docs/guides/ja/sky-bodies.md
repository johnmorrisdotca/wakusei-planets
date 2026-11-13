---
title: 空のどこに惑星があるか
section: how-to
order: 34
description: ある瞬間の、そしてある場所からの、太陽、月、惑星の位置。その日の分点と J2000 の赤経・赤緯、等級、大きさ、位相、離角、方位角、高度を、ただのデータで返します。
---

`@johnmorrisdotca/wakusei-planets/sky-bodies` の `skyBodies(when, observer?)` は、ある瞬間に、太陽、月、ほかの7つの惑星、冥王星が空のどこにあるかを返します。空のどこにあるか、どれだけ明るいか、どれだけ大きいか、円盤のどれだけが光っているか、太陽からどれだけ離れているか、そして場所を渡したときは、どちらを向けばよいか、その天体が上がっているかどうかです。純粋な関数で、瞬間は渡すもの、時計は読まず、DOM も three.js も使いません。このパッケージ自身の位置 (太陽と月は `/suncalc` と同じ空のエンジン、惑星は光行時間と光行差つきの VSOP87B、冥王星はその表) を使い、第二のモデルは持ちません。

```js
import { skyBodies } from "@johnmorrisdotca/wakusei-planets/sky-bodies";

// Where the Sun, the Moon and the planets are over Tokyo at 21:00 on 21 June 2026 (12:00 UTC): plain data, no browser, no clock read.
const sky = skyBodies(Date.UTC(2026, 5, 21, 12), { latitude: 35.69, longitude: 139.69, heightM: 40 });
const up = sky.filter((body) => body.aboveHorizon).map((body) => body.id);
const moon = sky.find((body) => body.id === "moon");
const mars = sky.find((body) => body.id === "mars");

console.log(`Up: ${up.join(", ")}`);
console.log(`Moon: ${Math.round(moon.illuminatedFraction * 100)} per cent lit, ${moon.horizontal.altitudeDeg.toFixed(1)} degrees up`);
console.log(`Mars: magnitude ${mars.magnitude.toFixed(1)}, ${mars.elongationDeg.toFixed(0)} degrees ${mars.east ? "east" : "west"} of the Sun`);
```

`when` は `Date` か、1970年からのミリ秒 (UTC) です。`observer` は `{ latitude, longitude, heightM? }` で、北緯 (度)、東経 (度)、メートルです。結果は `SKY_BODY_IDS` の順 (`sun`、`moon`、`mercury`、`venus`、`mars`、`jupiter`、`saturn`、`uranus`、`neptune`、`pluto`) の10個の天体のリストで、どれも JSON にしても安全なただのオブジェクトです。`skyBody(id, when, observer?)` は1つだけ返します。

| 項目 | 意味 |
| --- | --- |
| `id`、`name.en`、`name.ja`、`kind` | 天体、その名前、`star`、`moon`、`planet`、`dwarf` のいずれか。 |
| `accurate` | 値が下の精度に収まっていれば `true`。すべての天体にあります。冥王星は、表を当てはめた年 (1800〜2199年) の外でも返しますが `accurate: false` になり、その位置は数度ずれることもある近似の軌道から来ます。 |
| `equatorialDate` | その瞬間の見かけの位置。赤経・赤緯 (度)、その日の真の赤道と分点、光行差と章動を含みます。 |
| `equatorialJ2000` | 光行差を含まない同じ方向を、J2000 の赤道座標で (度)。J2000 で描く星図が読むものです。 |
| `distanceAu`、`distanceKm` | 地球の中心からの距離。 |
| `magnitude` | 見かけの視等級 (土星は環を含む)。 |
| `angularDiameterArcsec` | 円盤の視直径 (秒角)。 |
| `phaseAngleDeg`、`illuminatedFraction` | 太陽・天体・地球の角度 (0 が満、180 が新) と、円盤の光っている割合 (0〜1)。 |
| `elongationDeg`、`east` | 太陽からの離れ (度)と、天体が太陽の夕方側 (東) にあるか (赤経が太陽より半周未満だけ先にあれば東)。太陽にはありません。 |
| `moon` | 月だけ。`phase` (0 が新月、1 で1周期)、`waxing`、`brightLimbAngleDeg`。 |
| `horizontal`、`aboveHorizon` | 観測者を渡したときだけ。北から東まわりの `azimuthDeg`、`altitudeDeg` (幾何学的、視差を含む)、`apparentAltitudeDeg` (標準の大気差を含む)、`hourAngleDeg`、`parallacticAngleDeg`。そして見かけの高度が 0 より上かどうか。天頂と天底 (0.0001度以内) と地球の極では、方位角と視差角が定まらないので、いつも 0 を返します (丸め誤差の値ではありません)。月の視差は地球の中心からその場所へ引き直すので、地心の高度とは最大で1度ほど違います。 |

角度は度、距離は天文単位 (とキロメートル)、大きさは秒角で、単位や座標系は各項目の名前に入っています。

## どれだけ近いか

JPL Horizons (観測者表。2024-03-20、2026-06-21、2030-12-01 の3つの日付だけ、つまり2024年から2030年で確かめ、東京とオタワで、オンラインで読んだもの) と比べると、太陽、惑星、冥王星は、その日の分点でも J2000 でも赤経・赤緯が0.1分角以内、月はその日の分点で0.02分角、J2000 で0.015分角以内です。視直径は0.1パーセント以内、照らされた割合は0.02パーセントポイント以内、離角は0.02度以内、方位角と高度は月の視差を含めて0.1分角以内です。等級は、太陽、水星、金星、木星、土星が0.02以内、天王星と海王星が0.03以内、月が0.06以内、火星が0.1以内 (表面の模様はモデルにありません)、冥王星が0.5以内 (固定の絶対等級だけだからです)。惑星の等級は、Mallama と Hilton (2018) が示す Astronomical Almanac の式です (式だけ。`NOTICE.md` に書いてあります)。時刻は UTC を UT1 とみなし (最大0.9秒、地球の自転で0.004度)、標準の大気差は気温10度、1010 hPa の空気のものです。

## 受け付ける年

瞬間は 1750-01-01 から 2250-01-01 (UTC) まででなければなりません (`SKY_RANGE`)。このパッケージ自身の検査が惑星の級数 (VSOP87B) などを保証する年で、精度ガイドには「1750年から2250年までよく、それより外では少しずつ悪くなる」とあります。範囲の外の瞬間は、範囲を名指しした `RangeError` を投げるので、範囲外の数値が良い値のように返ることはありません。上の数値の比較は2024年から2030年で行ったもので、その前後は1750年と2250年までは級数自身の検査が支えています。

## 星図にはデータとして渡す

星図を描くページは、このリストをただのデータとして渡します。星図は自分の入力の型を持ち、このパッケージを import せず、このパッケージも星図を import しません。出没や南中の時刻はここにはありません。[`/suncalc`](suncalc.md) にあります。
