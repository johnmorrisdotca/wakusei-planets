---
title: 場所から見た太陽と月
section: how-to
order: 13
description: 緯度と経度から、太陽と月の位置、日の出と日の入り、月の出入りと月相を求めます。suncalc 2 と同じ名前で、より正確なエンジンです。
---

`/suncalc` は、自分が立っている場所から空について知りたいことに答えます。太陽と月はどこにあるか、日の出と日の入りはいつか、ゴールデンアワーや夜はいつか、月はいつ出ていつ沈むか、月はどれだけ光っているか、などです。[suncalc](https://github.com/mourner/suncalc) 2 と同じ関数、名前、引数、結果なので、import を変えるだけで使えます。ブラウザーがなくても動き、読み込むのは太陽と月の理論だけです (gzip で約10 kB)。

```ts
import { getMoonIllumination, getMoonPosition, getMoonTimes, getPosition, getTimes } from "@johnmorrisdotca/wakusei-planets/suncalc";

const tokyo = { lat: 35.7, lng: 139.7 };
const noon = new Date(Date.UTC(2026, 10, 7, 3));

const times = getTimes(noon, tokyo.lat, tokyo.lng, 0, 540);
console.log(times.sunrise?.toISOString(), times.sunset?.toISOString());

const sun = getPosition(noon, tokyo.lat, tokyo.lng);
console.log(sun.azimuth.toFixed(0), sun.altitude.toFixed(0));

const moon = getMoonPosition(noon, tokyo.lat, tokyo.lng);
console.log(Math.round(moon.distance), getMoonIllumination(noon).fraction.toFixed(2));
console.log(Object.keys(getMoonTimes(noon, tokyo.lat, tokyo.lng, 540)));
```

## 関数

| 関数 | 返すもの |
|---|---|
| `getPosition(date, lat, lng)` | 太陽の `azimuth` (北から時計回りの度) と見かけの `altitude` (度。大気差を含む) |
| `getTimes(date, lat, lng, height?, utcOffset?)` | `nadir`、`nightEnd`、`nauticalDawn`、`dawn`、`sunrise`、`sunriseEnd`、`goldenHourEnd`、`solarNoon`、`goldenHour`、`sunsetStart`、`sunset`、`dusk`、`nauticalDusk`、`night` を `Date` で返します。その日に起きないものは `null` で、極では `alwaysUp` か `alwaysDown` が付きます |
| `addTime(angle, riseName, setName)` と `times` | 太陽がある高度になる時刻を、自分で足せます |
| `getMoonPosition(date, lat, lng)` | `azimuth`、`altitude`、`distance` (km)、`parallacticAngle` |
| `getMoonIllumination(date?)` | 光っている割合 `fraction`、`phase` (0 が新月、0.25 が上弦、0.5 が満月、0.75 が下弦)、明るい縁の向き `angle`、満ちていくか `waxing` |
| `getMoonTimes(date, lat, lng, utcOffset?)` | `rise`、`set`、`transit`、`lowerTransit`。ない日はそのキーがありません。月が出ずっぱり、沈みっぱなしの日は `alwaysUp` か `alwaysDown` |

`date` は `Date` か、1970年からのミリ秒です。緯度は北が正 (-90 から 90)、経度は東が正 (西は負) の度です。範囲外の緯度、数でない経度、無効な日付は、値を入れた `RangeError` になります。`height` は水平線から見た観測者の高さ (m) です。高いほど日の出と日の入りの高度が下がり、1,000 m の高さでは太陽が出ている時間が長くなります。

## どの日か

`getTimes` と `getMoonTimes` は1日分の出来事を返します。どの日かを決める方法は2つです。

- **`utcOffset` がある場合** (UTC から東向きの分。バンクーバーの冬なら `-480`、東京なら `540`): `date` を含む現地の暦の日です。時間帯がわかっているときは、こちらを使ってください。
- **ない場合**: `date` を含む太陽日で、ある南中の反対側 (太陽の真夜中) から次の真夜中までです。暦の日とほぼ同じですが、現地の0時は太陽の真夜中より少し前なので、現地の正午ごろの時刻を渡してください。

`nadir` はその日の `solarNoon` に向かう太陽の真夜中です。暦の日で見ると、日の始まりの数分前になることがあります。

## どれくらい正確か

太陽は地球の VSOP87B の位置、月は月理論 ELP2000-82B で、どちらも地球時で計算します。地球の自転 (歳差、章動、分点差)、太陽の光行差、月の光行時間、場所の高さによる視差も入れています。大気差は標準の空気の Saemundsson の式です。

JPL Horizons に対する出入りの時刻です。どのパッケージにも同じ定義を使いました (太陽は中心が大気差なしの地平線の 0.833度下、月は上の縁が 34分角下)。場所はロンドン、トロント、東京、キト、シドニー、トロムソ、日は 2000年から2040年の7日です (各パッケージ 156回、見落としや間違いはなし)。

| パッケージ | 日の出・日の入り (最大) | 月の出・月の入り (最大) | ふつう (中央値) |
|---|---|---|---|
| このパッケージ | 0.4秒 | 0.4秒 | 0.1秒 |
| astronomy-engine 2.1.19 | 0.5秒 | 1.4秒 | 0.1〜0.2秒 |
| suncalc 2.1.2 | 5.3秒 | 7.1秒 | 1.3〜2.3秒 |

テストは、このパッケージがどの回も Horizons から 1秒以内であることを確かめます (`scripts/compare/rise-set.mjs` が3つとも測り、`python3 -I scripts/compare/fetch-rise-set.py` で参照を取り直せます)。太陽の大きさを固定の 16分角ではなく本当の大きさで使う astronomy-engine 自身の出入りに対しては、太陽 12秒、月 8秒を上限にしています。

誤差の下限を決めるのは2つで、どのパッケージにも入っていません。1つは、地球の自転を UTC から取っていることで、本当の UT1 とは 0.9秒以内の差があります (上の最大、2000年1月のロンドンはこの差です)。もう1つは、大気差が標準の空気の値で、その日の天気ではないことです。中緯度では日の出が数秒、寒い日や低気圧の日の水平線の近くでは数分ずれます。秒までの時刻は正直ですが、0.1秒までの時刻はそうではありません。

## suncalc 2 から移るとき

import を変えて、テストを回してください。結果は上の範囲で一致します。一致しないのは次の点です。

- **水平線より下**では、太陽と月の `altitude` は幾何学的な高度で、大気差は -2度でなくなります。suncalc 2 は、どんなに深くても水平線の大気差 0.49度を足し続けますが、それは物理的ではありません。水平線より上では、0.006度以内で一致します。
- **月の出と月の入り**は、月の本当の距離で、上の縁が大気差34分角を通して水平線にあるときです。米国海軍天文台の表と同じ決め方です。

## suncalc 1.x や suncalc2 から移るとき

suncalc 1.x と、そのフォークの suncalc2、suncalc3 は、suncalc 2 とは別の約束を使っています。`/suncalc/legacy` はその約束を守るので、変えるのは import の1行だけです。

```ts
// import * as SunCalc from "suncalc";   // 1.x, suncalc2
import * as SunCalc from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";

const noon = new Date(Date.UTC(2026, 5, 21, 12));
const { azimuth, altitude } = SunCalc.getPosition(noon, 51.5, -0.1);
console.log((azimuth * 180 / Math.PI).toFixed(0), (altitude * 180 / Math.PI).toFixed(0));
console.log(Number.isNaN(SunCalc.getTimes(noon, 69.65, 18.96).sunrise!.getTime()));
```

あとで `/suncalc` (suncalc 2 の約束) に移るときに変わるのは3つです。

| | `/suncalc/legacy` (suncalc 1.x) | `/suncalc` (suncalc 2) |
|---|---|---|
| 角度 | ラジアン | 度: `radians * 180 / Math.PI` |
| 方位 | 南から西向き (0 が南、4分の1回転で西) | 北から時計回り (0 が北、90 が東、180 が南): `(legacy * 180 / Math.PI + 180) % 360` |
| 起きない出来事 | 無効な `Date`。`Number.isNaN(d.getTime())` で調べます | `null` (月は、そのキーがない)。極地では `alwaysUp` か `alwaysDown` |

同じ太陽を、両方で読むと次のようになります。

```ts
import { getPosition as legacyPosition } from "@johnmorrisdotca/wakusei-planets/suncalc/legacy";
import { getPosition } from "@johnmorrisdotca/wakusei-planets/suncalc";

const noon = new Date(Date.UTC(2026, 5, 21, 12));
const old = legacyPosition(noon, 51.5, -0.1);
const now = getPosition(noon, 51.5, -0.1);
console.log(((old.azimuth * 180 / Math.PI + 180) % 360).toFixed(1), now.azimuth.toFixed(1));
console.log((old.altitude * 180 / Math.PI).toFixed(1), now.altitude.toFixed(1));
```

どちらの行も一致します。高度が違ってくるのは空の低いところだけで、suncalc 1 が太陽に足さない大気差の分です (水平線で約0.5度)。

### 日の決め方

- **`getTimes(date, lat, lng, height?)`** には `utcOffset` がありません。suncalc 1 と同じく、`date` にいちばん近い太陽日 (ある太陽の真夜中から次まで) の出来事を返します。現地の正午ごろの時刻を渡せば、現地のその日の出来事になります。
- **`getMoonTimes(date, lat, lng, inUTC?)`** は、`date` の日の0時から24時間を探します。0時は、その機械のタイムゾーンの0時、`inUTC` が true なら UTC の0時です。遅く出た月が翌日に沈むと、その日は `rise` だけで `set` がありません。
- `/suncalc` では、どちらも `utcOffset` (UTC から東へ何分か) を取り、機械のタイムゾーンによらず現地の暦の日になります。

### suncalc 1 と同じほかの点

太陽の高度は大気差なし、月の高度は大気差ありです。明るい縁の `angle` は、月が満ちていくあいだ負です。`getMoonTimes` に `transit` はなく、`getTimes` には `height` はあっても `utcOffset` はありません。数値は `/suncalc` と同じエンジンから出るので、suncalc 1 より正確です。suncalc 1 には ΔT がなく、月は平均要素なので、1950年の太陽で0.3〜0.6度ずれます。

## まだないもの

suncalc3 は、このパッケージがまだ扱っていない関数やオプションを足しています。たとえば、太陽が決めた方位に来る時刻、太陽時、次の月相の日付です (MODULES-537。suncalc-ts が足すものはありません)。日食と月食、惑星の出入り、春分や夏至などは、同じエンジンの上で計画していて、`/suncalc` にはまだありません。
