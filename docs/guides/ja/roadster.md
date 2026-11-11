---
title: スターマンとテスラ・ロードスター
section: how-to
order: 18
description: "ファルコン・ヘビー初号機で打ち上げられたテスラ・ロードスターの、2018年から2035年までの任意の日の位置と、距離・速さ・軌道・見どころの日時を、JPL Horizons の状態ベクトルの表 (約20 kB) から求めます。"
---

`/roadster` は、スターマンが乗ったテスラ・ロードスターが、ある日にどこにいるか、そのときの数値は何か、に答えます。2018年2月6日、スペースXがファルコン・ヘビー初号機で太陽のまわりの軌道に打ち上げた車です。軌道は、JPL Horizons (対象番号 `-143205`) の状態ベクトル (位置と速度) の表で、位置と速度を使った3次エルミート補間でつなぎます。DOM も three.js も使わず、どこでも動き、読み込みの手順も要りません。表 (gzip で約20 kB) はこの入口だけが持ち、`/roadster` を読み込まないページには入りません。

```ts
import { ROADSTER, roadsterPosition, roadsterStats } from "@johnmorrisdotca/wakusei-planets/roadster";

const day = new Date("2026-11-11T12:00:00Z");
const stats = roadsterStats(day);
console.log(ROADSTER.name.en, "is", stats.sun.au.toFixed(2), "au from the Sun and", Math.round(stats.earth.km / 1e6), "million km from the Earth");
console.log("it moves at", stats.speed.sun.toFixed(1), "km/s, has made", stats.orbitsCompleted, "orbits and is", stats.daysSinceLaunch.toFixed(0), "days old");
console.log("x, y, z in km:", roadsterPosition(day).map((km) => Math.round(km)).join(", "));
```

## 範囲と正確さ

表がカバーするのは、2018-02-07 02:58:50 UTC (打ち上げの約6時間後。Horizons の記録が始まる時刻) から 2035-01-01 02:58:50 UTC までです。`ROADSTER.record` が両端を1970年からのミリ秒で持っています。この範囲の外の日付は、日付と範囲を書いた `RangeError` になります (探査機のものと同じです)。`ROADSTER_ACCURACY` が数値を示します。範囲、行の間隔 (10日)、補間の最大誤差です。

| 場所 | 行の間隔 | Horizons 自身の記録との最大の差 |
|---|---|---|
| 最初の1日 (まだ地球の引力で軌道が曲がる) | 2時間 | 755 km |
| 1日め〜10日め | 1日 | 62 km |
| 10日め〜終わり | 10日 | 645 km |

間隔は、5日から試して、最大誤差が 1,000 km の80%に収まる最大のものです。範囲の全日、最初の13日間の毎時、2020年10月の火星接近のまわりの毎時と比べました。どの行にも当たらない15の日付 (`test/data/roadster-horizons.json`) では、位置は Horizons と 629 km 以内、速度は毎秒2メートル以内でした。記録全体では、速度 (補間の傾き) は最初の1日を除いて Horizons と毎秒2.3メートル以内、最初の1日は毎秒115メートル以内です。

これは補間の誤差で、もうひとつの誤差に比べればずっと小さいものです。**軌道そのものが予測です。** Horizons の解 (s11) は、2018年2月と3月の374回の望遠鏡観測にあてはめたもので、太陽光が車を押す力もそこから1つの数として推定しています。その後、車は追跡されていません。実際の車は予測の軌道からずれ、2018年から離れるほど大きくなります。2035年の接近は、約束ではなく予測です。

## たずねられること

