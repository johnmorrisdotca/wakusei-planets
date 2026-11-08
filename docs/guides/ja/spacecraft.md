---
title: 有名な探査機
section: how-to
order: 17
description: パイオニア10号からウェッブ望遠鏡まで、有名な探査機10機。情報、航海の出来事、任意の日の位置を、JPL Horizons に合わせて用意しました。探査機ごとに別の表で、gzip で 2〜127 kB です。
---

`/spacecraft` は、有名な探査機10機について2つのことに答えます。ある日にどこにいるか、そして航海で何があったか、です。対象はボイジャー1号と2号、ニュー・ホライズンズ、パイオニア10号と11号、カッシーニ、ガリレオ、ジュノー、パーカー・ソーラー・プローブ、ジェイムズ・ウェッブ宇宙望遠鏡です。それぞれの軌道は、JPL Horizons が持つ記録の全期間 (打ち上げの約1時間後から、ミッションの終わりまで。まだ飛んでいる探査機は Horizons の予測の終わりまで) に合わせた表です。DOM も three.js も使わず、どこでも動きます。探査機の表は、たずねたときにだけ読み込まれます。

```ts
import { loadSpacecraft, SPACECRAFT, spacecraftLightTime, spacecraftPosition, spacecraftSpeed, spacecraftSunDistance } from "@johnmorrisdotca/wakusei-planets/spacecraft";

await loadSpacecraft("voyager1");
const day = Date.UTC(2026, 10, 8);
console.log(SPACECRAFT.voyager1.name.en, "is", (spacecraftSunDistance("voyager1", day) / 149597870.7).toFixed(1), "au from the Sun");
console.log("a radio signal takes", (spacecraftLightTime("voyager1", day) / 3600).toFixed(1), "hours to reach it, and it moves at", spacecraftSpeed("voyager1", day).toFixed(1), "km/s");
console.log("x, y, z in au:", spacecraftPosition("voyager1", day).map((km) => (km / 149597870.7).toFixed(1)).join(", "));
```

## 10機の探査機

| ID | 探査機 | Horizons の記録 | 表のサイズ (gzip) |
|---|---|---|---|
| `voyager1` | ボイジャー1号 | 1977-09-05 〜 2099-12-31 | 3.2 kB |
| `voyager2` | ボイジャー2号 | 1977-08-20 〜 2099-12-31 | 4.7 kB |
| `newhorizons` | ニュー・ホライズンズ | 2006-01-19 〜 2049-12-31 | 2.0 kB |
| `pioneer10` | パイオニア10号 | 1972-03-03 〜 2049-12-31 | 2.6 kB |
| `pioneer11` | パイオニア11号 | 1973-04-06 〜 2049-12-31 | 3.7 kB |
| `cassini` | カッシーニ | 1997-10-15 〜 2017-09-15 | 127 kB |
| `galileo` | ガリレオ | 1989-10-19 〜 2003-09-30 | 25 kB |
| `juno` | ジュノー | 2011-08-05 〜 2028-09-02 | 77 kB |
| `parker` | パーカー・ソーラー・プローブ | 2018-08-12 〜 2029-12-31 | 27 kB |
| `webb` | ジェイムズ・ウェッブ宇宙望遠鏡 | 2021-12-25 〜 2031-11-01 | 3.3 kB |

記録のはじめと終わりは、Horizons 自身が探査機ごとに示す日時です (`SPACECRAFT.<id>.record`、1970年からのミリ秒、UTC)。この範囲の外の日付は、日付と記録の範囲を書いた `RangeError` になります。記録は打ち上げの約1時間後に始まります。まだ飛んでいる探査機 (と、通信が終わったパイオニア10号と11号) の記録の終わりは Horizons の予測なので、今日より先の日付は予測です。

惑星のまわりを回った探査機は、通り過ぎただけの探査機よりずっと多くの数が要ります。カッシーニは土星を300回近く回り、惑星に近づくたびに短い区間が必要だからです。表は別々のファイルで、引数なしの `loadSpacecraft()` は全部 (gzip で約275 kB) を読み込みます。ボイジャー1号だけを描くページは `"voyager1"` を指定すれば、3 kB で済みます。

## たずねられること

| 関数 | 返すもの |
|---|---|
| `SPACECRAFT` と `SPACECRAFT_IDS` | 各探査機の情報: 英語と日本語の名前、打ち上げの日・場所・ロケット、機関、ミッションの終わり、状態、NASA のミッションページ、Horizons の番号、記録の範囲、航海の出来事 |
| `loadSpacecraft(...ids)` | 表を読み込みます (何も渡さなければ10機すべて)。最初に1回呼び、終わるのを待ちます |
| `spacecraftPosition(id, when)` | 太陽からの x, y, z (km)。J2000 黄道座標系で、`heliocentric` と同じ軸です (`heliocentric` は天文単位) |
| `spacecraftVelocity(id, when)` と `spacecraftSpeed(id, when)` | 太陽に対する速度 (km/s) と、その大きさ |
| `spacecraftSunDistance(id, when)` と `spacecraftEarthDistance(id, when)` | 太陽の中心と地球の中心からの距離 (km) |
| `spacecraftLightTime(id, when)` | 地球から探査機まで電波が届くのにかかる秒数 |
| `spacecraftErrorKm(id)` | 読み込んだ軌道の、Horizons に対する最大の誤差 (作ったときに測った値) |

`when` は、このパッケージのほかの関数と同じく、`Date` か1970年からのミリ秒 (UTC) です。読み込んでいない表は、`loadSpacecraft` を呼ぶよう伝える `Error` になります。知らない探査機や、数でない日付は `RangeError` になります。

