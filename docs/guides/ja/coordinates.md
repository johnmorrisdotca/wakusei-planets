---
title: 座標変換
section: how-to
order: 12
description: 度単位の角度、名前付き座標系、AU 単位の成分を使う純粋な座標変換。
---

Node やブラウザーから `/coordinates` を読み込みます。依存先は `/time` だけです。描画、天体データ、テクスチャ、ブラウザーのグローバル変数は使いません。新しい依存パッケージはありません。テストでは依存先を含むバンドルの最小化・gzip 圧縮後のサイズを **4 KiB 以下**に制限します。

```ts
import { sphericalToCartesian, cartesianToSpherical, eclipticToEquatorial } from "@johnmorrisdotca/wakusei-planets/coordinates";

const context = { origin: "geocentric", frame: "eclipticJ2000", epoch: "J2000", corrections: "geometric" } as const;
const vector = sphericalToCartesian({ ...context, longitude: 113.215630, latitude: 6.684170, distanceAu: 1 });
console.log(vector.xAu, vector.yAu, vector.zAu);
console.log(cartesianToSpherical(vector));
console.log(eclipticToEquatorial({ ...context, eclipticLongitude: 113.215630, eclipticLatitude: 6.684170 }));
```

## 意味と単位

赤経も含め、角度はすべて**度**です。戻り値の経度・赤経は [0, 360)、緯度・赤緯は [-90, 90] です。直交座標の成分は `xAu`、`yAu`、`zAu`、半径は `distanceAu` です。右手系で、x 軸は経度 0°、y 軸は経度 90°、z 軸は北極を向きます。半径は正でなければなりません。ゼロベクトルは方向が定まらないため例外になります。球面の極で返す経度は便宜上 0° です。

すべての入出力に `origin`、`frame`、`epoch`、`corrections` を指定します。原点は `heliocentric`、`geocentric`、`topocentric` です。変換は原点を維持し、`corrections: "geometric"` だけを受け付けます。天体の位置計算や、光行時間・光行差・視差・大気差の補正は行いません。

| 座標系 | 元期 | 意味 |
| --- | --- | --- |
| `eclipticJ2000` | `"J2000"` | JD 2451545.0 TT の平均黄道・春分点 |
| `equatorialJ2000` | `"J2000"` | JD 2451545.0 TT の平均赤道・春分点 |
| `eclipticOfDate` | Unix UTC ミリ秒 | 指定時点の平均黄道・春分点 |
| `equatorialOfDate` | Unix UTC ミリ秒 | 指定時点の平均赤道・春分点 |
| `horizontal`（出力のみ） | Unix UTC ミリ秒 | 指定時点の観測者の地平座標 |

`eclipticToEquatorial` と `equatorialToEcliptic` は対応する平均黄道傾斜角で回転します。**J2000 から別の元期への歳差変換ではありません。** 結果を組み合わせるときは原点と元期をそろえます。戻り値は距離を含まない方向です。回転によって距離は変化しません。

## 観測者の地平座標

```ts
import { equatorialToHorizontal } from "@johnmorrisdotca/wakusei-planets/coordinates";

const when = new Date("2026-11-07T12:00:00Z");
console.log(equatorialToHorizontal({
  origin: "topocentric", frame: "equatorialOfDate", epoch: when.getTime(),
  corrections: "geometric", rightAscension: 120, declination: 20,
}, when, { observer: { latitude: 49.3, longitude: -123.1, heightM: 0 } }));
```

`equatorialToHorizontal(direction, when, { observer })` の入力は、元期が `when` と一致する**指定時点の平均赤道座標**です。J2000 は例外になります。`when` は `Date` または Unix ミリ秒で、渡した Date は変更しません。実行環境のタイムゾーンには依存しません。

観測者の緯度は北を正として [-90, 90]、経度は東を正として [-180, 180]（西は負）です。`heightM` は平均海面からの高さ（メートル）、既定値は 0 です。高さは検証しますが、方向のみの回転には影響しません。地平線の俯角や大気モデルは含みません。方位角は北から時計回り（東は 90°）、高度は [-90, 90] です。天頂・天底の方位角は便宜上 0° です。地理的な極では経度が基準子午線を決めます。

地心入力の原点表示は地心のままです。観測者の地平面に対する方向を返しますが、**地平視差は補正しません**。近い天体の幾何学的な観測高度が必要なら、あらかじめ観測者中心にした方向を入力してください。

## モデル・範囲・エラー

Jean Meeus『Astronomical Algorithms』第2版の第12・13・22章に基づいて独自に実装しています。球面回転、IAU 1980 平均黄道傾斜角（22.2）、グリニッジ平均恒星時（12.4）を使い、章動は含めません。黄道傾斜角では `/time` で UTC を TT に変換し、恒星時では UT1 を UTC で近似します。幾何学的な変換であり、視位置や精密な望遠鏡指向のモデルではありません。

既知値テストは Meeus の例 13.a・13.b・22.a を含みます。地平座標のテストには平均恒星時と視恒星時の違いを明記しています。黄道傾斜角は 1800–2050 年でテストし、その外では同じ多項式を外挿しますが精度は保証しません。時間を使う計算は JavaScript Date で表せる日時に限ります。不正値・非有限値、座標系や元期の不一致、範囲外の緯度・観測者経度、ゼロ半径、ベクトルのオーバーフローは `RangeError` になります。`NaN` は返しません。入力の経度・赤経は一周の範囲に正規化します。

[IoannisNasios/solarsystem の README](https://github.com/IoannisNasios/solarsystem/blob/master/README.md) は機能範囲の参考にしただけです。実装コードは参照もコピーもしていません。
