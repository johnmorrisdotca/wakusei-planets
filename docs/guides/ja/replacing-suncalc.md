---
title: suncalc を置き換える
section: how-to
order: 14
description: suncalc (2.x、1.x、フォーク) をやめて、import を変えるだけでこのパッケージを使います。すべての関数、オプション、結果、つまずきやすい3つの変更点、測定した差を示します。
---

[suncalc](https://github.com/mourner/suncalc) を、太陽と月の位置、日の出と日の入り、月の出と月の入り、月相のために使っているなら、suncalc もそのフォークも要りません。`@johnmorrisdotca/wakusei-planets` には suncalc 2.1 と suncalc 1.9 のすべての関数とオプションが、同じ名前、同じ引数、同じ結果の形で入っていて、エンジンはより正確です (VSOP87B の太陽、ELP2000-82B の月、ΔT、視差)。変えるのは import の1行だけです。

## 1行の変更

| 今使っているもの | import の変更先 |
|---|---|
| suncalc 2.x (度、方位は北から) | `@johnmorrisdotca/wakusei-planets/suncalc` |
| suncalc 1.x、またはフォークの suncalc2、suncalc3、suncalc-ts (ラジアン、方位は南から) | `@johnmorrisdotca/wakusei-planets/suncalc/legacy` |

```ts
// 変更前: import * as SunCalc from "suncalc";
import * as SunCalc from "@johnmorrisdotca/wakusei-planets/suncalc";

const noon = new Date(Date.UTC(2026, 5, 21, 12));
const times = SunCalc.getTimes(noon, 51.5, -0.1, 0, 60);
console.log(times.sunrise?.toISOString(), SunCalc.getPosition(noon, 51.5, -0.1).altitude.toFixed(0));
```

`import SunCalc from "suncalc"` (suncalc 1.x の書き方) で書かれたコードも動きます。どちらの入口にも、同じ関数と同じ `times` 配列を持つ default export があります。

```ts
import SunCalc from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const { azimuth, altitude } = SunCalc.getPosition(new Date(Date.UTC(2026, 5, 21, 12)), 51.5, -0.1);
console.log(azimuth.toFixed(2), altitude.toFixed(2));
```

`require()` も Node 22.12 以降で使えます (このパッケージは ESM のみですが、Node はそのバージョンから `require` で ES モジュールを読み込めます)。

```js no-run
const { getTimes } = require("@johnmorrisdotca/wakusei-planets/suncalc");
```

依存パッケージも DOM もないので、サーバー、ワーカー、ブラウザーで動きます。`/suncalc` は gzip で約10 kB です。

## すべての関数の対応表

名前、引数、結果のキーは、どちらの入口でも suncalc と同じです。違うのは次の節の約束事だけです。

| suncalc | このパッケージ | 備考 |
|---|---|---|
| `getPosition(date, lat, lng)` | 同じ | `azimuth`、`altitude` |
| `getTimes(date, lat, lng, height, utcOffset)` | 同じ | `nadir`、`nightEnd`、`nauticalDawn`、`dawn`、`sunrise`、`sunriseEnd`、`goldenHourEnd`、`solarNoon`、`goldenHour`、`sunsetStart`、`sunset`、`dusk`、`nauticalDusk`、`night`、極では `alwaysUp` と `alwaysDown`。`/suncalc/legacy` に `utcOffset` はありません (suncalc 1.x にもありません) |
| `addTime(angle, riseName, setName)` と `times` | 同じ | `times` の行は `[angle, morningName, eveningName]` で、`getTimes` は追加した名前ごとに時刻を返します |
| `getMoonPosition(date, lat, lng)` | 同じ | `azimuth`、`altitude`、`distance` (km)、`parallacticAngle` |
| `getMoonIllumination(date?)` | 同じ | `fraction`、`phase`、`angle`、`waxing` (`waxing` は `/suncalc` のみで、suncalc 2 と同じです) |
| `getMoonTimes(date, lat, lng, utcOffset)` | 同じ | `rise`、`set`、`transit`、`lowerTransit`、`alwaysUp`、`alwaysDown`。`/suncalc/legacy` は `utcOffset` の代わりに `inUTC` を取り、suncalc 1.x と同じく `rise`、`set`、フラグを返します |

`date` は1970年からのミリ秒でも構いません。緯度が -90 から90 の外のとき、または日付でないものを渡したときは、値を示す `RangeError` を投げます。

## つまずきやすい3つの変更点

suncalc 1.x やフォークから `/suncalc` に移ると、次の3つが変わります。`/suncalc/legacy` は古い約束事のままなので、一歩ずつ移れます。

1. **角度は度**で、ラジアンではありません。`180 / Math.PI` を掛けます。
2. **方位は北から時計回り** (0 が北、90 が東、180 が南、270 が西) で、南から西向きではありません。古い値からは `(azimuth * 180 / Math.PI + 180) % 360` で変換します。
3. **起きない出来事は、太陽では `null`、月ではキーなし**で、極昼や極夜では `alwaysUp` か `alwaysDown` が立ちます。suncalc 1.x では無効な `Date` (`NaN`) です。

もう一つ、日の決め方があります。これは suncalc も含めて、どちらの入口でも同じです。`getTimes(date, lat, lng)` は `date` を含む太陽日 (ある太陽の真夜中から次の真夜中まで) の出来事を返すので、現地の正午に近い時刻を渡してください。`utcOffset` (UTC から東向きの分。バンクーバーの冬は `-480`、東京は `540`) を渡すと、現地の暦の日になります。`/suncalc/legacy` の `getMoonTimes` は、suncalc 1.x と同じく、真夜中 (その機械のタイムゾーンの0時、`inUTC` なら UTC の0時) からの24時間を調べます。

```ts
import { getPosition, getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const date = new Date(Date.UTC(2026, 5, 21, 12));
const old = getPosition(date, 51.5, -0.1);
console.log(((old.azimuth * 180 / Math.PI + 180) % 360).toFixed(0), (old.altitude * 180 / Math.PI).toFixed(0));
console.log(Number.isNaN(getTimes(date, 69.65, 18.96).sunrise.getTime()));
```

## あえて違えているところ

- **地平線より下**の高度は、-2度で消える大気差を加えた幾何学的な高度です。suncalc 2 はどんなに深くても地平線での大気差0.49度を足すので、地平線よりずっと下の太陽では、このパッケージより0.49度高くなります。地平線より上では、太陽は0.01度以内で一致します。
- **数値がより正確**なので、時刻は suncalc 2 と数秒、suncalc 1.x (ΔT がなく、月は平均要素) とは数分ずれることがあります。どちらの場合も、JPL Horizons に近いのはこのパッケージです ([場所から見た太陽と月](suncalc.md) を参照)。
- **`/suncalc/legacy` の太陽の高度は大気差なし、月は大気差あり**で、月が満ちていくあいだは明るい縁の `angle` が負になります。これらは suncalc 1.x 自身の約束事で、そのまま残してあります。
- **`alwaysUp` と `alwaysDown`** は、日の出がない日 (`getTimes`) や月の出も入りもない日 (`getMoonTimes`) に、片方が `true`、もう片方が `false` で両方そろいます。suncalc 2 と同じです。

## どう確かめたか

すべての関数を、suncalc 2.1.2 と suncalc 1.9.0 (どちらもこのパッケージの開発用依存としてだけ入れています。2条項 BSD ライセンスで、コードは配布もコピーもしていません) と、同じ格子の上で比べました。14か所 (赤道、南北両半球、両方の極圏、北緯78度、南緯77.85度) の、1900年から2100年までの11日、1日3つの時刻です。名前、結果のキー、フラグ、出来事があるかないかは完全に一致し、数値は次の範囲に収まります (この範囲はテストで確かめています: `test/suncalc-grid.test.ts`)。

| 項目 | `/suncalc` と suncalc 2.1.2、格子での最大 | `/suncalc/legacy` と suncalc 1.9.0、格子での最大 |
|---|---|---|
| 太陽の高度 (地平線より上) | 0.01度 | 0.02 ラジアン (1.2度) |
| 太陽の方位 | 0.03度 | 0.07 ラジアン (4.3度) |
| 月の高度 (地平線より上) | 0.06度 | 0.07 ラジアン (3.9度) |
| 月の方位 | 0.07度 | 0.15 ラジアン (8.5度) |
| 月までの距離 | 0.002パーセント | 1.6パーセント |
| 輝面比 | 0.0001 | 0.017 |
| 太陽の時刻、緯度45度まで | 38秒 | 209秒 |
| 太陽の時刻、緯度45から60度 | 38秒 | 571秒 |
| 太陽の時刻、極圏とその先 | 38秒 | 2132秒 |
| 月の時刻 | 23秒 | 最大53分 (機械のタイムゾーンによる。月は平均要素で、2時間刻みで探すため) |

legacy の差が大きいのは古いライブラリー自身の誤差のためです。このパッケージの時刻は JPL Horizons と1秒以内で一致しますが、suncalc 1.x はそうではありません。古い数値を分単位でそのまま再現する必要があるなら suncalc 1.x を使い続けてください。古い約束事のままで正しい数値が欲しいなら、`/suncalc/legacy` を使ってください。

## 均時差

`equationOfTime(when)` は、視太陽時から平均太陽時を引いた均時差を分で返します。値が正なら、日時計は地方平均太陽時に合わせた時計よりも進んでいます。経度が東へ1度増えるごとに、どちらの時計も4分進むので、両者の差は経度によらず同じです。

2026年11月3日の 12:00 UTC に、グリニッジで日時計を読むと、約 12:16:26 です。

```ts
import { equationOfTime } from "@johnmorrisdotca/wakusei-planets/suncalc";

const noon = Date.UTC(2026, 10, 3, 12);
const minutes = equationOfTime(noon);
const apparent = new Date(noon + minutes * 60_000);
console.log(minutes.toFixed(2), apparent.toISOString().slice(11, 19)); // 16.45 12:16:26
```

計算には `getTimes` と同じ太陽の視位置を使います。地球の自転に基づく時刻 UT1 は、UTC で近似します。2026年のグリニッジの経度で、毎日の値を365日分照合したところ、差は最大0.192秒でした。

出典：[JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)、[米国海軍天文台](https://web.archive.org/web/20261117/https://aa.usno.navy.mil/faq/eqtime)。

## suncalc3 にあって、このパッケージにないもの

suncalc3 (suncalc 1.x のフォーク) は、suncalc にもこのパッケージにもない関数を足しています。ここでは一覧にしただけで、実装はしていません。どれを実装するかはメンテナーが決めます。

| suncalc3 | 内容 | このパッケージでは |
|---|---|---|
| `getSunTime(date, lat, lng, elevationAngle, height, degree, inUTC)` | ある高度での太陽の出と入り | `addTime` と `getTimes` で得られますが、1回の呼び出しではありません |
| `getSunTimeByAzimuth(date, lat, lng, azimuth, degree)` | 太陽が指定した方位に来る時刻 | なし |
| `getSolarTime(date, utcOffset, lng)` | 太陽時 | 太陽と月についてはなし |
| `getMoonData(date, lat, lng)` | 月の位置、輝面、天頂角を1回で | 3回の呼び出しで得られます |
| `moonTransit(rise, set, lat, lng)` | 月の南中 | `getMoonTimes` の `transit` と `lowerTransit` |
| 名前付きの月相 (`id`、`name`、`emoji`、`css`) と `moonCycles` | 8つの名前のどれか | 数値のみ。名前の付け方は suncalc の README にあります |
| `getMoonIllumination().next` | 次の新月、上弦、満月、下弦の日付 | なし |
| `zenith`、`declination`、`...Degrees` の各フィールド、太陽の各時刻にある `pos` と `elevation` | 追加のフィールド | `/suncalc` は度が既定です。それ以外はなし |
| 名前を変えた時刻 (`civilDawn`、`astronomicalDawn` など) とブルーアワーの時刻 | 別名 | なし。ブルーアワーは `addTime` 1回で足せます |

suncalc-ts は型定義以外に何も足していません。suncalc3 のこれらの追加機能が必要なら、当面はそれだけ suncalc3 から使い、残りはこのパッケージを使ってください。
