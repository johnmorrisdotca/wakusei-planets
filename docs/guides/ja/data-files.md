---
title: データファイル
section: how-to
order: 30
description: 天体、軌道、探査機の表を使います。
---

[English](../data-files.md)

リリースには、UTF-8 の CSV と Parquet の表、各表の JSON スキーマ、`LICENCE-DATA.md`、`SHA256SUMS` があります。CSV の値がない場所は `\N`、Parquet では null です。数値は元の精度のままです。スキーマには各列の型、単位、意味、出典があります。

## 表と列

- `bodies`: `id`、`kind`、`parent`、`nameEn`、`nameJa`、`radiusKm`、`flattening`、`massKg`、`gmKm3s2`、`surfaceGravityMs2`、`tiltDeg`、`rotationHours`、`poleRa`、`poleDec`、`colour`。表面重力は GM を半径の二乗で割った値で、現地での測定値ではありません。
- `orbital-elements`: `id`、`parent`、`elementKind`、`frame`、`epochMs`、`aAu`、`aKm`、`eccentricity`、`inclination`、`node`、`argumentPeriapsis`、`meanAnomaly`、`meanLongitudeRate`、`periapsisRate`、`nodeRate`、`acceleration`、`poleRa`、`poleDec`、`waveAmplitude`、`wavePeriodDays`、`wavePhase`、`source`。角度は度です。速度と基準時の単位はスキーマを見てください。惑星には元データにある平均軌道長半径だけが入り、ほかの要素は空です。準惑星とその衛星は瞬間軌道要素、ほかの衛星は平均または近似した平均要素です。
- `spacecraft`: `id`、`nameEn`、`nameJa`、`agency`、`launchMs`、`launchPrecision`、`launchSiteEn`、`launchSiteJa`、`launchVehicle`、`endMs`、`status`、`url`、`horizonsId`、`recordStartMs`、`recordEndMs`、`joins`（JSON 配列）。
- `spacecraft-events`: `craftId`、`order`、`kind`、`dateMs`、`precision`、`nameEn`、`nameJa`、`body`、`distanceKm`。

コードは MIT ライセンスです。データには各出典の条件があり、正確なクレジットと条件は `LICENCE-DATA.md` にあります。再配布の条件が未確定の理論係数表は含めていません。

## 読み込み例

以下は未検証の例です。必要なツールは各自でインストールしてください。

Pandas:

```text
import pandas as pd
bodies = pd.read_csv("bodies.csv", na_values=[r"\N"])
bodies = pd.read_parquet("bodies.parquet")
```

Polars:

```text
import polars as pl
bodies = pl.read_csv("bodies.csv", null_values=r"\N")
bodies = pl.read_parquet("bodies.parquet")
```

R:

```text
bodies <- arrow::read_parquet("bodies.parquet")
```

Rust（Polars の parquet 機能を使用）:

```text
use polars::prelude::*;
let bodies = ParquetReader::new(std::fs::File::open("bodies.parquet")?).finish()?;
```
