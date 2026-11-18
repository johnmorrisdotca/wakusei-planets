---
title: 天体の物理量
section: how-to
order: 16
description: 太陽、惑星、冥王星、月の質量と GM、表面重力、地表の大気と表面温度を、出典と読み取った日つきのデータとして提供します。
---

`/body-physics` は、天体の物理モデルに必要な値をデータにしたものです。質量と GM、表面重力、地表の大気の密度と圧力、表面温度が入っています。どの値にも、読み取ったページと読み取った日がつき、出典に値がないものは `null` です。ブラウザー用のコードはないので、サーバーでも動きます。

```ts
import { bodyPhysics } from "@johnmorrisdotca/wakusei-planets/body-physics";

const earth = bodyPhysics("earth");
console.log(earth.mass?.value, earth.gm?.value, earth.surfaceGravity?.value);
console.log(earth.airDensity?.value, earth.pressure?.value, earth.temperature?.value);
console.log(earth.pressure?.quoted, earth.pressure?.source.url, earth.pressure?.source.pageUpdated, earth.pressure?.source.read);

const jupiter = bodyPhysics("jupiter");
console.log(jupiter.surfaceGravity?.value, jupiter.surfaceGravity?.level, jupiter.temperature?.value);

const moon = bodyPhysics("moon");
console.log(moon.airDensity, moon.temperature?.value, moon.temperature?.low, moon.temperature?.high);
```

出力:

```text
5.9722e+24 398600 9.82
1.217 101400 288
1014 mb https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html 2024-11-15 2026-11-18
25.92 1 bar 165
null null 95 390
```

`bodyPhysics` は `"sun"`、`"mercury"` から `"neptune"`、`"pluto"`、`"moon"` を受け取り、呼ぶたびに新しいオブジェクトを返します。それ以外の id は、その id を示す `RangeError` を投げます。項目は次のとおりです。

| 項目 | 意味 |
|---|---|
| `mass` | 質量 (キログラム) |
| `gm` | 標準重力パラメータ GM (km3/s2)。万有引力定数と質量の積 |
| `surfaceGravity` | 表面重力 (m/s2)。表面の平均、太陽は赤道での値、ガス惑星は 1 bar の高さでの値 |
| `airDensity` | 地表の大気の密度 (kg/m3)。ガス惑星は 1 bar の高さでの値。太陽、水星、月、冥王星はページに値がないので `null` |
| `pressure` | 圧力 (パスカル)。地表での値。ガス惑星は表面がないので 1 bar の高さでの値 (100,000 Pa)、太陽は光球の上端での値 |
| `temperature` | 温度 (ケルビン)。表面の平均、ガス惑星は 1 bar の高さでの値、太陽は有効温度。ページが範囲しか示さない場合 (月と冥王星) は `value` が `null` で、`low` と `high` に範囲が入ります |

どの値もオブジェクトで、`value` と `unit`、`source` (`name`、`url`、ページが最後に更新された日の `pageUpdated`、このパッケージのために読み取った日の `read`) があり、当てはまる場合は `quoted` (ページの書き方そのまま、`"~0.016 +/- 0.006 kg/m3"`)、`bound` (上限は `"below"`、おおよその値は `"about"`)、`uncertainty`、`low` と `high` (季節や1日の範囲)、`level` (`"1 bar"`)、`note` もあります。

## 値の出どころ

すべて NASA の惑星ファクトシート (国立宇宙科学データセンター、https://nssdc.gsfc.nasa.gov/planetary/factsheet/) から、天体ごとに1ページずつ、2026-11-18 に読み取りました。事実を表にして打ち込んだもので、ページの文章は写していません。ガス惑星のシートは、重力、密度、温度を 1 bar の高さでの値として示し、表面は示しません。そのため、ガス惑星の圧力は 1 bar の高さの圧力そのもの、100,000 Pa です。水星の圧力はシートの上限値 (`bound` は `"below"`)、月は夜間の値、冥王星はおよそ 13 マイクロバールです。シートの値がほかの表と違う場合 (地球の表面重力は、標準の 9.80665 m/s2 ではなく平均の 9.820 m/s2) も、このパッケージはシートの値をそのまま使います。

GM はシートの値で、シートの桁数のままです。`/stops` の質量と脱出速度は、同じ天体について JPL の、より桁数の多い GM を使っています。

## ないもの

準惑星と、月以外の衛星には NASA のファクトシートがないのでデータがなく、`bodyPhysics` は例外を投げます。それらの質量はほかの出典にありますが、このパッケージはまだ読み取っていません。
