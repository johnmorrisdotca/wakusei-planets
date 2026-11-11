---
title: 地球への接近
section: how-to
order: 21
description: "2026年から2036年に地球から 0.05 au 以内を通る地球近傍天体のすべてと、1900年以降の非常に近い接近を、JPL の接近データから。日時、距離、速さ、大きさ。表 (134 kB) は /approaches だけが持ちます。"
---

`/approaches` は、地球近傍天体の地球への接近4,183件の一覧です。2026-01-01 から 2036-12-31 までに 0.05 au (750万 km、月までの距離の19倍) 以内を通るものすべて (3,013件) と、1900年から2025年末までの非常に近いもの、0.002 au (月までの距離の0.8倍) 以内 (1,170件) です。データは 2026-11-11 に読み取った JPL の接近表です。DOM も three.js も使わず、どこでも動き、時計も読みません。表 (gzip で約134 kB) はこの入口だけが持ち、`/approaches` を読み込まないページには入りません。

```ts
import { APPROACH_NOTE, nearestApproaches, nextApproach } from "@johnmorrisdotca/wakusei-planets/approaches";

const apophis = nextApproach("Apophis", Date.UTC(2026, 10, 11))!;
console.log(apophis.fullName, "passes on", new Date(apophis.date).toISOString(), "at", Math.round(apophis.distanceKm), "km,", apophis.distanceLunar.toFixed(3), "lunar distances, at", apophis.speedKmS.toFixed(1), "km/s");
for (const a of nearestApproaches(3, { from: Date.UTC(2026, 10, 11) })) console.log(a.fullName, new Date(a.date).toISOString().slice(0, 10), Math.round(a.distanceKm), "km");
console.log(APPROACH_NOTE.text);
```

## これは予測です

接近は、読み取った日に JPL が知っていた軌道からの予測です。新しい観測で軌道が改良されると変わります。また、その日より後に見つかった天体は含まれません。小さなものはほとんど、通り過ぎる数日前に見つかるからです。`APPROACH_NOTE` がこのことを文章で述べ、取得した日付と表の2つの部分 (`coverage.wide` と `coverage.close`) を示します。各記録の `predicted` は、取得日より後なら真です。表を見せるところには、この注意書きも添えてください。表の更新は `scripts/make-approaches-data.py --refresh` で行います。JPL にもう一度たずねます。

## 記録の中身

`designation`、`number`、`name`、`fullName`。`date` (1970年からのミリ秒、UTC) と `jdTdb`、そして `timeSigma` (時刻の3シグマの不確かさを分で。JPL が「1分未満」としか示さないときは `lessThan`)。`distanceAu`、`distanceKm`、`distanceLunar` (中心間の距離、公称値) と、3シグマの範囲の `minDistanceAu`、`maxDistanceAu`。地球に対する `speedKmS`。そして大きさです。JPL 自身の暦の文字列は TDB で、UTC より約1分進んでいます。アポフィスの通過は JPL のページでは TDB の 21:46、ここでは UTC の 21:45 です。

大きさは2通りあります。`H` は絶対等級で、`sizeRange` はそこから求めた直径です。アルベド 0.25 (明るい岩石質。小さいほう) と 0.05 (暗い天体。大きいほう) を仮定しています (`APPROACH_ALBEDO`)。両者は2.2倍違うので、範囲として扱ってください。JPL に実測の直径があるもの (39件) は `diameterKm` と `diameterSigmaKm` に入っていて、そちらのほうがよい数値です。接近表の H は軌道データベースの H と違うことがあります。アポフィスはここでは 19.09、`/asteroids` では 19.7 です。

## 使える関数

| 関数 | 返すもの |
|---|---|
| `approachList()` | すべての接近。古い順 |
| `approachesBetween(from, to)` | 日付の範囲の接近 |
| `nearestApproaches(count, filter?)` | 最も近い接近。近い順 |
| `nextApproach(object, after)` | 番号・仮符号・名前で指した天体の、ある時刻より後の次の接近 (時刻は呼び出し側が渡します。このモジュールは時計を読みません) |
| `approachesOf(object)` | 1つの天体のすべての接近 |
| `approachesWhere(filter)` | 日付、距離 (`maxAu`、`maxLunar`)、大きさ (`minDiameterKm`、`maxDiameterKm`)、天体、予測かどうかで絞り込み |
| `approachSizeRange(H)` と `approachDiameterKm(approach)` | H からの大きさの範囲と、最もよい1つの幅 |

```ts
import { approachesWhere } from "@johnmorrisdotca/wakusei-planets/approaches";

const near = approachesWhere({ from: Date.UTC(2026, 10, 11), to: Date.UTC(2030, 0, 1), maxLunar: 5, minDiameterKm: 0.1 });
for (const a of near) console.log(new Date(a.date).toISOString().slice(0, 10), a.fullName, a.distanceLunar.toFixed(2), "lunar distances");
```

絞り込みでの幅は、実測の直径があればそれ、なければ大きさの範囲の中間 (幾何平均) です。

## 数値の出どころ

JPL の接近データ API (バージョン 1.5) への2回の一覧要求で、直径と正式名も求めています。2026-11-11 に `scripts/make-approaches-data.py` で取得しました。NASA のデータは米国政府の著作物でパブリックドメインです。[NOTICE.md](../../../NOTICE.md) に書いてあります。距離は天体と地球の中心の間です。`/asteroids` と `/nearest` は軌道から位置を求めますが、この表は JPL 自身の答えです。