| 関数 | 答え |
|---|---|
| `ROADSTER` | 英語と日本語の名前 (`name`、`car`)、打ち上げ、Horizons の番号、範囲 |
| `roadsterPosition(when)` と `roadsterPositionAu(when)` | 太陽から見た x、y、z。キロメートル、または天文単位 (`heliocentric` が惑星に使う単位)。J2000 黄道座標 |
| `roadsterVelocity(when)` と `roadsterSpeed(when)` | 太陽に対する速度 (km/s) と、その大きさ |
| `roadsterStats(when)` | 太陽・地球・火星からの距離 (km、マイル、au と光の時間)、それぞれに対する速さ、打ち上げからの日数、太陽を回った回数、いまの周期、前後の最接近 |
| `roadsterElements(when)` | 接触軌道要素: 軌道長半径、離心率、軌道傾斜角、昇交点、近日点引数、近点角、周期、近日点・遠日点の距離 |
| `roadsterApproaches("earth" か "mars")` | 範囲内の、1天文単位より近い最接近すべて (日時と距離つき) |
| `roadsterEvents()` | 打ち上げ、最接近、近日点、遠日点を、日付順に。英語と日本語の名前つき |
| `roadsterSeries(from, to, stepMs)` | 太陽・地球・火星からの距離と速さを等間隔で。グラフ用 |

地球と火星はこのパッケージ自身の位置 (`heliocentric`) で、どの距離も光が進む時間は考えに入れていません。15のテスト日では、地球と火星からの距離は Horizons のそれぞれの天体からのベクトルと 2,000 km 以内、それらに対する速さは毎秒1メートル以内でした。周期と軌道の形は、状態ベクトルと太陽の重力定数から求めたもので、Horizons 自身の接触軌道要素と、周期は0.03日、角度は0.02度以内で一致します。

太陽を回った回数は、打ち上げから太陽のまわりで掃いた角度を1周で割ったものです。表が始まる前の最初の約6時間は、最初の行の割合で数えます (1周の1000分の1未満)。接触周期は約557日で、惑星の引力で日ごとに少し変わります。

## 見どころの日時

```ts
import { roadsterApproaches, roadsterEvents } from "@johnmorrisdotca/wakusei-planets/roadster";

for (const event of roadsterEvents().slice(0, 8)) {
  const km = event.distanceKm === undefined ? "" : ` ${(event.distanceKm / 149597870.7).toFixed(3)} au`;
  console.log(new Date(event.date).toISOString().slice(0, 10), event.name.en + km);
}
const mars = roadsterApproaches("mars").find((a) => new Date(a.date).getUTCFullYear() === 2020)!;
console.log("Mars, 2020:", new Date(mars.date).toISOString(), (mars.distanceKm / 149597870.7).toFixed(4), "au");
```

2020年10月7日の火星への最接近は 06:28 UTC、0.0495 au で、Horizons 自身の値と合っています。Horizons のこの天体の接近予測表は 2020 Oct 07.268、0.049505 au です。最接近とは、中心どうしの距離が 1 天文単位より小さくなる極小のことです。打ち上げと範囲の最後の数日は数えません。近日点と遠日点は、太陽からの距離が最小と最大になる点です。2035年4月22日の火星接近は、範囲が終わった数か月後です。

イベントには `kind`、`date`、`name` (`en` と `ja`)、そして最接近・近日点・遠日点では `distanceKm` があります。ページはこれを一覧にして、`date` へ移動できます。

## グラフ

```ts
import { roadsterSeries } from "@johnmorrisdotca/wakusei-planets/roadster";

const week = 7 * 86_400_000;
const { times, earthKm, marsKm, sunKm, speed } = roadsterSeries(Date.UTC(2018, 2, 1), Date.UTC(2026, 10, 11), week);
console.log(times.length, "weeks; nearest to the Earth", Math.round(Math.min(...earthKm) / 1e6), "million km, to Mars", Math.round(Math.min(...marsKm) / 1e6), "million km");
console.log("fastest", Math.max(...speed).toFixed(1), "km/s, furthest from the Sun", (Math.max(...sunKm) / 149597870.7).toFixed(3), "au");
```

1つの系列に入るのは最大100,000点で、それより多いと、間隔を大きくするよう求める `RangeError` になります。

## 数値の出どころ

軌道は JPL Horizons (対象番号 `-143205`、中心は太陽、J2000 の黄道と春分点) から2026-11-11に取得したもので、`scripts/make-roadster-data.py` が取得し、誤差を測り、`src/data/roadster.ts` を書きます。NASA のデータは米国政府の著作物でパブリックドメインです。[NOTICE.md](../../../NOTICE.md) にそう書いてあります。打ち上げの時刻と名前は、Horizons のこの天体についての注記によります。