## 航海の出来事

各探査機の `events` には、打ち上げ、各フライバイ、惑星の周回軌道に入ったとき、到着した場所 (ウェッブ望遠鏡は太陽・地球系の第2ラグランジュ点)、ミッションの終わりが、順番に、英語と日本語の名前つきで入っています。フライバイには、惑星を `body` に、NASA のページにある最接近の距離 (惑星の雲の上、または天体の表面からの高さ) を入れています。`precision` は、ページに時刻があれば `"minute"`、日付しかなければ `"day"` です。

```ts
import { loadSpacecraft, SPACECRAFT, spacecraftEarthDistance, spacecraftSunDistance } from "@johnmorrisdotca/wakusei-planets/spacecraft";

await loadSpacecraft("voyager2");
for (const event of SPACECRAFT.voyager2.events) {
  const when = Math.max(event.date, SPACECRAFT.voyager2.record.start);
  const sun = spacecraftSunDistance("voyager2", when) / 149597870.7;
  const earth = spacecraftEarthDistance("voyager2", when) / 149597870.7;
  console.log(new Date(event.date).toISOString().slice(0, 10), event.name.en.padEnd(14), sun.toFixed(1), "au from the Sun,", earth.toFixed(1), "au from the Earth");
}
```

打ち上げからある日までの軌跡を描くには、`record.start` からその日まで日付を進めながら `spacecraftPosition` を呼びます。線は、その探査機の `joins` (次の節) のところで切ってください。

## どのくらい正確か

どの表も、Horizons の記録のすべての点が、ある限度の中に入るように作りました。限度は、惑星やフライバイの相手の近く、そして土星や木星を回っている間は 1,000 km、それ以外では太陽からの距離の100万分の1 (太陽から見て約0.2秒角。今日のボイジャー1号で25,000 km) です。ただし 1,000 km より小さくはしません。表の区間は、この限度が許す長さで、惑星の近くでは数秒、巡航中は数年です。速さは、サンプル点で速さの1パーセント以内にしています。フィットに使わなかった点と、フィットの格子にない時刻のランダムな新しい点240個で測った結果です。

| 探査機 | 使わなかった点での最大 | 新しい点での最大 |
|---|---|---|
| ボイジャー1号 | 42,000 km (2100年、370 au) | 24,000 km |
| ボイジャー2号 | 35,000 km (2100年) | 26,000 km |
| ニュー・ホライズンズ | 8,800 km (2050年) | 6,800 km |
| パイオニア10号 | 13,000 km (2050年) | 8,500 km |
| パイオニア11号 | 11,000 km (2050年) | 7,100 km |
| カッシーニ | 931 km | 802 km |
| ガリレオ | 844 km | 602 km |
| ジュノー | 840 km | 758 km |
| パーカー・ソーラー・プローブ | 848 km | 567 km |
| ジェイムズ・ウェッブ宇宙望遠鏡 | 840 km | 670 km |

テストでは、フィットに使っていない Horizons のサンプル日 (`test/data/spacecraft-horizons.json`) で、各探査機が限度の中にあること、どの表もサイズの予算の中にあることを確かめます。また、各フライバイを、フィットした軌道が天体に最も近づく点と比べます。日時は10分以内 (NASA が日付しか書いていないものは18時間以内)、距離は数パーセント以内です。それらの点での速さは、Horizons の値の2パーセント以内です。新しい点での最悪の速さの差は3パーセントでした (パイオニア10号、12 km/s)。

2つの解がつながるところで、Horizons の記録自体が段差になります。`SPACECRAFT.<id>.joins` に、その場所と段差の大きさがあります。ボイジャー1号は1981-01-01に65,000 km、ボイジャー2号は1989-08-29に14,000 km、パイオニア10号は4回 (1983年に最大126,000 km)、パイオニア11号は6回 (1976年に最大459,000 km)、カッシーニは2002年に6,000 km、パーカーは2025-06-25に80,000 km です。表はこの段差をそのまま残すので、軌跡の線は継ぎ目で切ってください。この段差は Horizons 自身のもので、フィットの誤差ではありません。

## 情報のもと

位置は JPL Horizons、情報と出来事は NASA のミッションページ (2026-11-08 に読んだもの) で、[NOTICE.md](../../../NOTICE.md) に一覧があります。時刻は、ページに書いてあるときだけ入れています。ページと軌道が合わないときは、軌道の日付を使い、ここに書いておきます。

- ボイジャー2号の土星: NASA のページは最接近を1981-08-26の 01:21 UT としていますが、軌道の最接近は 03:24 UTC です。日付だけを残しています。
- カッシーニ: ページの年表は、最初の金星フライバイを1998年4月25日、地球フライバイを1999年8月17日としています。軌道の最接近は4月26日 13:44 UTC と8月18日 03:28 UTC で、こちらの日付を使っています。土星周回軌道への投入は、ページでは2004年7月1日の 21:12 UTC ですが、軌道の最接近は7月1日の 02:38 UTC です。日付だけを残しています。
- ニュー・ホライズンズの冥王星: ページは表面から 4,800 マイル (7,800 km) としていますが、軌道と Horizons では最接近は表面から 12,500 km (7,760 マイル) です。距離は入れていません。アロコスは、ページの 3,500 km に対し Horizons では 5,500 km で、小天体自身の位置の Horizons での不確かさによる差です。
- ジュノーの周回軌道への投入: NASA の記録は 03:53 UT で、これは燃焼が地球で確認された時刻です。軌道の最接近は2016年7月5日の 02:47 UTC です。日付だけを残しています。
